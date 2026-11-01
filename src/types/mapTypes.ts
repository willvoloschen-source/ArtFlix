export type MapState =
  | 'WAITING_ACTIVATION'
  | 'WAITING_PDF'
  | 'ANALYZING_PDF'
  | 'WAITING_REGION_MEANINGS'
  | 'BUILDING_MAP'
  | 'CREATING_ART'
  | 'VERIFYING_OUTPUTS'
  | 'READY';

export type RegionFunction =
  | 'nao_definido'
  | 'papel_principal'
  | 'papel_secundario'
  | 'fundo'
  | 'barrado'
  | 'lateral'
  | 'personagem'
  | 'elemento_principal'
  | 'elementos_secundarios'
  | 'nome'
  | 'idade'
  | 'nome_idade'
  | 'moldura'
  | 'aplique_topper';

export interface Point2D {
  x: number;
  y: number;
}

export type ImageFitMode = 'cover' | 'repeat' | 'contain';

export interface ReferenceImageItem {
  id: string;
  name: string;
  dataUrl: string;
  role: 'auto' | 'papel_principal' | 'papel_secundario' | 'lateral' | 'barrado' | 'personagem';
  extractedPalette: string[];
  isAiGenerated?: boolean;
  targetRegionId?: string;
  aiPromptUsed?: string;
}

export interface DetectedRegion {
  id: string; // 'A', 'B', 'C', ...
  colorName: string; // 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Laranja', 'Verde-água', 'Sem cor ( Molde em Linhas )'
  colorHex: string;
  shapeAndLocation: string; // ex: 'Retângulo frontal amplo (esquerda/centro)'
  pageAndFace: string; // ex: 'Página 1 · Painel Frontal Principal'
  repetitions: string; // ex: 'Único (1 ocorrência)' ou 'Repete em 2 faces (Painéis 1 e 3)'
  overlaps: string; // ex: 'Nenhuma sobreposição interna' ou 'Contém Área E (círculo central) sobreposta'
  pageIndex: number;
  // Normalized coordinates (0..1000 canvas coordinate space)
  polygon: Point2D[];
  bbox: { x: number; y: number; w: number; h: number };
  isOverlayChild?: boolean;
  parentRegionId?: string;
  rotationDeg?: number;
  // Mapped Composition properties
  assignedFunction: RegionFunction;
  assignedContent: string;
  positionAndOrientation: string;
  overlapRule: string;
  customPatternId?: string;
  customAssetDataUrl?: string;
  customAssetName?: string;
  imageFitMode?: ImageFitMode;
  imageScale?: number;
  customSolidColor?: string;
  aiPromptUsed?: string;
  aiMapRecord?: string;
  isAiCreated?: boolean;
}

export interface TechnicalElement {
  id: string;
  type: 'registration_mark' | 'qr_code' | 'barcode' | 'numeric_code' | 'hole_cutout';
  label: string;
  bbox: { x: number; y: number; w: number; h: number };
  safeMarginMm: number;
  preserved: boolean;
}

export interface TemplateLineSegment {
  type: 'cut' | 'fold_solid' | 'fold_dashed' | 'hole';
  points?: Point2D[];
  pathSvg?: string;
  circle?: { cx: number; cy: number; r: number };
  color: string;
  strokeWidth: number;
}

export interface OfficialTemplateSpec {
  id: string;
  name: string;
  category: string;
  mode: 'colored_map' | 'lines_only' | 'custom_pdf';
  pageCount: number;
  widthMm: number;
  heightMm: number;
  orientation: 'Paisagem' | 'Retrato';
  description: string;
  regions: DetectedRegion[];
  technicalLines: TemplateLineSegment[];
  technicalElements: TechnicalElement[];
  outerCutPolygon: Point2D[]; // Used for accurate bleed expansion without altering the template size
  uploadedPdfRenderDataUrl?: string;
  uploadedLinesMaskDataUrl?: string;
}

export interface AiRegionPlanItem {
  regionId: string;
  assignedFunction: RegionFunction;
  assignedContent: string;
  mapRecordFormatted: string;
  fitMode: ImageFitMode;
  action: 'use_reference' | 'create_complementary_ai';
  imageGenerationPrompt: string;
}

export interface ArtThemeConfig {
  themeName: string;
  childName: string;
  childAge: string;
  bleedMm: number;
  primaryPatternId: string;
  secondaryPatternId: string;
  borderStyleId: string;
  characterPresetId: string;
  namePrimaryColor: string;
  nameOutlineColor: string;
  agePrimaryColor?: string;
  fontFamily: string;
  ageFontFamily?: string;
  namePosX?: number;
  namePosY?: number;
  nameScale?: number;
  agePosX?: number;
  agePosY?: number;
  ageScale?: number;
  showCharacterOverlay?: boolean;
  showTitleOverlay?: boolean;
  // Reference images gallery uploaded by user for AI auto-fill
  referenceImages?: ReferenceImageItem[];
  // AI Creative prompt and strategy
  aiCreativeInstruction?: string;
  aiStrategyMode?: 'complement_all' | 'keep_primary_complement_rest';
  aiLastSummary?: string;
  aiMapRecords?: string[];
  // Optional user-uploaded assets ("Dica de Ouro: Leve tudo pronto")
  uploadedPrimaryPaper?: string;
  uploadedSecondaryPaper?: string;
  uploadedLateralPaper?: string;
  uploadedBorderStrip?: string;
  uploadedCharacterPng?: string;
  onlyPrintPdfRequested?: boolean;
}

export interface QualityCheckItem {
  id: string;
  title: string;
  description: string;
  passed: boolean;
  measuredValue: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  timestamp: string;
  text: string;
  stateAtTime: MapState;
  detectedRegionsTable?: DetectedRegion[];
  compositionSummary?: DetectedRegion[];
  auditChecklist?: QualityCheckItem[];
  commandBadge?: string;
}

export interface ProductBranch {
  id: string;
  name: string;
  productType: string;
  createdAt: string;
  state: MapState;
  template: OfficialTemplateSpec | null;
  themeConfig: ArtThemeConfig;
  messages: ChatMessage[];
  mapConfirmed: boolean;
  lastPrintPdfUrl?: string;
  lastProofPdfUrl?: string;
}
