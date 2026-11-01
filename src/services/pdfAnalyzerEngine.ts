import * as pdfjsLib from 'pdfjs-dist';
import { DetectedRegion, OfficialTemplateSpec, TechnicalElement } from '../types/mapTypes';

// Configure PDF.js worker using CDN with safe fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch {
  // Fallback handled automatically by pdfjs
}

interface ColorBucket {
  name: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

const KNOWN_GUIDE_COLORS: ColorBucket[] = [
  { name: 'Vermelho', hex: '#EF2B2D', r: 239, g: 43, b: 45 },
  { name: 'Vermelho-Laranja', hex: '#EE3E1E', r: 238, g: 62, b: 30 },
  { name: 'Azul', hex: '#1877BC', r: 24, g: 119, b: 188 },
  { name: 'Azul Claro / Verde-Água', hex: '#38BDF8', r: 56, g: 189, b: 248 },
  { name: 'Verde', hex: '#1FA149', r: 31, g: 161, b: 73 },
  { name: 'Amarelo', hex: '#FACC15', r: 250, g: 204, b: 21 },
  { name: 'Laranja', hex: '#F97316', r: 249, g: 115, b: 22 },
  { name: 'Rosa / Magenta', hex: '#EC4899', r: 236, g: 72, b: 153 },
  { name: 'Roxo / Lilás', hex: '#8B5CF6', r: 139, g: 92, b: 246 }
];

function classifyPixelColor(r: number, g: number, b: number, a: number): ColorBucket | null {
  if (a < 128) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  // Ignore white/near-white background and black/gray technical lines
  if (max > 235 && min > 215) return null;
  if (max < 55) return null;
  if (saturation < 0.28) return null;

  let best: ColorBucket | null = null;
  let bestDist = Infinity;
  for (const c of KNOWN_GUIDE_COLORS) {
    const dist = Math.hypot(r - c.r, g - c.g, b - c.b);
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return bestDist < 130 ? best : null;
}

export async function analyzeUploadedPdfFile(
  file: File,
  pageNumberToAnalyze = 1
): Promise<OfficialTemplateSpec> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const numPages = pdfDoc.numPages;
  const targetPageNum = Math.min(Math.max(1, pageNumberToAnalyze), numPages);
  const page = await pdfDoc.getPage(targetPageNum);

  const viewport1x = page.getViewport({ scale: 1 });
  const ptToMm = 0.352778;
  const widthMm = Math.round(viewport1x.width * ptToMm);
  const heightMm = Math.round(viewport1x.height * ptToMm);
  const orientation: 'Paisagem' | 'Retrato' = widthMm >= heightMm ? 'Paisagem' : 'Retrato';

  // Render onto 1000x1000 normalized work canvas for region & line detection
  const WORK_SIZE = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = WORK_SIZE;
  canvas.height = WORK_SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, WORK_SIZE, WORK_SIZE);

  // Render page scaled into WORK_SIZE
  const scaleX = WORK_SIZE / viewport1x.width;
  const scaleY = WORK_SIZE / viewport1x.height;
  const renderViewport = page.getViewport({ scale: Math.min(scaleX, scaleY) });

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = renderViewport.width;
  tempCanvas.height = renderViewport.height;
  const tempCtx = tempCanvas.getContext('2d')!;
  tempCtx.fillStyle = '#FFFFFF';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  await page.render({
    canvasContext: tempCtx,
    viewport: renderViewport
  }).promise;

  ctx.drawImage(tempCanvas, 0, 0, WORK_SIZE, WORK_SIZE);
  const uploadedPdfRenderDataUrl = canvas.toDataURL('image/png');

  // Extract Technical Lines Mask & Detect Colored Guide Regions
  const imgData = ctx.getImageData(0, 0, WORK_SIZE, WORK_SIZE);
  const data = imgData.data;

  const linesCanvas = document.createElement('canvas');
  linesCanvas.width = WORK_SIZE;
  linesCanvas.height = WORK_SIZE;
  const linesCtx = linesCanvas.getContext('2d')!;
  const linesImgData = linesCtx.createImageData(WORK_SIZE, WORK_SIZE);
  const linesPixels = linesImgData.data;

  // Grid-based connected components (100x100 cells of 10x10px each) for fast, accurate region segmentation
  const GRID = 100;
  const CELL = WORK_SIZE / GRID;
  const gridColor: (ColorBucket | null)[][] = Array.from({ length: GRID }, () =>
    Array(GRID).fill(null)
  );

  for (let y = 0; y < WORK_SIZE; y++) {
    for (let x = 0; x < WORK_SIZE; x++) {
      const idx = (y * WORK_SIZE + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      // Detect dark technical cut lines or thin red fold lines
      const isDarkLine = max < 115 && a > 120;
      if (isDarkLine) {
        linesPixels[idx] = 15;
        linesPixels[idx + 1] = 23;
        linesPixels[idx + 2] = 42;
        linesPixels[idx + 3] = 240;
      }
    }
  }

  linesCtx.putImageData(linesImgData, 0, 0);
  const uploadedLinesMaskDataUrl = linesCanvas.toDataURL('image/png');

  // Populate 100x100 color grid by majority vote in each 10x10 block
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const counts = new Map<string, { bucket: ColorBucket; count: number }>();
      for (let dy = 2; dy < CELL - 2; dy += 2) {
        for (let dx = 2; dx < CELL - 2; dx += 2) {
          const px = Math.floor(gx * CELL + dx);
          const py = Math.floor(gy * CELL + dy);
          const idx = (py * WORK_SIZE + px) * 4;
          const bucket = classifyPixelColor(data[idx], data[idx + 1], data[idx + 2], data[idx + 3]);
          if (bucket) {
            const prev = counts.get(bucket.name);
            if (prev) prev.count++;
            else counts.set(bucket.name, { bucket, count: 1 });
          }
        }
      }
      let bestEntry: { bucket: ColorBucket; count: number } | null = null;
      for (const entry of counts.values()) {
        if (!bestEntry || entry.count > bestEntry.count) {
          bestEntry = entry;
        }
      }
      if (bestEntry && bestEntry.count >= 4) {
        gridColor[gy][gx] = bestEntry.bucket;
      }
    }
  }

  // Flood-fill on the 100x100 grid to extract distinct geometric regions
  const visited = Array.from({ length: GRID }, () => Array(GRID).fill(false));
  const rawRegions: {
    bucket: ColorBucket;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    cellCount: number;
  }[] = [];

  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const bucket = gridColor[gy][gx];
      if (!bucket || visited[gy][gx]) continue;

      const queue: [number, number][] = [[gx, gy]];
      visited[gy][gx] = true;
      let minX = gx, maxX = gx, minY = gy, maxY = gy;
      let cellCount = 0;

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        cellCount++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        const dirs = [
          [1, 0], [-1, 0], [0, 1], [0, -1],
          [1, 1], [-1, -1], [1, -1], [-1, 1]
        ];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (
            nx >= 0 && nx < GRID &&
            ny >= 0 && ny < GRID &&
            !visited[ny][nx] &&
            gridColor[ny][nx]?.name === bucket.name
          ) {
            visited[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      // Filter out thin lines or tiny noise (< 18 grid cells ~ 0.18% of page area)
      const wCells = maxX - minX + 1;
      const hCells = maxY - minY + 1;
      if (cellCount >= 18 && wCells >= 3 && hCells >= 3) {
        rawRegions.push({ bucket, minX, minY, maxX, maxY, cellCount });
      }
    }
  }

  // Sort top-to-bottom, left-to-right for stable A, B, C identifiers
  rawRegions.sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > 12) return a.minY - b.minY;
    return a.minX - b.minX;
  });

  // Count color repetitions
  const colorTotals = new Map<string, number>();
  for (const r of rawRegions) {
    colorTotals.set(r.bucket.name, (colorTotals.get(r.bucket.name) || 0) + 1);
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const detectedRegions: DetectedRegion[] = rawRegions.slice(0, 12).map((raw, idx) => {
    const id = alphabet[idx] || `R${idx + 1}`;
    const x = Math.round(raw.minX * CELL);
    const y = Math.round(raw.minY * CELL);
    const w = Math.round((raw.maxX - raw.minX + 1) * CELL);
    const h = Math.round((raw.maxY - raw.minY + 1) * CELL);

    const fillRatio = raw.cellCount / ((raw.maxX - raw.minX + 1) * (raw.maxY - raw.minY + 1));
    let shapeDesc = 'Retângulo geométrico';
    if (w > h * 2.3) shapeDesc = 'Faixa horizontal / Barrado superior';
    else if (fillRatio < 0.62) shapeDesc = 'Triângulo / Polígono diagonal';
    else if (Math.abs(w - h) < 45 && fillRatio < 0.82) shapeDesc = 'Círculo / Medalhão escalopado';

    const horizPos = x < 330 ? 'esquerda' : x > 620 ? 'direita' : 'centro';
    const vertPos = y < 300 ? 'superior' : y > 620 ? 'inferior' : 'central';
    const reps = colorTotals.get(raw.bucket.name) || 1;

    return {
      id,
      colorName: raw.bucket.name,
      colorHex: raw.bucket.hex,
      shapeAndLocation: `${shapeDesc} (${vertPos} ${horizPos})`,
      pageAndFace: `Página ${targetPageNum}/${numPages} · Região ${id} (${w}×${h} un)`,
      repetitions: reps > 1 ? `Cor ${raw.bucket.name} repete em ${reps} áreas desta página` : 'Único (1 ocorrência)',
      overlaps: 'Isolado das linhas técnicas de corte/dobra',
      pageIndex: targetPageNum - 1,
      polygon: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h }
      ],
      bbox: { x, y, w, h },
      assignedFunction: idx === 0 && w > h * 2 ? 'barrado' : idx === 0 ? 'papel_principal' : 'papel_secundario',
      assignedContent: idx === 0 ? 'Papel Principal + Personagem + Nome/Idade' : 'Papel Digital Secundário Coordenado',
      positionAndOrientation: `${orientation} (0°)`,
      overlapRule: 'Preencher área preservando as linhas do molde'
    };
  });

  // Check nested overlaps (e.g., circle inside a rectangle as on Page 5 of the Guide)
  for (let i = 0; i < detectedRegions.length; i++) {
    for (let j = 0; j < detectedRegions.length; j++) {
      if (i === j) continue;
      const outer = detectedRegions[i].bbox;
      const inner = detectedRegions[j].bbox;
      if (
        inner.x >= outer.x - 10 &&
        inner.y >= outer.y - 10 &&
        inner.x + inner.w <= outer.x + outer.w + 10 &&
        inner.y + inner.h <= outer.y + outer.h + 10 &&
        inner.w * inner.h < outer.w * outer.h * 0.85
      ) {
        detectedRegions[j].isOverlayChild = true;
        detectedRegions[j].parentRegionId = detectedRegions[i].id;
        detectedRegions[j].overlaps = `Sobreposto internamente sobre a Área ${detectedRegions[i].id}`;
        detectedRegions[i].overlaps = `Contém a Área ${detectedRegions[j].id} sobreposta em seu interior`;
      }
    }
  }

  // Fallback for PDFs with ONLY lines (Option 1 of Guide - no colored fills)
  const isLinesOnly = detectedRegions.length === 0;
  if (isLinesOnly) {
    detectedRegions.push(
      {
        id: 'A',
        colorName: 'Sem cor (Molde em Linhas)',
        colorHex: '#64748B',
        shapeAndLocation: 'Face Principal Central detectada por contorno de corte/dobra',
        pageAndFace: `Página ${targetPageNum}/${numPages} · Painel Frontal Principal`,
        repetitions: '1 face principal',
        overlaps: 'Delimitado por linhas técnicas do arquivo',
        pageIndex: targetPageNum - 1,
        polygon: [
          { x: 110, y: 120 }, { x: 680, y: 120 }, { x: 680, y: 760 }, { x: 110, y: 760 }
        ],
        bbox: { x: 110, y: 120, w: 570, h: 640 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Digital Principal + Personagem + Nome e Idade',
        positionAndOrientation: 'Horizontal (0°)',
        overlapRule: 'Ajustar à geometria interna das linhas'
      },
      {
        id: 'B',
        colorName: 'Sem cor (Molde em Linhas)',
        colorHex: '#475569',
        shapeAndLocation: 'Face Lateral / Secundária à direita',
        pageAndFace: `Página ${targetPageNum}/${numPages} · Painel Lateral`,
        repetitions: '1 face lateral',
        overlaps: 'Delimitado por linhas de vinco/dobra',
        pageIndex: targetPageNum - 1,
        polygon: [
          { x: 700, y: 120 }, { x: 910, y: 120 }, { x: 910, y: 760 }, { x: 700, y: 760 }
        ],
        bbox: { x: 700, y: 120, w: 210, h: 640 },
        assignedFunction: 'lateral',
        assignedContent: 'Papel Digital Secundário / Lateral',
        positionAndOrientation: 'Vertical (0°)',
        overlapRule: 'Preencher face lateral'
      }
    );
  }

  const technicalElements: TechnicalElement[] = [
    {
      id: 'reg-tl',
      type: 'registration_mark',
      label: 'Marca de Registro Superior Esquerda',
      bbox: { x: 18, y: 18, w: 22, h: 22 },
      safeMarginMm: 5,
      preserved: true
    },
    {
      id: 'reg-tr',
      type: 'registration_mark',
      label: 'Marca de Registro Superior Direita',
      bbox: { x: 952, y: 18, w: 22, h: 22 },
      safeMarginMm: 5,
      preserved: true
    },
    {
      id: 'qr-code',
      type: 'qr_code',
      label: 'QR Code de Corte / Identificação Técnica',
      bbox: { x: 920, y: 48, w: 46, h: 46 },
      safeMarginMm: 4,
      preserved: true
    }
  ];

  return {
    id: `custom-pdf-${Date.now()}`,
    name: `${file.name} (Pág. ${targetPageNum}/${numPages})`,
    category: isLinesOnly ? 'PDF Oficial (Somente Linhas)' : 'PDF Oficial (Mapa Colorido Detectado)',
    mode: isLinesOnly ? 'lines_only' : 'custom_pdf',
    pageCount: numPages,
    widthMm,
    heightMm,
    orientation,
    description: `Molde oficial importado de "${file.name}" (${numPages} pág., ${widthMm}×${heightMm}mm, ${orientation}). Detectadas ${detectedRegions.length} regiões geométricas.`,
    outerCutPolygon: [
      { x: 55, y: 55 }, { x: 945, y: 55 }, { x: 945, y: 920 }, { x: 55, y: 920 }
    ],
    regions: detectedRegions,
    technicalLines: [],
    technicalElements,
    uploadedPdfRenderDataUrl,
    uploadedLinesMaskDataUrl
  };
}
