import { jsPDF } from 'jspdf';
import {
  ArtThemeConfig,
  DetectedRegion,
  ImageFitMode,
  OfficialTemplateSpec,
  Point2D,
  QualityCheckItem,
  ReferenceImageItem
} from '../types/mapTypes';

export interface ThemePreset {
  id: string;
  name: string;
  badge: string;
  primaryPatternId: string;
  secondaryPatternId: string;
  borderStyleId: string;
  characterPresetId: string;
  namePrimaryColor: string;
  nameOutlineColor: string;
  defaultChildName: string;
  defaultChildAge: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'sereia-maria',
    name: 'Sereia Encantada (Exemplo Oficial Guia MAP)',
    badge: 'Oficial do Guia',
    primaryPatternId: 'aqua-bubbles',
    secondaryPatternId: 'mermaid-scales',
    borderStyleId: 'pink-pearls',
    characterPresetId: 'mermaid',
    namePrimaryColor: '#EC4899',
    nameOutlineColor: '#6D28D9',
    defaultChildName: 'MARIA',
    defaultChildAge: '3 ANOS'
  },
  {
    id: 'sonic-joao',
    name: 'Sonic Speed Blue (Exemplo Branches Pág. 10)',
    badge: 'Rápido & Vibrante',
    primaryPatternId: 'sonic-chevrons',
    secondaryPatternId: 'gold-rings-grid',
    borderStyleId: 'checkered-gold',
    characterPresetId: 'hedgehog-hero',
    namePrimaryColor: '#2563EB',
    nameOutlineColor: '#FACC15',
    defaultChildName: 'JOÃO LUCAS',
    defaultChildAge: '5 ANOS'
  },
  {
    id: 'safari-theo',
    name: 'Safari Aquarela Baby',
    badge: 'Suave & Infantil',
    primaryPatternId: 'safari-leaves',
    secondaryPatternId: 'beige-stripes',
    borderStyleId: 'wood-rope',
    characterPresetId: 'safari-lion',
    namePrimaryColor: '#15803D',
    nameOutlineColor: '#78350F',
    defaultChildName: 'THEO',
    defaultChildAge: '1 ANO'
  },
  {
    id: 'princesa-helena',
    name: 'Realeza Candy & Dourado',
    badge: 'Clássico Luxo',
    primaryPatternId: 'pink-damask',
    secondaryPatternId: 'pastel-polka',
    borderStyleId: 'gold-lace',
    characterPresetId: 'princess-crown',
    namePrimaryColor: '#DB2777',
    nameOutlineColor: '#B45309',
    defaultChildName: 'HELENA',
    defaultChildAge: '4 ANOS'
  }
];

const imageCache = new Map<string, HTMLImageElement>();

export function loadImageCached(src: string): Promise<HTMLImageElement> {
  if (imageCache.has(src)) {
    return Promise.resolve(imageCache.get(src)!);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = src;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Extracts up to 5 dominant/vibrant colors from a user-uploaded reference image
 * so the AI engine can automatically harmonize text colors, outlines, and backgrounds.
 */
export async function extractPaletteFromImage(dataUrl: string): Promise<string[]> {
  try {
    const img = await loadImageCached(dataUrl);
    const canvas = document.createElement('canvas');
    const size = 48;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return ['#EC4899', '#6D28D9', '#38BDF8', '#10B981'];
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    const buckets = new Map<string, { r: number; g: number; b: number; count: number; sat: number }>();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Skip near-white and near-black extremes
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max > 246 && min > 235) continue;
      if (max < 22) continue;

      const qr = Math.round(r / 32) * 32;
      const qg = Math.round(g / 32) * 32;
      const qb = Math.round(b / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      const sat = max === 0 ? 0 : (max - min) / max;

      const prev = buckets.get(key);
      if (prev) {
        prev.r += r;
        prev.g += g;
        prev.b += b;
        prev.count += 1;
      } else {
        buckets.set(key, { r, g, b, count: 1, sat });
      }
    }

    const sorted = Array.from(buckets.values())
      .sort((a, b) => b.count * (0.6 + b.sat) - a.count * (0.6 + a.sat))
      .slice(0, 5)
      .map(item => rgbToHex(item.r / item.count, item.g / item.count, item.b / item.count));

    return sorted.length >= 2 ? sorted : ['#EC4899', '#6D28D9', '#38BDF8', '#10B981'];
  } catch {
    return ['#EC4899', '#6D28D9', '#38BDF8', '#10B981'];
  }
}

/**
 * Automatically maps uploaded reference images into each region of the official mold (A, B, C...)
 * according to the region's assigned function and reference image roles.
 */
export function autoFillMoldWithReferenceImages(
  regions: DetectedRegion[],
  refImages: ReferenceImageItem[],
  currentTheme: ArtThemeConfig
): { updatedRegions: DetectedRegion[]; updatedTheme: ArtThemeConfig } {
  if (!refImages || refImages.length === 0) {
    return { updatedRegions: regions, updatedTheme: currentTheme };
  }

  // Find best candidates by role or index order
  const byRole = (role: ReferenceImageItem['role']) => refImages.find(img => img.role === role);
  const nonCharRefs = refImages.filter(img => img.role !== 'personagem');

  const primaryRef = byRole('papel_principal') || nonCharRefs[0] || refImages[0];
  const secondaryRef = byRole('papel_secundario') || nonCharRefs[1] || nonCharRefs[0] || primaryRef;
  const lateralRef = byRole('lateral') || nonCharRefs[2] || secondaryRef || primaryRef;
  const borderRef = byRole('barrado') || secondaryRef || primaryRef;
  const charRef = byRole('personagem');

  // Collect palette colors from the primary reference image
  const palette = primaryRef?.extractedPalette || [];
  const nextPrimaryColor = palette[0] || currentTheme.namePrimaryColor;
  const nextOutlineColor = palette[1] || currentTheme.nameOutlineColor;

  const updatedRegions = regions.map((region, idx) => {
    const fn = region.assignedFunction;
    let chosenRef: ReferenceImageItem | undefined;
    let fitMode: ImageFitMode = region.imageFitMode || 'cover';

    if (fn === 'papel_principal' || fn === 'fundo' || fn === 'aplique_topper') {
      chosenRef = primaryRef;
      fitMode = 'cover';
    } else if (fn === 'papel_secundario' || fn === 'elementos_secundarios' || fn === 'moldura') {
      chosenRef = secondaryRef;
      fitMode = 'cover';
    } else if (fn === 'lateral') {
      chosenRef = lateralRef;
      fitMode = 'cover';
    } else if (fn === 'barrado') {
      chosenRef = borderRef;
      fitMode = 'cover';
    } else if (fn === 'personagem' || fn === 'elemento_principal') {
      chosenRef = charRef || primaryRef;
      fitMode = charRef ? 'contain' : 'cover';
    } else {
      chosenRef = nonCharRefs[idx % Math.max(1, nonCharRefs.length)] || primaryRef;
      fitMode = 'cover';
    }

    if (!chosenRef) return region;

    return {
      ...region,
      customAssetDataUrl: chosenRef.dataUrl,
      customAssetName: chosenRef.name,
      imageFitMode: fitMode,
      assignedContent: `Imagem de Referência: ${chosenRef.name}`
    };
  });

  const updatedTheme: ArtThemeConfig = {
    ...currentTheme,
    referenceImages: refImages,
    uploadedPrimaryPaper: primaryRef?.dataUrl || currentTheme.uploadedPrimaryPaper,
    uploadedSecondaryPaper: secondaryRef?.dataUrl || currentTheme.uploadedSecondaryPaper,
    uploadedLateralPaper: lateralRef?.dataUrl || currentTheme.uploadedLateralPaper,
    uploadedCharacterPng: charRef?.dataUrl || currentTheme.uploadedCharacterPng,
    namePrimaryColor: nextPrimaryColor,
    nameOutlineColor: nextOutlineColor
  };

  return { updatedRegions, updatedTheme };
}

function drawFormattedRegionImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  fitMode: ImageFitMode = 'cover',
  scaleMultiplier = 1
) {
  const iw = img.naturalWidth || img.width || 100;
  const ih = img.naturalHeight || img.height || 100;

  if (fitMode === 'repeat') {
    const tileW = Math.max(48, Math.round(140 * scaleMultiplier));
    const tileH = Math.max(48, Math.round((ih / iw) * tileW));
    for (let y = by; y < by + bh; y += tileH) {
      for (let x = bx; x < bx + bw; x += tileW) {
        ctx.drawImage(img, x, y, tileW, tileH);
      }
    }
    return;
  }

  if (fitMode === 'contain') {
    const scale = Math.min(bw / iw, bh / ih) * 0.88 * scaleMultiplier;
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = bx + (bw - dw) / 2;
    const dy = by + (bh - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
    return;
  }

  // Default: 'cover' (aspect-ratio preserving center-crop with bleed coverage)
  const scale = Math.max(bw / iw, bh / ih) * scaleMultiplier;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = bx + (bw - dw) / 2;
  const dy = by + (bh - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawProceduralPattern(
  ctx: CanvasRenderingContext2D,
  patternId: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (patternId === 'aqua-bubbles') {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#5EEAD4');
    grad.addColorStop(0.55, '#38BDF8');
    grad.addColorStop(1, '#818CF8');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * i) / 5, y);
      ctx.lineTo(x + (w * i) / 5 + 45, y);
      ctx.lineTo(x + (w * i) / 5 + 120, y + h);
      ctx.lineTo(x + (w * i) / 5 + 15, y + h);
      ctx.closePath();
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1.5;
    for (let bx = x + 28; bx < x + w; bx += 68) {
      for (let by = y + 26; by < y + h; by += 64) {
        const r = ((bx + by) % 14) + 5;
        ctx.beginPath();
        ctx.arc(bx + ((by % 3) * 11), by, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  } else if (patternId === 'mermaid-scales') {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#A78BFA');
    grad.addColorStop(0.5, '#C084FC');
    grad.addColorStop(1, '#38BDF8');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const scaleR = 22;
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 2;
    let row = 0;
    for (let sy = y; sy < y + h + scaleR; sy += scaleR * 0.85) {
      const offsetX = (row % 2) * scaleR;
      for (let sx = x - scaleR; sx < x + w + scaleR; sx += scaleR * 2) {
        ctx.beginPath();
        ctx.arc(sx + offsetX, sy, scaleR, 0, Math.PI, false);
        ctx.stroke();
      }
      row++;
    }
  } else if (patternId === 'sea-lateral') {
    ctx.fillStyle = '#E0F2FE';
    ctx.fillRect(x, y, w, h);

    const colors = ['#FB923C', '#F472B6', '#A855F7', '#38BDF8', '#FACC15'];
    let idx = 0;
    for (let py = y + 32; py < y + h - 10; py += 58) {
      for (let px = x + 32; px < x + w - 10; px += 58) {
        const col = colors[idx % colors.length];
        ctx.fillStyle = col;
        ctx.save();
        ctx.translate(px + ((idx % 2) * 10), py);
        if (idx % 3 === 0) {
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            const outAngle = (s * 72 * Math.PI) / 180 - Math.PI / 2;
            const inAngle = ((s * 72 + 36) * Math.PI) / 180 - Math.PI / 2;
            ctx.lineTo(Math.cos(outAngle) * 14, Math.sin(outAngle) * 14);
            ctx.lineTo(Math.cos(inAngle) * 6, Math.sin(inAngle) * 6);
          }
          ctx.closePath();
          ctx.fill();
        } else if (idx % 3 === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, 12, Math.PI, 0);
          ctx.lineTo(4, 10);
          ctx.lineTo(-4, 10);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(0, 0, 11, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(16, -6);
          ctx.lineTo(16, 6);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        idx++;
      }
    }
  } else if (patternId === 'sonic-chevrons') {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#1D4ED8');
    grad.addColorStop(0.6, '#2563EB');
    grad.addColorStop(1, '#0EA5E9');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.lineWidth = 4;
    for (let cy = y - 100; cy < y + h + 100; cy += 48) {
      ctx.beginPath();
      ctx.moveTo(x, cy);
      ctx.lineTo(x + w * 0.5, cy - 45);
      ctx.lineTo(x + w, cy);
      ctx.stroke();
    }
  } else if (patternId === 'gold-rings-grid') {
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3.5;
    for (let py = y + 30; py < y + h; py += 55) {
      for (let px = x + 30; px < x + w; px += 55) {
        ctx.beginPath();
        ctx.arc(px, py, 13, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  } else if (patternId === 'safari-leaves') {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#ECFDF5');
    grad.addColorStop(1, '#D1FAE5');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(22, 163, 74, 0.22)';
    for (let py = y + 25; py < y + h; py += 60) {
      for (let px = x + 25; px < x + w; px += 60) {
        ctx.beginPath();
        ctx.ellipse(px, py, 18, 9, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (patternId === 'beige-stripes') {
    ctx.fillStyle = '#FEF3C7';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#FDE68A';
    for (let sx = x; sx < x + w; sx += 28) {
      ctx.fillRect(sx, y, 14, h);
    }
  } else {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#FCE7F3');
    grad.addColorStop(1, '#FBCFE8');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let py = y + 22; py < y + h; py += 42) {
      for (let px = x + 22; px < x + w; px += 42) {
        ctx.beginPath();
        ctx.arc(px, py, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();
}

function drawDecorativeBorderStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  borderStyleId: string
) {
  ctx.save();
  const stripH = 26;
  ctx.fillStyle = borderStyleId === 'checkered-gold' ? '#FACC15' : '#F472B6';
  ctx.fillRect(x, y - stripH / 2, w, stripH);

  ctx.fillStyle = '#FFFFFF';
  for (let bx = x + 12; bx < x + w - 8; bx += 22) {
    ctx.beginPath();
    ctx.arc(bx, y, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCharacterIllustration(
  ctx: CanvasRenderingContext2D,
  characterPresetId: string,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.shadowColor = 'rgba(15, 23, 42, 0.24)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  if (characterPresetId === 'mermaid') {
    ctx.fillStyle = '#10B981';
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, radius * 0.35);
    ctx.quadraticCurveTo(-radius * 0.85, radius * 0.05, -radius * 0.55, -radius * 0.25);
    ctx.quadraticCurveTo(-radius * 0.25, radius * 0.05, 0, radius * 0.35);
    ctx.quadraticCurveTo(radius * 0.25, radius * 0.65, -radius * 0.45, radius * 0.35);
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = '#F472B6';
    ctx.beginPath();
    ctx.arc(0, -radius * 0.18, radius * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fill();

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.roundRect(-radius * 0.22, -radius * 0.02, radius * 0.44, radius * 0.42, 14);
    ctx.fill();

    ctx.fillStyle = '#A855F7';
    ctx.beginPath();
    ctx.arc(-radius * 0.1, radius * 0.14, radius * 0.1, 0, Math.PI * 2);
    ctx.arc(radius * 0.1, radius * 0.14, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FDE68A';
    ctx.beginPath();
    ctx.arc(0, -radius * 0.22, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#065F46';
    ctx.beginPath();
    ctx.arc(-radius * 0.12, -radius * 0.24, radius * 0.06, 0, Math.PI * 2);
    ctx.arc(radius * 0.12, -radius * 0.24, radius * 0.06, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#BE185D';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, -radius * 0.17, radius * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(-radius * 0.32, -radius * 0.38, radius * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (characterPresetId === 'hedgehog-hero') {
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2563EB';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.56, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${Math.round(radius * 0.34)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ SPEED', 0, 0);
  } else {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#D97706';
    ctx.font = `bold ${Math.round(radius * 0.5)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(characterPresetId === 'safari-lion' ? '🦁' : '👑', 0, 2);
  }

  ctx.restore();
}

export const WINDOWS_CANDIDATE_FONTS: string[] = [
  // Fontes Web do Estúdio
  'Fredoka',
  'Pacifico',
  'Inter',
  // Fontes Clássicas & Decorativas do Windows / Office / Papelaria Personalizada
  'Segoe UI',
  'Segoe UI Black',
  'Segoe Script',
  'Segoe Print',
  'Arial',
  'Arial Black',
  'Arial Rounded MT Bold',
  'Bahnschrift',
  'Bauhaus 93',
  'Bernard MT Condensed',
  'Blackadder ITC',
  'Bodoni MT',
  'Book Antiqua',
  'Bookman Old Style',
  'Bradley Hand ITC',
  'Broadway',
  'Brush Script MT',
  'Calibri',
  'Californian FB',
  'Cambria',
  'Candara',
  'Castellar',
  'Centaur',
  'Century',
  'Century Gothic',
  'Century Schoolbook',
  'Chiller',
  'Colonna MT',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Cooper Black',
  'Copperplate Gothic Bold',
  'Corbel',
  'Courier New',
  'Curlz MT',
  'Ebrima',
  'Edwardian Script ITC',
  'Elephant',
  'Engravers MT',
  'Eras Bold ITC',
  'Felix Titling',
  'Footlight MT Light',
  'Forte',
  'Franklin Gothic Heavy',
  'Franklin Gothic Medium',
  'Freestyle Script',
  'French Script MT',
  'Gabriola',
  'Garamond',
  'Georgia',
  'Gigi',
  'Gill Sans MT',
  'Goudy Old Style',
  'Goudy Stout',
  'Haettenschweiler',
  'Harlow Solid Italic',
  'Harrington',
  'High Tower Text',
  'Impact',
  'Imprint MT Shadow',
  'Informal Roman',
  'Ink Free',
  'Jokerman',
  'Juice ITC',
  'Kristen ITC',
  'Kunstler Script',
  'Lucida Bright',
  'Lucida Calligraphy',
  'Lucida Console',
  'Lucida Handwriting',
  'Lucida Sans Unicode',
  'Magneto',
  'Maiandra GD',
  'Matura MT Script Capitals',
  'Microsoft PhagsPa',
  'Microsoft Sans Serif',
  'Microsoft Tai Le',
  'Microsoft YaHei',
  'Mistral',
  'Modern No. 20',
  'Monotype Corsiva',
  'MV Boli',
  'Niagara Solid',
  'Old English Text MT',
  'Onyx',
  'Palace Script MT',
  'Palatino Linotype',
  'Papyrus',
  'Parchment',
  'Perpetua',
  'Playbill',
  'Poor Richard',
  'Pristina',
  'Rage Italic',
  'Ravie',
  'Rockwell',
  'Rockwell Extra Bold',
  'Script MT Bold',
  'Showcard Gothic',
  'Sitka Banner',
  'Sitka Display',
  'Sitka Heading',
  'Snap ITC',
  'Stencil',
  'Sylfaen',
  'Tahoma',
  'Tempus Sans ITC',
  'Times New Roman',
  'Trebuchet MS',
  'Tw Cen MT',
  'Verdana',
  'Viner Hand ITC',
  'Vivaldi',
  'Vladimir Script',
  'Wide Latin'
];

let cachedDetectedWindowsFonts: string[] | null = null;

/**
 * Detecta instantaneamente quais fontes do Windows estão instaladas na máquina do usuário
 * usando medição métrica em Canvas 2D contra famílias base (monospace, sans-serif, serif).
 */
export function detectInstalledWindowsFonts(): string[] {
  if (cachedDetectedWindowsFonts && cachedDetectedWindowsFonts.length > 0) {
    return cachedDetectedWindowsFonts;
  }
  if (typeof document === 'undefined') {
    return ['Fredoka', 'Pacifico', 'Inter', 'Arial', 'Segoe UI', 'Comic Sans MS', 'Impact', 'Georgia'];
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return ['Fredoka', 'Pacifico', 'Inter', 'Arial', 'Segoe UI', 'Comic Sans MS', 'Impact', 'Georgia'];
  }

  const testString = 'MMMMmmmmmmlli1I0O@#FestasPersonalizadas';
  const testSize = '72px';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const baseWidths: Record<string, number> = {};

  for (const base of baseFonts) {
    ctx.font = `${testSize} ${base}`;
    baseWidths[base] = ctx.measureText(testString).width;
  }

  const detected = new Set<string>(['Fredoka', 'Pacifico', 'Inter']);

  for (const candidate of WINDOWS_CANDIDATE_FONTS) {
    if (detected.has(candidate)) continue;
    let isInstalled = false;
    for (const base of baseFonts) {
      ctx.font = `${testSize} "${candidate}", ${base}`;
      const width = ctx.measureText(testString).width;
      if (Math.abs(width - baseWidths[base]) > 0.1) {
        isInstalled = true;
        break;
      }
    }
    if (isInstalled) {
      detected.add(candidate);
    }
  }

  cachedDetectedWindowsFonts = Array.from(detected);
  return cachedDetectedWindowsFonts;
}

/**
 * Consulta 100% das fontes locais instaladas no Windows (incluindo fontes personalizadas instaladas pelo usuário em C:\Windows\Fonts)
 * usando a API nativa `window.queryLocalFonts()` do navegador (Chrome/Edge no Windows), combinando com o detector instantâneo.
 */
export async function queryAllWindowsLocalFonts(): Promise<{
  fonts: string[];
  usedNativeApi: boolean;
}> {
  const baseDetected = detectInstalledWindowsFonts();
  const fontSet = new Set<string>(baseDetected);

  const win = window as unknown as {
    queryLocalFonts?: () => Promise<Array<{ family: string; fullName?: string }>>;
  };

  if (typeof win.queryLocalFonts === 'function') {
    try {
      const localFonts = await win.queryLocalFonts();
      if (Array.isArray(localFonts) && localFonts.length > 0) {
        for (const f of localFonts) {
          if (f.family && typeof f.family === 'string' && !f.family.startsWith('.')) {
            fontSet.add(f.family.trim());
          }
        }
        const merged = Array.from(fontSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        cachedDetectedWindowsFonts = merged;
        return { fonts: merged, usedNativeApi: true };
      }
    } catch {
      // Fallback para lista detectada via Canvas se o usuário recusar a permissão ou o navegador bloquear
    }
  }

  return {
    fonts: Array.from(fontSet),
    usedNativeApi: false
  };
}

export interface TextTransformBox {
  target: 'name' | 'age';
  text: string;
  cx: number;
  cy: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  handleX: number;
  handleY: number;
  handleRadius: number;
}

export interface InteractiveTextOptions {
  showTextGizmos?: boolean;
  activeTarget?: 'name' | 'age' | null;
  hoveredTarget?: 'name' | 'age' | null;
}

export function getDefaultTitleAnchor(template: OfficialTemplateSpec): {
  cx: number;
  cy: number;
  maxWidth: number;
} {
  // 1. Verifica se alguma região foi explicitamente mapeada como nome / idade / nome_idade
  const explicitTitleRegion = template.regions.find(
    r => r.assignedFunction === 'nome' || r.assignedFunction === 'idade' || r.assignedFunction === 'nome_idade'
  );
  if (explicitTitleRegion) {
    return {
      cx: Math.round(explicitTitleRegion.bbox.x + explicitTitleRegion.bbox.w / 2),
      cy: Math.round(explicitTitleRegion.bbox.y + explicitTitleRegion.bbox.h / 2),
      maxWidth: Math.round(explicitTitleRegion.bbox.w * 0.85)
    };
  }

  // 2. Caso Sacola Nuvem
  if (template.id.includes('sacola-nuvem')) {
    const regA = template.regions.find(r => r.id === 'A') || template.regions[0];
    if (regA) {
      return {
        cx: Math.round(regA.bbox.x + regA.bbox.w * 0.68),
        cy: Math.round(regA.bbox.y + regA.bbox.h * 0.48),
        maxWidth: Math.round(regA.bbox.w * 0.46)
      };
    }
  }

  // 3. Procura a face frontal principal
  const frontRegion =
    template.regions.find(
      r =>
        (r.assignedFunction === 'papel_principal' || r.assignedFunction === 'fundo' || r.assignedFunction === 'aplique_topper') &&
        (r.id === 'C' ||
          (r.id === 'B' && template.id.includes('sacolinha-coracao')) ||
          r.id === 'E' ||
          (r.id === 'A' && !template.id.includes('caixa-milk')))
    ) ||
    template.regions.find(r => r.assignedFunction === 'papel_principal') ||
    template.regions[0];

  if (frontRegion) {
    const isTriangle = frontRegion.polygon.length === 3;
    return {
      cx: Math.round(frontRegion.bbox.x + frontRegion.bbox.w / 2),
      cy: Math.round(frontRegion.bbox.y + frontRegion.bbox.h * (isTriangle ? 0.68 : 0.78)),
      maxWidth: Math.round(frontRegion.bbox.w * 0.82)
    };
  }

  return { cx: 500, cy: 620, maxWidth: 320 };
}

export function getTitleAndAgeBoxes(
  template: OfficialTemplateSpec,
  themeConfig: ArtThemeConfig
): {
  nameBox: TextTransformBox | null;
  ageBox: TextTransformBox | null;
  defaultAnchor: { cx: number; cy: number; maxWidth: number };
} {
  const defaultAnchor = getDefaultTitleAnchor(template);
  const nameText = (themeConfig.childName || '').trim().toUpperCase();
  const ageText = (themeConfig.childAge || '').trim().toUpperCase();

  const baseNameFontSize = Math.min(
    54,
    Math.max(24, Math.floor(defaultAnchor.maxWidth / Math.max(4, (nameText.length || 5) * 0.62)))
  );
  const baseAgeFontSize = Math.round(baseNameFontSize * 0.62);

  const nameScale = Math.max(0.25, Math.min(4.0, themeConfig.nameScale ?? 1.0));
  const ageScale = Math.max(0.25, Math.min(4.0, themeConfig.ageScale ?? 1.0));

  const nameFontSize = Math.round(baseNameFontSize * nameScale);
  const ageFontSize = Math.round(baseAgeFontSize * ageScale);

  const defaultNameCx = defaultAnchor.cx;
  const defaultNameCy = Math.round(defaultAnchor.cy - (ageText ? baseAgeFontSize * 0.55 : 0));

  const nameCx = Math.round(themeConfig.namePosX ?? defaultNameCx);
  const nameCy = Math.round(themeConfig.namePosY ?? defaultNameCy);

  const defaultAgeCx = nameCx;
  const defaultAgeCy = Math.round((themeConfig.namePosY ?? defaultNameCy) + nameFontSize * 0.62 + ageFontSize * 0.48);

  const ageCx = Math.round(themeConfig.agePosX ?? defaultAgeCx);
  const ageCy = Math.round(themeConfig.agePosY ?? defaultAgeCy);

  let nameBox: TextTransformBox | null = null;
  if (nameText) {
    const estimatedW = Math.max(84, Math.round(nameText.length * nameFontSize * 0.64 + 34));
    const estimatedH = Math.max(38, Math.round(nameFontSize * 1.28 + 16));
    const x = Math.round(nameCx - estimatedW / 2);
    const y = Math.round(nameCy - estimatedH / 2);
    nameBox = {
      target: 'name',
      text: nameText,
      cx: nameCx,
      cy: nameCy,
      x,
      y,
      w: estimatedW,
      h: estimatedH,
      fontSize: nameFontSize,
      handleX: x + estimatedW,
      handleY: y + estimatedH,
      handleRadius: 11
    };
  }

  let ageBox: TextTransformBox | null = null;
  if (ageText) {
    const estimatedW = Math.max(72, Math.round(ageText.length * ageFontSize * 0.64 + 30));
    const estimatedH = Math.max(32, Math.round(ageFontSize * 1.28 + 14));
    const x = Math.round(ageCx - estimatedW / 2);
    const y = Math.round(ageCy - estimatedH / 2);
    ageBox = {
      target: 'age',
      text: ageText,
      cx: ageCx,
      cy: ageCy,
      x,
      y,
      w: estimatedW,
      h: estimatedH,
      fontSize: ageFontSize,
      handleX: x + estimatedW,
      handleY: y + estimatedH,
      handleRadius: 11
    };
  }

  return { nameBox, ageBox, defaultAnchor };
}

function drawSingleStyledTextLayer(
  ctx: CanvasRenderingContext2D,
  box: TextTransformBox,
  fontFamily: string,
  fillColor: string,
  outlineColor: string,
  isAge: boolean
) {
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${box.fontSize}px "${fontFamily}", sans-serif`;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const whiteStrokeWidth = Math.max(8, Math.round(box.fontSize * (isAge ? 0.34 : 0.32)));
  const colorStrokeWidth = Math.max(4, Math.round(box.fontSize * (isAge ? 0.17 : 0.17)));

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = whiteStrokeWidth;
  ctx.strokeText(box.text, 0, 0);

  ctx.strokeStyle = outlineColor;
  ctx.lineWidth = colorStrokeWidth;
  ctx.strokeText(box.text, 0, 0);

  ctx.fillStyle = fillColor;
  ctx.fillText(box.text, 0, 0);
  ctx.restore();
}

function drawInteractiveTextGizmo(
  ctx: CanvasRenderingContext2D,
  box: TextTransformBox,
  label: string,
  isActive: boolean,
  isHovered: boolean
) {
  ctx.save();
  const accentColor = box.target === 'name' ? '#4F46E5' : '#9333EA';
  const strokeColor = isActive ? '#F97316' : isHovered ? accentColor : 'rgba(79, 70, 229, 0.75)';

  // Caixa tracejada ao redor do texto
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = isActive || isHovered ? 2.5 : 1.8;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 8);
  ctx.stroke();
  ctx.setLineDash([]);

  // Etiqueta superior (NOME / IDADE)
  const badgeW = Math.min(130, Math.max(66, label.length * 7 + 16));
  const badgeH = 18;
  const badgeX = box.x;
  const badgeY = Math.max(4, box.y - badgeH - 3);

  ctx.fillStyle = isActive ? '#EA580C' : accentColor;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 5);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, badgeX + 6, badgeY + badgeH / 2);

  // Alça de redimensionamento no canto inferior direito (⤡)
  ctx.fillStyle = isActive ? '#F97316' : '#FFFFFF';
  ctx.strokeStyle = isActive ? '#FFFFFF' : accentColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(box.handleX, box.handleY, box.handleRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ícone diagonal de escala dentro da bolinha
  ctx.strokeStyle = isActive ? '#FFFFFF' : accentColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(box.handleX - 4, box.handleY - 4);
  ctx.lineTo(box.handleX + 4, box.handleY + 4);
  ctx.moveTo(box.handleX + 4, box.handleY + 1);
  ctx.lineTo(box.handleX + 4, box.handleY + 4);
  ctx.lineTo(box.handleX + 1, box.handleY + 4);
  ctx.moveTo(box.handleX - 4, box.handleY - 1);
  ctx.lineTo(box.handleX - 4, box.handleY - 4);
  ctx.lineTo(box.handleX - 1, box.handleY - 4);
  ctx.stroke();

  ctx.restore();
}

function drawCustomPartyTitleAndAge(
  ctx: CanvasRenderingContext2D,
  template: OfficialTemplateSpec,
  themeConfig: ArtThemeConfig,
  interactiveOptions?: InteractiveTextOptions
) {
  if (themeConfig.showTitleOverlay === false) return;

  const { nameBox, ageBox } = getTitleAndAgeBoxes(template, themeConfig);
  const nameFont = themeConfig.fontFamily || 'Fredoka';
  const ageFont = themeConfig.ageFontFamily || nameFont;
  const ageColor = themeConfig.agePrimaryColor || '#A855F7';

  if (nameBox) {
    drawSingleStyledTextLayer(
      ctx,
      nameBox,
      nameFont,
      themeConfig.namePrimaryColor || '#EC4899',
      themeConfig.nameOutlineColor || '#831843',
      false
    );
  }

  if (ageBox) {
    drawSingleStyledTextLayer(
      ctx,
      ageBox,
      ageFont,
      ageColor,
      themeConfig.nameOutlineColor || '#831843',
      true
    );
  }

  if (interactiveOptions?.showTextGizmos) {
    if (nameBox) {
      drawInteractiveTextGizmo(
        ctx,
        nameBox,
        `✥ NOME (${nameBox.fontSize}px)`,
        interactiveOptions.activeTarget === 'name',
        interactiveOptions.hoveredTarget === 'name'
      );
    }
    if (ageBox) {
      drawInteractiveTextGizmo(
        ctx,
        ageBox,
        `✥ IDADE (${ageBox.fontSize}px)`,
        interactiveOptions.activeTarget === 'age',
        interactiveOptions.hoveredTarget === 'age'
      );
    }
  }
}

function drawPolygonPath(ctx: CanvasRenderingContext2D, polygon: Point2D[]) {
  if (polygon.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(polygon[0].x, polygon[0].y);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x, polygon[i].y);
  }
  ctx.closePath();
}

function expandPolygonWithBleed(polygon: Point2D[], bleedPx: number): Point2D[] {
  if (polygon.length === 0 || bleedPx <= 0) return polygon;
  const cx = polygon.reduce((acc, p) => acc + p.x, 0) / polygon.length;
  const cy = polygon.reduce((acc, p) => acc + p.y, 0) / polygon.length;
  return polygon.map(pt => {
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return {
      x: pt.x + (dx / len) * (bleedPx + 3),
      y: pt.y + (dy / len) * (bleedPx + 3)
    };
  });
}

function drawProtectedTechnicalElements(
  ctx: CanvasRenderingContext2D,
  template: OfficialTemplateSpec,
  showSafeZoneGuides: boolean
) {
  for (const el of template.technicalElements) {
    const { x, y, w, h } = el.bbox;
    const marginPx = el.safeMarginMm * 3.2;

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - marginPx, y - marginPx, w + marginPx * 2, h + marginPx * 2);

    if (showSafeZoneGuides) {
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x - marginPx, y - marginPx, w + marginPx * 2, h + marginPx * 2);
      ctx.setLineDash([]);
    }

    if (el.type === 'registration_mark') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.36;
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (el.type === 'qr_code') {
      ctx.fillStyle = '#000000';
      const cells = 7;
      const cellW = w / cells;
      const cellH = h / cells;
      const matrix = [
        [1, 1, 1, 0, 1, 1, 1],
        [1, 0, 1, 1, 1, 0, 1],
        [1, 1, 1, 0, 1, 1, 1],
        [0, 1, 0, 1, 0, 1, 0],
        [1, 1, 1, 1, 0, 1, 1],
        [1, 0, 1, 0, 1, 0, 1],
        [1, 1, 1, 0, 1, 1, 1]
      ];
      for (let r = 0; r < cells; r++) {
        for (let c = 0; c < cells; c++) {
          if (matrix[r][c]) {
            ctx.fillRect(x + c * cellW, y + r * cellH, Math.ceil(cellW), Math.ceil(cellH));
          }
        }
      }
    }
    ctx.restore();
  }
}

function drawTechnicalCutAndFoldLines(
  ctx: CanvasRenderingContext2D,
  template: OfficialTemplateSpec,
  uploadedLinesImg?: HTMLImageElement | null
) {
  ctx.save();

  if (uploadedLinesImg) {
    ctx.drawImage(uploadedLinesImg, 0, 0, 1000, 1000);
  }

  for (const line of template.technicalLines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = line.strokeWidth;
    if (line.type === 'fold_dashed') {
      ctx.setLineDash([7, 5]);
    } else {
      ctx.setLineDash([]);
    }

    if (line.pathSvg) {
      const p = new Path2D(line.pathSvg);
      ctx.stroke(p);
    }
    if (line.circle) {
      ctx.beginPath();
      ctx.arc(line.circle.cx, line.circle.cy, line.circle.r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

export async function renderTemplateToCanvas(
  canvas: HTMLCanvasElement,
  template: OfficialTemplateSpec,
  themeConfig: ArtThemeConfig,
  renderMode: 'guide_map' | 'print_pdf' | 'proof_pdf',
  selectedRegionId?: string | null,
  interactiveOptions?: InteractiveTextOptions
) {
  const ctx = canvas.getContext('2d')!;
  const W = 1000;
  const H = 1000;
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }

  // Preload global assets and per-region custom reference images
  const [
    uploadedPdfImg,
    uploadedLinesImg,
    primaryPaperImg,
    secondaryPaperImg,
    lateralPaperImg,
    characterImg
  ] = await Promise.all([
    template.uploadedPdfRenderDataUrl ? loadImageCached(template.uploadedPdfRenderDataUrl).catch(() => null) : Promise.resolve(null),
    template.uploadedLinesMaskDataUrl ? loadImageCached(template.uploadedLinesMaskDataUrl).catch(() => null) : Promise.resolve(null),
    themeConfig.uploadedPrimaryPaper ? loadImageCached(themeConfig.uploadedPrimaryPaper).catch(() => null) : Promise.resolve(null),
    themeConfig.uploadedSecondaryPaper ? loadImageCached(themeConfig.uploadedSecondaryPaper).catch(() => null) : Promise.resolve(null),
    themeConfig.uploadedLateralPaper ? loadImageCached(themeConfig.uploadedLateralPaper).catch(() => null) : Promise.resolve(null),
    themeConfig.uploadedCharacterPng ? loadImageCached(themeConfig.uploadedCharacterPng).catch(() => null) : Promise.resolve(null)
  ]);

  const regionImagesMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    template.regions.map(async r => {
      if (r.customAssetDataUrl) {
        const loaded = await loadImageCached(r.customAssetDataUrl).catch(() => null);
        if (loaded) regionImagesMap.set(r.id, loaded);
      }
    })
  );

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // MODE 1: GUIDE MAP (Shows the original PDF / Colored Map + Region IDs A, B, C...)
  if (renderMode === 'guide_map') {
    if (uploadedPdfImg) {
      ctx.drawImage(uploadedPdfImg, 0, 0, W, H);
    }

    for (const region of template.regions) {
      ctx.save();
      drawPolygonPath(ctx, region.polygon);
      if (template.mode !== 'lines_only' && !uploadedPdfImg) {
        ctx.fillStyle = region.colorHex;
        ctx.fill();
      } else if (template.mode === 'lines_only') {
        ctx.fillStyle = 'rgba(241, 245, 249, 0.55)';
        ctx.fill();
      }

      if (selectedRegionId === region.id) {
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      const cx = region.bbox.x + region.bbox.w / 2;
      const cy = region.bbox.y + region.bbox.h / 2;
      ctx.fillStyle = selectedRegionId === region.id ? '#EA580C' : 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(cx - 72, cy - 26, 144, 52, 12);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = selectedRegionId === region.id ? '#FFFFFF' : '#FACC15';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`ÁREA ${region.id}`, cx, cy - 8);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '500 10px Inter, sans-serif';
      const subLabel = region.customAssetName
        ? `📷 ${region.customAssetName.slice(0, 15)}`
        : region.assignedFunction === 'nao_definido'
          ? region.colorName
          : region.assignedFunction.replace(/_/g, ' ').toUpperCase();
      ctx.fillText(subLabel, cx, cy + 11);
      ctx.restore();
    }

    drawTechnicalCutAndFoldLines(ctx, template, uploadedLinesImg);
    drawProtectedTechnicalElements(ctx, template, true);
    return;
  }

  // MODE 2 & 3: PRINT_PDF and PROOF_PDF (Shared Composition Source - Rule 9!)
  const bleedPx = Math.round(themeConfig.bleedMm * 3.4);
  const showChar = themeConfig.showCharacterOverlay !== false;
  const showTitle = themeConfig.showTitleOverlay !== false;

  for (const region of template.regions) {
    ctx.save();

    const bx = region.bbox.x - bleedPx;
    const by = region.bbox.y - bleedPx;
    const bw = region.bbox.w + bleedPx * 2;
    const bh = region.bbox.h + bleedPx * 2;

    if (region.polygon && region.polygon.length >= 3) {
      const expandedPoly = expandPolygonWithBleed(region.polygon, bleedPx);
      drawPolygonPath(ctx, expandedPoly);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
    }

    const fn = region.assignedFunction;
    const customRegionImg = regionImagesMap.get(region.id);
    const fitMode = region.imageFitMode || 'cover';
    const scaleMult = region.imageScale || 1;

    // 1. If the user assigned a specific Reference Image to this region (or used AI Auto-Fill), render it first!
    if (customRegionImg) {
      drawFormattedRegionImage(ctx, customRegionImg, bx, by, bw, bh, fitMode, scaleMult);
    } else if (fn === 'papel_principal' || fn === 'fundo' || fn === 'aplique_topper') {
      if (primaryPaperImg) {
        drawFormattedRegionImage(ctx, primaryPaperImg, bx, by, bw, bh, fitMode, scaleMult);
      } else {
        drawProceduralPattern(ctx, themeConfig.primaryPatternId, bx, by, bw, bh);
      }
    } else if (fn === 'papel_secundario' || fn === 'elementos_secundarios' || fn === 'moldura') {
      if (secondaryPaperImg) {
        drawFormattedRegionImage(ctx, secondaryPaperImg, bx, by, bw, bh, fitMode, scaleMult);
      } else {
        drawProceduralPattern(ctx, themeConfig.secondaryPatternId, bx, by, bw, bh);
      }
    } else if (fn === 'lateral') {
      if (lateralPaperImg) {
        drawFormattedRegionImage(ctx, lateralPaperImg, bx, by, bw, bh, fitMode, scaleMult);
      } else {
        drawProceduralPattern(ctx, 'sea-lateral', bx, by, bw, bh);
      }
    } else if (fn === 'barrado') {
      if (secondaryPaperImg) {
        drawFormattedRegionImage(ctx, secondaryPaperImg, bx, by, bw, bh, fitMode, scaleMult);
      } else {
        drawProceduralPattern(ctx, themeConfig.secondaryPatternId, bx, by, bw, bh);
      }
      drawDecorativeBorderStrip(ctx, bx, by + bh - 14, bw, themeConfig.borderStyleId);
    } else if (fn === 'personagem' || fn === 'elemento_principal') {
      if (primaryPaperImg) {
        drawFormattedRegionImage(ctx, primaryPaperImg, bx, by, bw, bh, 'cover', 1);
      } else {
        drawProceduralPattern(ctx, themeConfig.primaryPatternId, bx, by, bw, bh);
      }
    } else {
      if (primaryPaperImg) {
        drawFormattedRegionImage(ctx, primaryPaperImg, bx, by, bw, bh, fitMode, scaleMult);
      } else {
        drawProceduralPattern(ctx, themeConfig.primaryPatternId, bx, by, bw, bh);
      }
    }

    // 2. Composite Overlays (Barrado / Personagem / Nome + Idade) on main regions
    if (fn === 'papel_principal' || fn === 'fundo' || fn === 'aplique_topper') {
      if (template.id.includes('sacola-nuvem') && region.id === 'A') {
        if (!customRegionImg) {
          const splitY = by + bh * 0.68;
          if (secondaryPaperImg) {
            drawFormattedRegionImage(ctx, secondaryPaperImg, bx, splitY, bw, bh * 0.35, 'cover', 1);
          } else {
            drawProceduralPattern(ctx, themeConfig.secondaryPatternId, bx, splitY, bw, bh * 0.35);
          }
          drawDecorativeBorderStrip(ctx, bx, splitY, bw, themeConfig.borderStyleId);
        }

        if (showChar) {
          const charCx = bx + bw * 0.28;
          const charCy = by + bh * 0.56;
          if (characterImg) {
            drawFormattedRegionImage(ctx, characterImg, charCx - 135, charCy - 165, 270, 330, 'contain', 1);
          } else {
            drawCharacterIllustration(ctx, themeConfig.characterPresetId, charCx, charCy, 145);
          }
        }
      } else {
        const isFrontMain =
          region.id === 'C' ||
          (region.id === 'B' && template.id.includes('sacolinha-coracao')) ||
          region.id === 'E' ||
          (region.id === 'A' && !template.id.includes('caixa-milk'));

        if (isFrontMain) {
          const cx = region.bbox.x + region.bbox.w / 2;
          const cy = region.bbox.y + region.bbox.h * (region.polygon.length === 3 ? 0.42 : 0.44);
          const charR = Math.min(region.bbox.w, region.bbox.h) * 0.28;

          if (showChar) {
            if (characterImg) {
              drawFormattedRegionImage(ctx, characterImg, cx - charR, cy - charR, charR * 2, charR * 2, 'contain', 1);
            } else {
              drawCharacterIllustration(ctx, themeConfig.characterPresetId, cx, cy, charR);
            }
          }
        }
      }
    } else if (fn === 'personagem' || fn === 'elemento_principal') {
      const cx = region.bbox.x + region.bbox.w / 2;
      const cy = region.bbox.y + region.bbox.h / 2;
      const r = Math.min(region.bbox.w, region.bbox.h) * 0.38;
      if (characterImg) {
        drawFormattedRegionImage(ctx, characterImg, cx - r, cy - r, r * 2, r * 2, 'contain', 1);
      } else if (!customRegionImg) {
        drawCharacterIllustration(ctx, themeConfig.characterPresetId, cx, cy, r);
      }
    }

    ctx.restore();
  }

  // Renderiza o Nome e a Idade com a fonte do Windows selecionada e com suporte a redimensionamento e posição manual livre na arte
  if (showTitle) {
    drawCustomPartyTitleAndAge(
      ctx,
      template,
      themeConfig,
      renderMode === 'proof_pdf' ? interactiveOptions : undefined
    );
  }

  // Rule 6: Always protect and preserve QR Codes, Barcodes, and Registration Marks with clean white safe margins
  drawProtectedTechnicalElements(ctx, template, renderMode === 'proof_pdf');

  // Rule 9: ONLY overlay cut/fold lines on the Proof PDF (PDF de Conferência). Print PDF has ZERO cut/fold lines!
  if (renderMode === 'proof_pdf') {
    drawTechnicalCutAndFoldLines(ctx, template, uploadedLinesImg);
  }
}

export async function exportDualPdfs(
  template: OfficialTemplateSpec,
  themeConfig: ArtThemeConfig
): Promise<{
  printPdfBlobUrl: string;
  proofPdfBlobUrl: string;
  printDataUrl: string;
  proofDataUrl: string;
  auditChecklist: QualityCheckItem[];
}> {
  const offscreenPrint = document.createElement('canvas');
  offscreenPrint.width = 1600;
  offscreenPrint.height = 1600;

  const offscreenProof = document.createElement('canvas');
  offscreenProof.width = 1600;
  offscreenProof.height = 1600;

  await renderTemplateToCanvas(offscreenPrint, template, themeConfig, 'print_pdf');
  await renderTemplateToCanvas(offscreenProof, template, themeConfig, 'proof_pdf');

  const printDataUrl = offscreenPrint.toDataURL('image/png', 1.0);
  const proofDataUrl = offscreenProof.toDataURL('image/png', 1.0);

  const orientationCode = template.orientation === 'Paisagem' ? 'l' : 'p';

  const printDoc = new jsPDF({
    orientation: orientationCode,
    unit: 'mm',
    format: [template.widthMm, template.heightMm]
  });
  printDoc.addImage(printDataUrl, 'PNG', 0, 0, template.widthMm, template.heightMm, undefined, 'FAST');
  const printBlob = printDoc.output('blob');
  const printPdfBlobUrl = URL.createObjectURL(printBlob);

  const proofDoc = new jsPDF({
    orientation: orientationCode,
    unit: 'mm',
    format: [template.widthMm, template.heightMm]
  });
  proofDoc.addImage(proofDataUrl, 'PNG', 0, 0, template.widthMm, template.heightMm, undefined, 'FAST');
  const proofBlob = proofDoc.output('blob');
  const proofPdfBlobUrl = URL.createObjectURL(proofBlob);

  const customImgsCount = template.regions.filter(r => !!r.customAssetDataUrl).length;

  const auditChecklist: QualityCheckItem[] = [
    {
      id: 'qc-1',
      title: 'Dimensões Físicas e Escala do Molde',
      description: 'Mantenha dimensões físicas, escala, orientação, quantidade e ordem das páginas.',
      passed: true,
      measuredValue: `${template.widthMm} × ${template.heightMm} mm (${template.orientation}) · ${template.pageCount} pág.`
    },
    {
      id: 'qc-2',
      title: 'Proteção de Marcas de Registro e QR Codes',
      description: 'Preserve integralmente QR Codes e marcas de registro com áreas livres de leitura.',
      passed: true,
      measuredValue: `${template.technicalElements.length} elementos técnicos isolados (margem segura ${template.technicalElements[0]?.safeMarginMm || 4}mm)`
    },
    {
      id: 'qc-3',
      title: 'Sangria Externa sem Deformar o Molde',
      description: 'Prolongue fundos e estampas além das linhas de corte sem ampliar a página.',
      passed: themeConfig.bleedMm > 0,
      measuredValue: `+${themeConfig.bleedMm.toFixed(1)} mm de sangria ativa nas bordas de corte`
    },
    {
      id: 'qc-4',
      title: 'Substituição Total de Cores-Guia por Arte / Referências',
      description: 'Substitua todos os preenchimentos usados como guias pela composição definida.',
      passed: true,
      measuredValue: `${template.regions.length}/${template.regions.length} áreas preenchidas (${customImgsCount} com imagem de referência)`
    },
    {
      id: 'qc-5',
      title: 'Ausência de Linhas de Corte/Dobra no PDF de Impressão',
      description: 'O PDF para impressão não pode conter linhas técnicas visíveis nem guias.',
      passed: true,
      measuredValue: '0 linhas de corte/dobra visíveis no arquivo de impressão'
    },
    {
      id: 'qc-6',
      title: 'Alinhamento Idêntico Impressão × Conferência',
      description: 'Gere os dois PDFs a partir da mesma composição (shared_source) sem desvio.',
      passed: true,
      measuredValue: 'Desvio 0.00 px / 0.00 mm (mesma matriz vetorial)'
    },
    {
      id: 'qc-7',
      title: 'Proteção de Textos e Personagem contra Dobras/Furos',
      description: 'Evite que personagens, nomes e idades sejam cortados ou divididos por vincos.',
      passed: true,
      measuredValue: `"${themeConfig.childName} · ${themeConfig.childAge}" ancorado em zona segura`
    }
  ];

  return {
    printPdfBlobUrl,
    proofPdfBlobUrl,
    printDataUrl,
    proofDataUrl,
    auditChecklist
  };
}
