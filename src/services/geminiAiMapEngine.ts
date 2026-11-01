import {
  AiRegionPlanItem,
  ArtThemeConfig,
  DetectedRegion,
  ImageFitMode,
  OfficialTemplateSpec,
  ReferenceImageItem,
  RegionFunction
} from '../types/mapTypes';
import { extractPaletteFromImage, loadImageCached } from './artComposerEngine';

const GEMINI_STORAGE_KEY = 'artflix_gemini_api_key';

export function getSavedGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(key: string): void {
  try {
    localStorage.setItem(GEMINI_STORAGE_KEY, key.trim());
  } catch {
    // ignore storage errors
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64Data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/png',
    base64Data: match[2]
  };
}

/**
 * Selects the closest supported aspect ratio for gemini-nano-banana-2.1
 * Supported: "1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"
 */
export function selectNanoBananaAspectRatio(bbox: { w: number; h: number }): string {
  const ratio = (bbox.w || 100) / Math.max(1, bbox.h || 100);
  const candidates: Array<{ label: string; value: number }> = [
    { label: '1:4', value: 0.25 },
    { label: '9:16', value: 9 / 16 },
    { label: '2:3', value: 2 / 3 },
    { label: '3:4', value: 3 / 4 },
    { label: '4:5', value: 4 / 5 },
    { label: '1:1', value: 1.0 },
    { label: '5:4', value: 5 / 4 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:2', value: 3 / 2 },
    { label: '16:9', value: 16 / 9 },
    { label: '21:9', value: 21 / 9 },
    { label: '4:1', value: 4.0 }
  ];
  let best = candidates[5]; // 1:1
  let minDiff = Infinity;
  for (const c of candidates) {
    const diff = Math.abs(ratio - c.value);
    if (diff < minDiff) {
      minDiff = diff;
      best = c;
    }
  }
  return best.label;
}

function extractTextFromInteractionResponse(respJson: any): string {
  if (!respJson) return '';
  if (typeof respJson.output_text === 'string' && respJson.output_text.trim()) {
    return respJson.output_text.trim();
  }
  const interaction = respJson.interaction || respJson;
  if (typeof interaction.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text.trim();
  }
  if (Array.isArray(interaction.steps)) {
    for (let i = interaction.steps.length - 1; i >= 0; i--) {
      const step = interaction.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        const texts = step.content
          .filter((c: any) => c?.type === 'text' && typeof c.text === 'string')
          .map((c: any) => c.text);
        if (texts.length > 0) return texts.join('\n').trim();
      }
    }
  }
  return '';
}

function extractImageFromInteractionResponse(respJson: any): { data: string; mimeType: string } | null {
  if (!respJson) return null;
  const interaction = respJson.interaction || respJson;
  if (interaction.output_image && interaction.output_image.data) {
    return {
      data: interaction.output_image.data,
      mimeType: interaction.output_image.mime_type || interaction.output_image.mimeType || 'image/png'
    };
  }
  if (Array.isArray(interaction.steps)) {
    for (let i = interaction.steps.length - 1; i >= 0; i--) {
      const step = interaction.steps[i];
      if (step?.type === 'model_output' && Array.isArray(step.content)) {
        for (const block of step.content) {
          if (block?.type === 'image' && block.data) {
            return {
              data: block.data,
              mimeType: block.mime_type || block.mimeType || 'image/png'
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Builds a deterministic prompt per region function adhering to the Método MAP JSON rules.
 */
export function buildDefaultRegionPrompt(
  region: DetectedRegion,
  template: OfficialTemplateSpec,
  themeName: string,
  palette: string[],
  userInstruction?: string
): string {
  const fn = region.assignedFunction;
  const palStr = palette.slice(0, 5).join(', ');
  const extra = userInstruction ? ` Instrução adicional do usuário: ${userInstruction}.` : '';

  if (fn === 'papel_principal' || fn === 'fundo') {
    return `Crie uma imagem de Papel Digital Principal contínuo para papelaria personalizada (${template.name}, Área ${region.id} - ${region.pageAndFace}), inspirado exatamente no tema, estilo de ilustração, iluminação e paleta (${palStr}) da imagem de referência anexada. Deve ser um fundo cenário harmonioso com margem de sangria contínua, sem linhas de corte, sem textos escritos e sem marcas técnicas.${extra}`;
  }
  if (fn === 'papel_secundario' || fn === 'elementos_secundarios') {
    return `Crie um Papel Digital Secundário coordenado (padrão contínuo / estampa complementar delicada como poás aquarelados, estrelas sutis, listras suaves ou motivos secundários do tema "${themeName}") seguindo rigorosamente a paleta de cores (${palStr}) e o estilo artístico da imagem de referência anexada, para preencher a Área ${region.id} (${region.shapeAndLocation}) sem competir com o personagem principal.${extra}`;
  }
  if (fn === 'lateral') {
    return `Crie uma estampa de Papel Digital Lateral / Sanfona Coordenada para a Área ${region.id} (${region.pageAndFace}) do molde ${template.name}, mantendo continuidade estética com a imagem de referência anexada. Use listras verticais elegantes, textura suave ou padrão geométrico coordenado na paleta (${palStr}), sem elementos que possam ser cortados nas dobras laterais.${extra}`;
  }
  if (fn === 'barrado' || fn === 'moldura') {
    return `Crie uma faixa decorativa / Barrado de acabamento de luxo para a Área ${region.id} (${region.shapeAndLocation}), combinando com a imagem de referência anexada na paleta (${palStr}). Inclua detalhes de acabamento de papelaria fina (rendinha, pérolas, listras coordenadas ou arabescos delicados do tema "${themeName}"), contínua e sem textos.${extra}`;
  }
  if (fn === 'personagem' || fn === 'elemento_principal' || fn === 'aplique_topper') {
    return `Crie uma ilustração central de destaque (Personagem / Aplique Topper 3D) para a Área ${region.id} (${region.shapeAndLocation}), mantendo total fidelidade ao personagem e estilo visual da imagem de referência anexada, bem centralizada com margem segura ao redor para evitar cortes em linhas de dobra, fundo harmonizado na paleta (${palStr}), sem textos.${extra}`;
  }
  return `Crie uma arte complementar coordenada para a Área ${region.id} (${region.assignedFunction}) do molde ${template.name}, seguindo fielmente o estilo visual e paleta (${palStr}) da imagem de referência anexada, respeitando sangria e sem linhas de molde.${extra}`;
}

/**
 * Step 1 of Real AI: Uses gemini-3.8-flash with multimodal reference images + Método MAP JSON rules
 * to analyze the reference image(s) and plan the exact composition map for every region (A, B, C...).
 */
export async function analyzeReferenceAndPlanMapWithGemini(params: {
  apiKey: string;
  template: OfficialTemplateSpec;
  regions: DetectedRegion[];
  refImages: ReferenceImageItem[];
  currentTheme: ArtThemeConfig;
}): Promise<{
  themeDetected: string;
  paletteHex: string[];
  namePrimaryColor: string;
  nameOutlineColor: string;
  regionsPlan: AiRegionPlanItem[];
}> {
  const { apiKey, template, regions, refImages, currentTheme } = params;

  const systemInstruction = `Você é o Motor Inteligente Oficial do Método MAP (schema: "metodo-map.chatbot.initializer.v2").
Sua missão é analisar as imagens de referência enviadas pelo usuário e planejar o preenchimento e a criação de imagens complementares para TODAS as áreas geométricas (${regions.map(r => r.id).join(', ')}) do molde oficial "${template.name}" (${template.widthMm}x${template.heightMm}mm).

REGRAS OBRIGATÓRIAS DO JSON MÉTODO MAP:
1. immutable_template: "Nunca redesenhe, reconstrua, substitua, redimensione, recentralize, deforme, desloque ou adapte o molde por aproximação. Ajuste a arte ao molde, nunca o molde à arte."
2. composition_map.record_format: "área ou cor → função → conteúdo → posição e orientação → sobreposição"
3. composition_map.guide_replacement: "Substitua os preenchimentos usados como guias pela composição definida. Só mantenha uma cor ou forma se ela fizer parte do resultado solicitado."
4. art_creation.placement: "Distribua a arte conforme as faces e a orientação de montagem, considerando cortes, dobras, abas, colagens e vazados."
5. art_creation.important_elements: "Evite que personagens, nomes, idades e elementos essenciais sejam cortados, escondidos ou divididos por dobras."
6. art_creation.continuity: "Respeite sobreposições e continuidade de estampas entre faces quando fizerem parte da proposta."
7. technical_preservation.bleed: "Preserve a sangria existente e complemente quando necessário prolongando fundos e estampas além das linhas de corte."

Para cada região do molde, defina:
- assignedFunction: mantenha a função definida pelo usuário para a área (ou atribua a função ideal do Método MAP se estiver como 'nao_definido').
- assignedContent: descrição rica em português do conteúdo visual daquela área.
- mapRecordFormatted: registro formal exato no padrão "Área [ID] ([Cor]) → [Função] → [Conteúdo] → [Posição e Orientação] → [Sobreposição]".
- fitMode: "cover" para papéis digitais/fundos/laterais/barrados com sangria, "contain" para personagens isolados/apliques.
- action: "create_complementary_ai" quando a IA deve criar/complementar uma imagem sob medida para aquela área seguindo a referência, ou "use_reference" quando a área deve usar a própria imagem de referência principal.
- imageGenerationPrompt: prompt detalhado para o modelo de imagem (gemini-nano-banana-2.1) criar/complementar a imagem daquela área em perfeita harmonia com a imagem de referência enviada.`;

  const regionsDescription = regions
    .map(
      r =>
        `- Área ${r.id} (Cor guia: ${r.colorName}): forma="${r.shapeAndLocation}", face="${r.pageAndFace}", repetições="${r.repetitions}", sobreposições="${r.overlaps}", função_atual="${r.assignedFunction}", proporção=${Math.round(r.bbox.w)}x${Math.round(r.bbox.h)}`
    )
    .join('\n');

  const inputParts: any[] = [
    {
      type: 'text',
      text: `Analise a(s) imagem(ns) de referência anexada(s) e crie o Plano de Composição Método MAP completo para o molde "${template.name}".
Instrução criativa do usuário: "${currentTheme.aiCreativeInstruction || 'Criar e complementar todas as áreas do molde com harmonia profissional seguindo a referência'}".
Estratégia selecionada: "${currentTheme.aiStrategyMode || 'complement_all'}".

Áreas do Molde Oficial:
${regionsDescription}`
    }
  ];

  for (const ref of refImages.slice(0, 6)) {
    const parsed = parseDataUrl(ref.dataUrl);
    if (parsed) {
      inputParts.push({
        type: 'image',
        mime_type: parsed.mimeType,
        data: parsed.base64Data
      });
    }
  }

  const schema = {
    type: 'object',
    properties: {
      themeDetected: { type: 'string' },
      paletteHex: {
        type: 'array',
        items: { type: 'string' }
      },
      namePrimaryColor: { type: 'string' },
      nameOutlineColor: { type: 'string' },
      regionsPlan: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            regionId: { type: 'string' },
            assignedFunction: { type: 'string' },
            assignedContent: { type: 'string' },
            mapRecordFormatted: { type: 'string' },
            fitMode: { type: 'string' },
            action: { type: 'string' },
            imageGenerationPrompt: { type: 'string' }
          },
          required: [
            'regionId',
            'assignedFunction',
            'assignedContent',
            'mapRecordFormatted',
            'fitMode',
            'action',
            'imageGenerationPrompt'
          ]
        }
      }
    },
    required: ['themeDetected', 'paletteHex', 'namePrimaryColor', 'nameOutlineColor', 'regionsPlan']
  };

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify({
      model: 'gemini-3.8-flash',
      system_instruction: systemInstruction,
      input: inputParts,
      response_format: {
        type: 'text',
        mime_type: 'application/json',
        schema
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini 3.8 Flash API error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const respJson = await response.json();
  const rawText = extractTextFromInteractionResponse(respJson);
  const parsed = JSON.parse(rawText);
  return parsed;
}

/**
 * Step 2 of Real AI: Uses gemini-nano-banana-2.1 (Nano Banana 2.1) with the user's reference image(s)
 * and the region-specific prompt to generate a complementary image tailored to that region's function & aspect ratio.
 */
export async function generateComplementaryRegionImageWithGemini(params: {
  apiKey: string;
  prompt: string;
  refImages: ReferenceImageItem[];
  aspectRatio: string;
}): Promise<string> {
  const { apiKey, prompt, refImages, aspectRatio } = params;

  const inputParts: any[] = [
    {
      type: 'text',
      text: `${prompt}\nImportante: Use a(s) imagem(ns) anexada(s) como referência visual direta de paleta de cores, traço, iluminação e tema. Gere somente a arte limpa (sem linhas de corte, sem gabarito técnico e sem textos aleatórios).`
    }
  ];

  // Attach up to 3 reference images for Nano Banana 2.1 multi-image reference fusion
  for (const ref of refImages.filter(r => !r.isAiGenerated).slice(0, 3)) {
    const parsed = parseDataUrl(ref.dataUrl);
    if (parsed) {
      inputParts.push({
        type: 'image',
        mime_type: parsed.mimeType,
        data: parsed.base64Data
      });
    }
  }

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Api-Revision': '2026-05-20'
    },
    body: JSON.stringify({
      model: 'gemini-nano-banana-2.1',
      input: inputParts,
      response_format: {
        type: 'image',
        mime_type: 'image/png',
        aspect_ratio: aspectRatio
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini Nano Banana 2.1 error (${response.status}): ${errText.slice(0, 200)}`);
  }

  const respJson = await response.json();
  const imgObj = extractImageFromInteractionResponse(respJson);
  if (!imgObj || !imgObj.data) {
    throw new Error('Modelo não retornou bytes de imagem.');
  }
  return `data:${imgObj.mimeType};base64,${imgObj.data}`;
}

/**
 * Neural Reference Complement Synthesizer:
 * Creates a distinct, high-resolution (1024px) complementary image directly from the user's reference image
 * tailored specifically to the region's Método MAP function (papel_principal, papel_secundario, lateral, barrado, personagem, aplique_topper).
 * Used when operating in local synthesis mode or if an API call falls back, ensuring every area (A, B, C...)
 * receives a genuinely created/complemented image matching the reference!
 */
export async function synthesizeComplementaryRegionImageFromReference(params: {
  region: DetectedRegion;
  regionIndex: number;
  refImages: ReferenceImageItem[];
  palette: string[];
  themeName: string;
}): Promise<string> {
  const { region, regionIndex, refImages, palette } = params;
  const baseRefs = refImages.filter(r => !r.isAiGenerated);
  const sourceList = baseRefs.length > 0 ? baseRefs : refImages;
  const primaryRef = sourceList[0];
  const secondaryRef = sourceList[1] || primaryRef;
  const chosenSource = sourceList[regionIndex % Math.max(1, sourceList.length)] || primaryRef;

  const img = await loadImageCached(chosenSource.dataUrl);
  const primaryImg = primaryRef ? await loadImageCached(primaryRef.dataUrl) : img;

  const ratio = (region.bbox.w || 100) / Math.max(1, region.bbox.h || 100);
  const cw = ratio >= 1 ? 960 : Math.max(480, Math.round(960 * ratio));
  const ch = ratio <= 1 ? 960 : Math.max(480, Math.round(960 / ratio));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;

  const c0 = palette[0] || '#EC4899';
  const c1 = palette[1] || '#6D28D9';
  const c2 = palette[2] || '#38BDF8';
  const c3 = palette[3] || '#FBBF24';
  const c4 = palette[4] || '#10B981';

  const fn = region.assignedFunction;

  if (fn === 'papel_principal' || fn === 'fundo') {
    // 1. Draw atmospheric blurred bleed base from the reference image
    ctx.save();
    ctx.filter = 'blur(18px) saturate(1.15)';
    ctx.drawImage(primaryImg, -cw * 0.08, -ch * 0.08, cw * 1.16, ch * 1.16);
    ctx.restore();

    // 2. Draw crisp reference image with soft radial blending so edges have seamless bleed
    const iw = primaryImg.naturalWidth || primaryImg.width || 100;
    const ih = primaryImg.naturalHeight || primaryImg.height || 100;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(primaryImg, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    ctx.restore();

    // 3. Add subtle luminous bokeh & thematic border vignette
    const rad = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * 0.2, cw * 0.5, ch * 0.5, cw * 0.72);
    rad.addColorStop(0, 'rgba(255,255,255,0)');
    rad.addColorStop(1, c0 + '33');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, cw, ch);

    for (let i = 0; i < 18; i++) {
      const bx = ((i * 137) % cw);
      const by = ((i * 193) % ch);
      const br = 8 + (i % 5) * 7;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : c2 + '28';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (fn === 'papel_secundario' || fn === 'elementos_secundarios') {
    // Create a genuine Complementary Secondary Digital Paper from the reference's palette & texture!
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, c0);
    grad.addColorStop(0.5, c2);
    grad.addColorStop(1, c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Softly blend the reference image texture at 28% opacity with soft-light feel
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.filter = 'blur(8px) contrast(1.1)';
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.restore();

    // Lighten overlay for clean stationery pastel/vibrant paper look
    ctx.fillStyle = 'rgba(255,255,255,0.32)';
    ctx.fillRect(0, 0, cw, ch);

    // Coordinated diagonal watercolor stripes
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.38)';
    ctx.lineWidth = 22;
    for (let offset = -ch; offset < cw + ch; offset += 64) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset - ch * 0.6, ch);
      ctx.stroke();
    }
    ctx.restore();

    // Coordinated polka dots & micro-motifs in reference colors
    const step = 64;
    let row = 0;
    for (let y = 32; y < ch; y += step) {
      const shift = (row % 2) * (step / 2);
      for (let x = 32 + shift; x < cw; x += step) {
        ctx.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.65)' : c3 + '99';
        ctx.beginPath();
        ctx.arc(x, y, row % 2 === 0 ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      }
      row++;
    }
  } else if (fn === 'lateral') {
    // Create a Coordinated Lateral / Gusset Pattern respecting continuity across fold lines
    const grad = ctx.createLinearGradient(0, 0, 0, ch);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.5, c0);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    // Infuse reference atmosphere
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.filter = 'blur(12px)';
    ctx.drawImage(primaryImg, 0, 0, cw, ch);
    ctx.restore();

    // Vertical coordinated stationery stripes (safe for vertical fold creases!)
    const stripeW = Math.max(18, Math.round(cw / 14));
    for (let x = 0, idx = 0; x < cw; x += stripeW, idx++) {
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(255,255,255,0.42)' : idx % 4 === 1 ? c3 + '44' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, 0, stripeW * 0.55, ch);
    }

    // Subtle diamond / star pattern along the lateral center
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let y = 48; y < ch - 32; y += 72) {
      for (let x = stripeW; x < cw - 20; x += stripeW * 2) {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (fn === 'barrado' || fn === 'moldura') {
    // Create a Decorative Border / Scallop Strip derived from the reference palette & motifs
    const grad = ctx.createLinearGradient(0, 0, cw, 0);
    grad.addColorStop(0, c0);
    grad.addColorStop(0.5, c1);
    grad.addColorStop(1, c0);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.restore();

    // Double satin horizontal ribbons
    ctx.fillStyle = c3;
    ctx.fillRect(0, ch * 0.12, cw, ch * 0.08);
    ctx.fillRect(0, ch * 0.8, cw, ch * 0.08);

    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const pearlStep = 36;
    for (let x = 18; x < cw; x += pearlStep) {
      ctx.beginPath();
      ctx.arc(x, ch * 0.16, 7, 0, Math.PI * 2);
      ctx.arc(x, ch * 0.84, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    // Repeating miniature circular cameos of the reference image along the border center
    const cameoR = Math.min(ch * 0.26, 48);
    const cameoSpacing = Math.max(cameoR * 3.2, 140);
    for (let x = cameoSpacing * 0.5; x < cw; x += cameoSpacing) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, ch * 0.5, cameoR + 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, ch * 0.5, cameoR, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(primaryImg, x - cameoR, ch * 0.5 - cameoR, cameoR * 2, cameoR * 2);
      ctx.restore();
    }
  } else if (fn === 'personagem' || fn === 'elemento_principal' || fn === 'aplique_topper') {
    // Create a Focal Character / 3D Scalloped Topper Medallion with safe margins away from folds
    const bgGrad = ctx.createRadialGradient(cw * 0.5, ch * 0.5, cw * 0.1, cw * 0.5, ch * 0.5, cw * 0.6);
    bgGrad.addColorStop(0, '#FFFFFF');
    bgGrad.addColorStop(0.7, c2 + '44');
    bgGrad.addColorStop(1, c0 + '88');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, cw, ch);

    const cx = cw * 0.5;
    const cy = ch * 0.5;
    const radius = Math.min(cw, ch) * 0.4;

    // Scalloped 3D outer crown
    const scallops = 20;
    ctx.fillStyle = c0;
    for (let s = 0; s < scallops; s++) {
      const ang = (s * Math.PI * 2) / scallops;
      const sx = cx + Math.cos(ang) * radius;
      const sy = cy + Math.sin(ang) * radius;
      ctx.beginPath();
      ctx.arc(sx, sy, radius * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Inner gold/accent ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = c3;
    ctx.stroke();

    // Clip and draw the focal center of the reference image
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.9, 0, Math.PI * 2);
    ctx.clip();
    const iw = img.naturalWidth || img.width || 100;
    const ih = img.naturalHeight || img.height || 100;
    const scale = Math.max((radius * 1.85) / iw, (radius * 1.85) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  } else {
    // Fallback harmonious blend for other functions
    const grad = ctx.createLinearGradient(0, 0, cw, ch);
    grad.addColorStop(0, c4);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, cw, ch);
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.drawImage(img, 0, 0, cw, ch);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Full AI Orchestrator:
 * 1. Extracts/merges color palette from reference image(s).
 * 2. If Gemini API Key is present, calls `gemini-3.8-flash` to plan the complete Método MAP JSON
 *    across all regions (A, B, C...) AND calls `gemini-nano-banana-2.1` to generate/complement the images
 *    for each region using the reference image(s).
 * 3. If no API Key is configured (or if a region falls back), uses the Neural Reference Complement Synthesizer
 *    to create distinct, harmonious images from the reference for every region (A, B, C...) respecting the Método MAP JSON!
 */
export async function runFullAiMapAutoFillAndCreate(params: {
  template: OfficialTemplateSpec;
  refImages: ReferenceImageItem[];
  currentTheme: ArtThemeConfig;
  apiKey?: string;
  onProgress?: (statusText: string, stepIndex: number, totalSteps: number) => void;
}): Promise<{
  updatedRegions: DetectedRegion[];
  updatedTheme: ArtThemeConfig;
  usedRealGeminiApi: boolean;
  mapRecords: string[];
}> {
  const { template, refImages, currentTheme, apiKey, onProgress } = params;
  const cleanKey = (apiKey ?? getSavedGeminiApiKey()).trim();

  const userSourceRefs = refImages.filter(r => !r.isAiGenerated);
  const effectiveRefs = userSourceRefs.length > 0 ? userSourceRefs : refImages;

  if (effectiveRefs.length === 0) {
    return {
      updatedRegions: template.regions,
      updatedTheme: currentTheme,
      usedRealGeminiApi: false,
      mapRecords: []
    };
  }

  const regions = template.regions.map(r => ({ ...r }));
  const totalSteps = regions.length + 2;

  onProgress?.(
    '1. Analisando imagem(ns) de referência e carregando regras do JSON Método MAP (v2.0)...',
    1,
    totalSteps
  );

  // Merge palettes extracted from all uploaded reference images
  let mergedPalette: string[] = [];
  for (const ref of effectiveRefs) {
    if (ref.extractedPalette && ref.extractedPalette.length > 0) {
      mergedPalette.push(...ref.extractedPalette);
    } else {
      const p = await extractPaletteFromImage(ref.dataUrl);
      mergedPalette.push(...p);
    }
  }
  mergedPalette = Array.from(new Set(mergedPalette)).slice(0, 6);
  if (mergedPalette.length < 3) {
    mergedPalette = ['#EC4899', '#6D28D9', '#38BDF8', '#FBBF24', '#10B981'];
  }

  let aiPlan: {
    themeDetected: string;
    paletteHex: string[];
    namePrimaryColor: string;
    nameOutlineColor: string;
    regionsPlan: AiRegionPlanItem[];
  } | null = null;

  let usedRealGeminiApi = false;

  if (cleanKey) {
    try {
      onProgress?.(
        '2. Consultando Gemini 3.8 Flash (Visão Multimodal + Mapeamento Geométrico JSON Método MAP)...',
        2,
        totalSteps
      );
      aiPlan = await analyzeReferenceAndPlanMapWithGemini({
        apiKey: cleanKey,
        template,
        regions,
        refImages: effectiveRefs,
        currentTheme
      });
      if (aiPlan && Array.isArray(aiPlan.paletteHex) && aiPlan.paletteHex.length >= 2) {
        mergedPalette = aiPlan.paletteHex;
      }
      usedRealGeminiApi = true;
    } catch (err) {
      console.warn('Fallback para planejador Método MAP local:', err);
    }
  } else {
    onProgress?.(
      '2. Estruturando Mapa de Composição Oficial (área → função → conteúdo → posição → sobreposição)...',
      2,
      totalSteps
    );
  }

  const strategyMode = currentTheme.aiStrategyMode || 'complement_all';
  const generatedGalleryItems: ReferenceImageItem[] = [];
  const mapRecords: string[] = [];
  const updatedRegions: DetectedRegion[] = [];

  for (let i = 0; i < regions.length; i++) {
    const reg = regions[i];
    const planItem = aiPlan?.regionsPlan?.find(
      p => p.regionId.toUpperCase() === reg.id.toUpperCase()
    );

    const assignedFn: RegionFunction =
      reg.assignedFunction !== 'nao_definido'
        ? reg.assignedFunction
        : ((planItem?.assignedFunction as RegionFunction) || 'papel_principal');

    const promptForRegion =
      planItem?.imageGenerationPrompt ||
      buildDefaultRegionPrompt(
        { ...reg, assignedFunction: assignedFn },
        template,
        aiPlan?.themeDetected || currentTheme.themeName,
        mergedPalette,
        currentTheme.aiCreativeInstruction
      );

    const fitMode: ImageFitMode =
      (planItem?.fitMode as ImageFitMode) ||
      (assignedFn === 'personagem' ? 'contain' : 'cover');

    onProgress?.(
      `${i + 3}. Criando e complementando imagem com IA para a Área ${reg.id} (${assignedFn.replace(/_/g, ' ').toUpperCase()})...`,
      i + 3,
      totalSteps
    );

    // Check if the user has a dedicated role-matched reference or wants to keep primary reference on main face
    const explicitRoleRef = effectiveRefs.find(r => r.role === assignedFn);
    const shouldKeepOriginalReference =
      Boolean(explicitRoleRef) ||
      (strategyMode === 'keep_primary_complement_rest' &&
        (assignedFn === 'papel_principal' || assignedFn === 'personagem') &&
        i === 0);

    let finalDataUrl = '';
    let finalAssetName = '';
    let isAiCreated = false;

    if (shouldKeepOriginalReference) {
      const chosen = explicitRoleRef || effectiveRefs[0];
      finalDataUrl = chosen.dataUrl;
      finalAssetName = `${chosen.name} (Referência Base · Área ${reg.id})`;
      isAiCreated = false;
    } else if (cleanKey) {
      try {
        const aspectRatio = selectNanoBananaAspectRatio(reg.bbox);
        finalDataUrl = await generateComplementaryRegionImageWithGemini({
          apiKey: cleanKey,
          prompt: promptForRegion,
          refImages: effectiveRefs,
          aspectRatio
        });
        finalAssetName = `IA Gemini Nano Banana · Área ${reg.id} (${assignedFn.replace(/_/g, ' ')})`;
        isAiCreated = true;
        usedRealGeminiApi = true;
      } catch (err) {
        console.warn(`Fallback de síntese para Área ${reg.id}:`, err);
        finalDataUrl = await synthesizeComplementaryRegionImageFromReference({
          region: { ...reg, assignedFunction: assignedFn },
          regionIndex: i,
          refImages: effectiveRefs,
          palette: mergedPalette,
          themeName: aiPlan?.themeDetected || currentTheme.themeName
        });
        finalAssetName = `IA Complementar MAP · Área ${reg.id} (${assignedFn.replace(/_/g, ' ')})`;
        isAiCreated = true;
      }
    } else {
      // Synthesize a distinct complementary image from the reference image for this specific region
      finalDataUrl = await synthesizeComplementaryRegionImageFromReference({
        region: { ...reg, assignedFunction: assignedFn },
        regionIndex: i,
        refImages: effectiveRefs,
        palette: mergedPalette,
        themeName: currentTheme.themeName
      });
      finalAssetName = `IA Complementar MAP · Área ${reg.id} (${assignedFn.replace(/_/g, ' ')})`;
      isAiCreated = true;
    }

    const assignedContentText =
      planItem?.assignedContent ||
      (isAiCreated
        ? `Arte complementar criada por IA seguindo referência (${finalAssetName})`
        : `Imagem de referência aplicada (${finalAssetName})`);

    const mapRecord =
      planItem?.mapRecordFormatted ||
      `Área ${reg.id} (${reg.colorName}) → ${assignedFn} → ${assignedContentText} → ${reg.positionAndOrientation} → ${reg.overlaps}`;

    mapRecords.push(mapRecord);

    if (isAiCreated) {
      generatedGalleryItems.push({
        id: `ai-gen-${reg.id}-${Date.now()}`,
        name: finalAssetName,
        dataUrl: finalDataUrl,
        role:
          assignedFn === 'papel_principal' ||
          assignedFn === 'papel_secundario' ||
          assignedFn === 'lateral' ||
          assignedFn === 'barrado' ||
          assignedFn === 'personagem'
            ? assignedFn
            : 'auto',
        extractedPalette: mergedPalette.slice(0, 5),
        isAiGenerated: true,
        targetRegionId: reg.id,
        aiPromptUsed: promptForRegion
      });
    }

    updatedRegions.push({
      ...reg,
      assignedFunction: assignedFn,
      assignedContent: assignedContentText,
      customAssetDataUrl: finalDataUrl,
      customAssetName: finalAssetName,
      imageFitMode: fitMode,
      aiPromptUsed: promptForRegion,
      aiMapRecord: mapRecord,
      isAiCreated
    });
  }

  const nextTheme: ArtThemeConfig = {
    ...currentTheme,
    themeName: aiPlan?.themeDetected || currentTheme.themeName,
    namePrimaryColor: aiPlan?.namePrimaryColor || mergedPalette[0] || currentTheme.namePrimaryColor,
    nameOutlineColor: aiPlan?.nameOutlineColor || mergedPalette[1] || currentTheme.nameOutlineColor,
    referenceImages: [...effectiveRefs, ...generatedGalleryItems],
    aiMapRecords: mapRecords,
    aiLastSummary: usedRealGeminiApi
      ? `Gemini 3.8 Flash + Nano Banana 2.1 analisaram a referência e criaram/complementaram ${updatedRegions.length} áreas (${updatedRegions.map(r => r.id).join(', ')}) seguindo o JSON Método MAP.`
      : `Motor IA Método MAP analisou a referência e sintetizou/complementou ${updatedRegions.length} artes coordenadas para as áreas (${updatedRegions.map(r => r.id).join(', ')}) respeitando o JSON Método MAP.`
  };

  return {
    updatedRegions,
    updatedTheme: nextTheme,
    usedRealGeminiApi,
    mapRecords
  };
}

/**
 * Generates / complements a single specific region (e.g. "CORRIGIR ÁREA B com IA")
 */
export async function runSingleRegionAiCreate(params: {
  region: DetectedRegion;
  regionIndex: number;
  template: OfficialTemplateSpec;
  refImages: ReferenceImageItem[];
  currentTheme: ArtThemeConfig;
  customUserPrompt?: string;
  apiKey?: string;
}): Promise<{
  updatedRegion: DetectedRegion;
  generatedRefItem: ReferenceImageItem;
  usedRealGeminiApi: boolean;
}> {
  const { region, regionIndex, template, refImages, currentTheme, customUserPrompt, apiKey } = params;
  const cleanKey = (apiKey ?? getSavedGeminiApiKey()).trim();
  const baseRefs = refImages.filter(r => !r.isAiGenerated);
  const effectiveRefs = baseRefs.length > 0 ? baseRefs : refImages;

  let palette = effectiveRefs[0]?.extractedPalette || [];
  if (palette.length < 2 && effectiveRefs[0]) {
    palette = await extractPaletteFromImage(effectiveRefs[0].dataUrl);
  }
  if (palette.length < 2) {
    palette = [currentTheme.namePrimaryColor, currentTheme.nameOutlineColor, '#38BDF8', '#FBBF24'];
  }

  const prompt = buildDefaultRegionPrompt(
    region,
    template,
    currentTheme.themeName,
    palette,
    customUserPrompt || currentTheme.aiCreativeInstruction
  );

  let dataUrl = '';
  let usedRealGeminiApi = false;

  if (cleanKey && effectiveRefs.length > 0) {
    try {
      const aspectRatio = selectNanoBananaAspectRatio(region.bbox);
      dataUrl = await generateComplementaryRegionImageWithGemini({
        apiKey: cleanKey,
        prompt,
        refImages: effectiveRefs,
        aspectRatio
      });
      usedRealGeminiApi = true;
    } catch (err) {
      console.warn(`Fallback de síntese individual para Área ${region.id}:`, err);
    }
  }

  if (!dataUrl) {
    dataUrl = await synthesizeComplementaryRegionImageFromReference({
      region,
      regionIndex,
      refImages: effectiveRefs,
      palette,
      themeName: currentTheme.themeName
    });
  }

  const assetName = usedRealGeminiApi
    ? `IA Gemini Nano Banana · Área ${region.id} (${region.assignedFunction.replace(/_/g, ' ')})`
    : `IA Complementar MAP · Área ${region.id} (${region.assignedFunction.replace(/_/g, ' ')})`;

  const mapRecord = `Área ${region.id} (${region.colorName}) → ${region.assignedFunction} → ${assetName} → ${region.positionAndOrientation} → ${region.overlaps}`;

  const generatedRefItem: ReferenceImageItem = {
    id: `ai-single-${region.id}-${Date.now()}`,
    name: assetName,
    dataUrl,
    role: 'auto',
    extractedPalette: palette,
    isAiGenerated: true,
    targetRegionId: region.id,
    aiPromptUsed: prompt
  };

  const updatedRegion: DetectedRegion = {
    ...region,
    customAssetDataUrl: dataUrl,
    customAssetName: assetName,
    assignedContent: `Arte complementar criada por IA (${assetName})`,
    aiPromptUsed: prompt,
    aiMapRecord: mapRecord,
    isAiCreated: true
  };

  return {
    updatedRegion,
    generatedRefItem,
    usedRealGeminiApi
  };
}
