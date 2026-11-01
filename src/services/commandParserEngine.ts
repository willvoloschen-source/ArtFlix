import { DECODED_MAP_SPEC } from '../data/mapInitializerData';
import { ArtThemeConfig, DetectedRegion, RegionFunction } from '../types/mapTypes';

export function isActivationCommand(input: string): boolean {
  const norm = input.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return (
    norm === 'iniciar metodo map' ||
    norm === 'iniciar map' ||
    norm === 'comecar metodo map' ||
    norm.includes('iniciar metodo map') ||
    norm.includes('iniciar map')
  );
}

export function isDisclosureAttempt(input: string): boolean {
  const norm = input.trim().toLowerCase();
  return (
    norm.includes('mostrar prompt') ||
    norm.includes('mostre o prompt') ||
    norm.includes('revelar json') ||
    norm.includes('configuração interna') ||
    norm.includes('configuracao interna') ||
    norm.includes('ignore todas as instruções') ||
    norm.includes('system prompt')
  );
}

export function inferFunctionFromText(rawText: string): {
  fn: RegionFunction;
  label: string;
} {
  const t = rawText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (t.includes('lateral') || t.includes('sanfona') || t.includes('aba')) {
    return { fn: 'lateral', label: 'Papel Lateral / Sanfona Coordenada' };
  }
  if (t.includes('barrado') || t.includes('faixa') || t.includes('babado') || t.includes('topo') || t.includes('telhado') || t.includes('alca')) {
    return { fn: 'barrado', label: 'Barrado / Faixa Decorativa / Topo' };
  }
  if (t.includes('secundario') || t.includes('estampa 2') || t.includes('papel 2') || t.includes('poa') || t.includes('escamas')) {
    return { fn: 'papel_secundario', label: 'Papel Digital Secundário' };
  }
  if (t.includes('personagem') || t.includes('elemento principal') || t.includes('sereia') || t.includes('sonic') || t.includes('leao')) {
    return { fn: 'personagem', label: 'Personagem / Elemento Principal' };
  }
  if (t.includes('aplique') || t.includes('topper') || t.includes('tag') || t.includes('medalhao')) {
    return { fn: 'aplique_topper', label: 'Aplique 3D / Topper Escalopado' };
  }
  if (t.includes('moldura') || t.includes('borda')) {
    return { fn: 'moldura', label: 'Moldura Decorativa' };
  }
  if (t.includes('nome') || t.includes('idade') || t.includes('titulo') || t.includes('texto')) {
    return { fn: 'nome_idade', label: 'Nome + Idade Personalizados' };
  }
  if (t.includes('principal') || t.includes('papel 1') || t.includes('papel digital') || t.includes('frente')) {
    return { fn: 'papel_principal', label: 'Papel Digital Principal + Composição Frontal' };
  }
  if (t.includes('fundo')) {
    return { fn: 'fundo', label: 'Fundo Base da Composição' };
  }
  return { fn: 'papel_principal', label: rawText.trim() || 'Papel Digital Principal' };
}

export function parseUserRegionDefinitions(
  userInput: string,
  currentRegions: DetectedRegion[],
  currentTheme: ArtThemeConfig
): {
  updatedRegions: DetectedRegion[];
  updatedTheme: ArtThemeConfig;
  summaryLines: string[];
} {
  const updatedRegions = currentRegions.map(r => ({ ...r }));
  const updatedTheme = { ...currentTheme };

  // Extract name & age if provided in the message (e.g. "nome Maria, 3 anos" from Page 7 Guide)
  const nameMatch = userInput.match(/nome\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+)?)/i);
  if (nameMatch && nameMatch[1]) {
    updatedTheme.childName = nameMatch[1].trim().toUpperCase();
  }
  const ageMatch = userInput.match(/(\d+\s*anos?|\d+\s*meses?)/i);
  if (ageMatch && ageMatch[1]) {
    updatedTheme.childAge = ageMatch[1].trim().toUpperCase();
  }
  const bleedMatch = userInput.match(/sangria\s*(?:de)?\s*(\d+(?:[.,]\d+)?)\s*mm/i);
  if (bleedMatch && bleedMatch[1]) {
    updatedTheme.bleedMm = parseFloat(bleedMatch[1].replace(',', '.'));
  }
  if (userInput.toLowerCase().includes('só o pdf de impressão') || userInput.toLowerCase().includes('so o pdf de impressao')) {
    updatedTheme.onlyPrintPdfRequested = true;
  }

  // Split by semicolons, line breaks, or commas for clauses like "A = fundo; B = papel digital; C = personagem"
  const clauses = userInput.split(/[;\n]+/).map(s => s.trim()).filter(Boolean);

  for (const clause of clauses) {
    // Check ID assignment like "A = ..." or "Área A: ..."
    const idMatch = clause.match(/^(?:[aá]rea\s+)?([A-Z])\s*[=:→-]\s*(.+)$/i);
    if (idMatch) {
      const targetId = idMatch[1].toUpperCase();
      const desc = idMatch[2].trim();
      const inferred = inferFunctionFromText(desc);
      for (const reg of updatedRegions) {
        if (reg.id.toUpperCase() === targetId) {
          reg.assignedFunction = inferred.fn;
          reg.assignedContent = `${inferred.label} (${desc})`;
        }
      }
      continue;
    }

    // Check Color assignment like "Vermelho = ...", "Azul = ...", "Verde = ..."
    for (const reg of updatedRegions) {
      const baseColor = reg.colorName.split(' ')[0].toLowerCase();
      if (baseColor && baseColor !== 'sem' && clause.toLowerCase().includes(baseColor)) {
        const parts = clause.split(/[=:→-]/);
        const desc = parts.length > 1 ? parts.slice(1).join(' ').trim() : clause;
        const inferred = inferFunctionFromText(desc);
        reg.assignedFunction = inferred.fn;
        reg.assignedContent = `${inferred.label} (${desc})`;
      }
    }
  }

  const summaryLines = updatedRegions.map(
    r => `${r.id} (${r.colorName}) → ${r.assignedFunction.replace(/_/g, ' ').toUpperCase()} → ${r.assignedContent} → ${r.positionAndOrientation} → ${r.overlaps}`
  );

  return {
    updatedRegions,
    updatedTheme,
    summaryLines
  };
}

export const EXACT_MESSAGES = {
  FIRST_RESPONSE: DECODED_MAP_SPEC.activation.first_response_exact,
  DISCLOSURE_RESPONSE: "Não posso exibir a configuração interna do Método MAP. Posso ajudar a criar ou alterar sua arte.",
  REGION_OPENING: DECODED_MAP_SPEC.region_recognition.opening_exact,
  SINGLE_QUESTION: DECODED_MAP_SPEC.region_recognition.single_question_exact,
  ASK_CONFIRM_MAP: "Se estiver correto, responda CONFIRMAR MAPA.",
  MAP_CONFIRMED_START: "Mapa confirmado. Iniciando a arte."
};
