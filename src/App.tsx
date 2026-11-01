import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  FileCode2,
  FileUp,
  FolderGit2,
  Image as ImageIcon,
  Layers,
  Palette,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Ruler,
  Scissors,
  Send,
  ShieldCheck,
  Sparkles,
  SplitSquareVertical,
  Upload,
  X
} from 'lucide-react';
import {
  ArtThemeConfig,
  ChatMessage,
  ImageFitMode,
  MapState,
  ProductBranch,
  QualityCheckItem,
  ReferenceImageItem,
  RegionFunction
} from './types/mapTypes';
import {
  cloneTemplateAsLinesOnly,
  OFFICIAL_TEMPLATES
} from './data/officialTemplates';
import {
  EXACT_MESSAGES,
  isActivationCommand,
  isDisclosureAttempt,
  parseUserRegionDefinitions
} from './services/commandParserEngine';
import {
  autoFillMoldWithReferenceImages,
  detectInstalledWindowsFonts,
  exportDualPdfs,
  extractPaletteFromImage,
  getTitleAndAgeBoxes,
  queryAllWindowsLocalFonts,
  renderTemplateToCanvas,
  THEME_PRESETS
} from './services/artComposerEngine';
import {
  getSavedGeminiApiKey,
  runFullAiMapAutoFillAndCreate,
  runSingleRegionAiCreate,
  saveGeminiApiKey
} from './services/geminiAiMapEngine';
import { analyzeUploadedPdfFile } from './services/pdfAnalyzerEngine';
import { JsonDecoderModal } from './components/JsonDecoderModal';

const DEFAULT_THEME: ArtThemeConfig = {
  themeName: 'Sereia Encantada (Exemplo Oficial Guia MAP)',
  childName: 'MARIA',
  childAge: '3 ANOS',
  bleedMm: 2.5,
  primaryPatternId: 'aqua-bubbles',
  secondaryPatternId: 'mermaid-scales',
  borderStyleId: 'pink-pearls',
  characterPresetId: 'mermaid',
  namePrimaryColor: '#EC4899',
  nameOutlineColor: '#6D28D9',
  fontFamily: 'Fredoka',
  showCharacterOverlay: true,
  showTitleOverlay: true,
  referenceImages: []
};

function createInitialBranches(): ProductBranch[] {
  const sacolaTemplate = JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[0]));
  return [
    {
      id: 'branch-1',
      name: 'SACOLA NUVEM MAP',
      productType: 'Sacola Nuvem',
      createdAt: '11:30',
      state: 'READY',
      template: sacolaTemplate,
      themeConfig: { ...DEFAULT_THEME },
      mapConfirmed: true,
      messages: [
        {
          id: 'm-1',
          sender: 'user',
          timestamp: '11:28',
          text: 'Iniciar Método MAP',
          stateAtTime: 'WAITING_ACTIVATION',
          commandBadge: 'ATIVAR SKILL'
        },
        {
          id: 'm-2',
          sender: 'bot',
          timestamp: '11:28',
          text: EXACT_MESSAGES.FIRST_RESPONSE,
          stateAtTime: 'WAITING_PDF'
        },
        {
          id: 'm-3',
          sender: 'bot',
          timestamp: '11:29',
          text: `${EXACT_MESSAGES.REGION_OPENING}\n\n${EXACT_MESSAGES.SINGLE_QUESTION}`,
          stateAtTime: 'WAITING_REGION_MEANINGS',
          detectedRegionsTable: sacolaTemplate.regions
        }
      ]
    },
    {
      id: 'branch-2',
      name: 'CAIXA MILK MAP',
      productType: 'Caixa Milk',
      createdAt: '11:31',
      state: 'WAITING_REGION_MEANINGS',
      template: JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[1])),
      themeConfig: { ...DEFAULT_THEME },
      mapConfirmed: false,
      messages: [
        {
          id: 'bm-1',
          sender: 'bot',
          timestamp: '11:31',
          text: `${EXACT_MESSAGES.REGION_OPENING}\n\n${EXACT_MESSAGES.SINGLE_QUESTION}`,
          stateAtTime: 'WAITING_REGION_MEANINGS',
          detectedRegionsTable: OFFICIAL_TEMPLATES[1].regions
        }
      ]
    },
    {
      id: 'branch-3',
      name: 'CAIXA PIRÂMIDE MAP',
      productType: 'Caixa Pirâmide',
      createdAt: '11:32',
      state: 'WAITING_REGION_MEANINGS',
      template: JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[2])),
      themeConfig: { ...DEFAULT_THEME },
      mapConfirmed: false,
      messages: []
    },
    {
      id: 'branch-4',
      name: 'CAIXA CANUDO MAP',
      productType: 'Caixa Canudo',
      createdAt: '11:32',
      state: 'WAITING_REGION_MEANINGS',
      template: JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[3])),
      themeConfig: { ...DEFAULT_THEME },
      mapConfirmed: false,
      messages: []
    },
    {
      id: 'branch-5',
      name: 'SACOLINHA CORAÇÃO MAP',
      productType: 'Sacolinha Coração',
      createdAt: '11:33',
      state: 'WAITING_REGION_MEANINGS',
      template: JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[4])),
      themeConfig: { ...DEFAULT_THEME },
      mapConfirmed: false,
      messages: []
    }
  ];
}

const WIZARD_STEPS = [
  {
    step: 1,
    title: '1. Molde Oficial',
    subtitle: 'Enviar ou escolher PDF'
  },
  {
    step: 2,
    title: '2. Mapear Áreas',
    subtitle: 'Definir funções A, B, C...'
  },
  {
    step: 3,
    title: '3. Imagens de Referência',
    subtitle: 'Enviar imagens para a IA'
  },
  {
    step: 4,
    title: '4. Conferir Composição',
    subtitle: 'Revisar encaixe e sangria'
  },
  {
    step: 5,
    title: '5. Baixar os 2 PDFs',
    subtitle: 'Impressão + Conferência'
  }
];

const FUNCTION_OPTIONS: { value: RegionFunction; label: string }[] = [
  { value: 'papel_principal', label: 'Papel Digital Principal + Composição Frontal' },
  { value: 'papel_secundario', label: 'Papel Digital Secundário Coordenado' },
  { value: 'barrado', label: 'Barrado / Faixa Decorativa / Telhado' },
  { value: 'lateral', label: 'Lateral / Sanfona Coordenada' },
  { value: 'personagem', label: 'Personagem / Elemento Principal' },
  { value: 'aplique_topper', label: 'Aplique 3D / Topper Escalopado' },
  { value: 'nome_idade', label: 'Nome + Idade Personalizados' },
  { value: 'fundo', label: 'Fundo Sólido / Base' },
  { value: 'moldura', label: 'Moldura / Contorno' }
];

const FIT_MODE_OPTIONS: { value: ImageFitMode; label: string }[] = [
  { value: 'cover', label: 'Preencher Área com Sangria (Cover)' },
  { value: 'repeat', label: 'Repetir Padrão / Ladrilho (Tile)' },
  { value: 'contain', label: 'Centralizar Inteiro (Contain)' }
];

export function App() {
  const [branches, setBranches] = useState<ProductBranch[]>(createInitialBranches);
  const [activeBranchId, setActiveBranchId] = useState<string>('branch-1');
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>('A');
  const [previewMode, setPreviewMode] = useState<'guide_map' | 'print_pdf' | 'proof_pdf'>('proof_pdf');

  // Drawers & Modals (kept tucked away so the main screen stays ultra clean)
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [isDecoderOpen, setIsDecoderOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [quickMappingText, setQuickMappingText] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [auditList, setAuditList] = useState<QualityCheckItem[]>([]);
  const [aiStatusBanner, setAiStatusBanner] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => getSavedGeminiApiKey());
  const [showApiKeyConfig, setShowApiKeyConfig] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiProgressText, setAiProgressText] = useState<string>('');
  const [aiProgressStep, setAiProgressStep] = useState<number>(0);
  const [aiProgressTotal, setAiProgressTotal] = useState<number>(1);
  const [activeSingleAiRegionId, setActiveSingleAiRegionId] = useState<string | null>(null);

  // Windows Fonts & Interactive Name/Age Drag & Resize State
  const [windowsFonts, setWindowsFonts] = useState<string[]>(() => detectInstalledWindowsFonts());
  const [fontSearchQuery, setFontSearchQuery] = useState<string>('');
  const [isLoadingLocalFonts, setIsLoadingLocalFonts] = useState<boolean>(false);
  const [nativeFontsLoaded, setNativeFontsLoaded] = useState<boolean>(false);
  const [showTextGizmos, setShowTextGizmos] = useState<boolean>(true);
  const [activeTextTarget, setActiveTextTarget] = useState<'name' | 'age' | null>(null);
  const [hoveredTextTarget, setHoveredTextTarget] = useState<'name' | 'age' | null>(null);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');

  const dragStateRef = useRef<{
    mode: 'move' | 'resize';
    target: 'name' | 'age';
    startMouseX: number;
    startMouseY: number;
    startCx: number;
    startCy: number;
    startScale: number;
    baseDist: number;
  } | null>(null);
  const customFontInputRef = useRef<HTMLInputElement | null>(null);

  const stepCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const printFinalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proofFinalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const multiRefInputRef = useRef<HTMLInputElement | null>(null);
  const regionFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];

  const updateActiveBranch = (updater: (b: ProductBranch) => ProductBranch) => {
    setBranches(prev => prev.map(b => (b.id === activeBranch.id ? updater(b) : b)));
  };

  // Switch default preview mode sensibly when changing wizard steps
  useEffect(() => {
    if (wizardStep === 1 || wizardStep === 2) {
      setPreviewMode('guide_map');
    } else if (wizardStep === 3 || wizardStep === 4) {
      setPreviewMode('proof_pdf');
    }
  }, [wizardStep]);

  // Render active canvas on Steps 1..4 and dual canvases on Step 5
  useEffect(() => {
    const tpl = activeBranch.template;
    if (!tpl) return;

    if (wizardStep === 5) {
      if (printFinalCanvasRef.current) {
        renderTemplateToCanvas(printFinalCanvasRef.current, tpl, activeBranch.themeConfig, 'print_pdf', selectedRegionId);
      }
      if (proofFinalCanvasRef.current) {
        renderTemplateToCanvas(proofFinalCanvasRef.current, tpl, activeBranch.themeConfig, 'proof_pdf', selectedRegionId);
      }
    } else {
      if (stepCanvasRef.current) {
        const modeToRender = wizardStep === 1 || wizardStep === 2 ? 'guide_map' : previewMode;
        renderTemplateToCanvas(
          stepCanvasRef.current,
          tpl,
          activeBranch.themeConfig,
          modeToRender,
          selectedRegionId,
          {
            showTextGizmos: showTextGizmos && (wizardStep === 3 || wizardStep === 4),
            activeTarget: activeTextTarget,
            hoveredTarget: hoveredTextTarget
          }
        );
      }
    }
  }, [activeBranch, wizardStep, previewMode, selectedRegionId, showTextGizmos, activeTextTarget, hoveredTextTarget]);

  // Pull 100% of installed Windows fonts via Local Font Access API + Canvas detector
  const handleLoadAllWindowsFonts = async () => {
    setIsLoadingLocalFonts(true);
    try {
      const res = await queryAllWindowsLocalFonts();
      setWindowsFonts(res.fonts);
      setNativeFontsLoaded(res.usedNativeApi);
      setAiStatusBanner(
        res.usedNativeApi
          ? `🖥️ ${res.fonts.length} fontes instaladas no seu Windows foram carregadas com sucesso!`
          : `🖥️ ${res.fonts.length} fontes instaladas no seu Windows detectadas e prontas para uso!`
      );
    } finally {
      setIsLoadingLocalFonts(false);
    }
  };

  // Load a custom .TTF / .OTF / .WOFF font file directly from the user's computer
  const handleCustomFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const cleanName = file.name.replace(/\.(ttf|otf|woff2?|eot)$/i, '').replace(/[-_]+/g, ' ').trim();
      const buffer = await file.arrayBuffer();
      const fontFace = new FontFace(cleanName, buffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      setWindowsFonts(prev => (prev.includes(cleanName) ? prev : [cleanName, ...prev]));
      updateActiveBranch(b => ({
        ...b,
        themeConfig: {
          ...b.themeConfig,
          fontFamily: cleanName
        }
      }));
      setAiStatusBanner(`🔤 Fonte "${cleanName}" carregada e aplicada ao Nome e Idade!`);
    } catch (err) {
      alert('Não foi possível carregar o arquivo de fonte: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Reset Name & Age position and scale back to the automatic template anchor
  const handleResetTextPositionAndSize = () => {
    updateActiveBranch(b => ({
      ...b,
      themeConfig: {
        ...b.themeConfig,
        namePosX: undefined,
        namePosY: undefined,
        nameScale: 1.0,
        agePosX: undefined,
        agePosY: undefined,
        ageScale: 1.0
      }
    }));
    setAiStatusBanner('↺ Posição e tamanho do Nome e Idade restaurados para o centro original do molde!');
  };

  // Convert Mouse / Pointer event coordinates to 1000x1000 Canvas space
  const getCanvasNormalizedPoint = (
    canvas: HTMLCanvasElement,
    clientX: number,
    clientY: number
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1000 / Math.max(1, rect.width);
    const scaleY = 1000 / Math.max(1, rect.height);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((wizardStep !== 3 && wizardStep !== 4) || !activeBranch.template || !stepCanvasRef.current) return;
    if (previewMode === 'guide_map') return;

    const pt = getCanvasNormalizedPoint(stepCanvasRef.current, e.clientX, e.clientY);
    const { nameBox, ageBox } = getTitleAndAgeBoxes(activeBranch.template, activeBranch.themeConfig);

    // 1. Check resize handles first (corner circle ⤡)
    const checkResizeHit = (box: typeof nameBox) => {
      if (!box) return false;
      return Math.hypot(pt.x - box.handleX, pt.y - box.handleY) <= box.handleRadius + 8;
    };

    // 2. Check move box hit
    const checkMoveHit = (box: typeof nameBox) => {
      if (!box) return false;
      return pt.x >= box.x - 6 && pt.x <= box.x + box.w + 6 && pt.y >= box.y - 6 && pt.y <= box.y + box.h + 6;
    };

    if (checkResizeHit(ageBox) && ageBox) {
      e.preventDefault();
      setActiveTextTarget('age');
      setCanvasCursor('nwse-resize');
      dragStateRef.current = {
        mode: 'resize',
        target: 'age',
        startMouseX: pt.x,
        startMouseY: pt.y,
        startCx: ageBox.cx,
        startCy: ageBox.cy,
        startScale: activeBranch.themeConfig.ageScale ?? 1.0,
        baseDist: Math.max(25, Math.hypot(pt.x - ageBox.cx, pt.y - ageBox.cy))
      };
      return;
    }

    if (checkResizeHit(nameBox) && nameBox) {
      e.preventDefault();
      setActiveTextTarget('name');
      setCanvasCursor('nwse-resize');
      dragStateRef.current = {
        mode: 'resize',
        target: 'name',
        startMouseX: pt.x,
        startMouseY: pt.y,
        startCx: nameBox.cx,
        startCy: nameBox.cy,
        startScale: activeBranch.themeConfig.nameScale ?? 1.0,
        baseDist: Math.max(25, Math.hypot(pt.x - nameBox.cx, pt.y - nameBox.cy))
      };
      return;
    }

    if (checkMoveHit(ageBox) && ageBox) {
      e.preventDefault();
      setActiveTextTarget('age');
      setCanvasCursor('grabbing');
      dragStateRef.current = {
        mode: 'move',
        target: 'age',
        startMouseX: pt.x,
        startMouseY: pt.y,
        startCx: ageBox.cx,
        startCy: ageBox.cy,
        startScale: activeBranch.themeConfig.ageScale ?? 1.0,
        baseDist: 100
      };
      return;
    }

    if (checkMoveHit(nameBox) && nameBox) {
      e.preventDefault();
      setActiveTextTarget('name');
      setCanvasCursor('grabbing');
      dragStateRef.current = {
        mode: 'move',
        target: 'name',
        startMouseX: pt.x,
        startMouseY: pt.y,
        startCx: nameBox.cx,
        startCy: nameBox.cy,
        startScale: activeBranch.themeConfig.nameScale ?? 1.0,
        baseDist: 100
      };
      return;
    }

    setActiveTextTarget(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if ((wizardStep !== 3 && wizardStep !== 4) || !activeBranch.template || !stepCanvasRef.current) return;
    if (previewMode === 'guide_map') return;

    const pt = getCanvasNormalizedPoint(stepCanvasRef.current, e.clientX, e.clientY);
    const drag = dragStateRef.current;

    if (drag) {
      e.preventDefault();
      if (drag.mode === 'move') {
        const nextCx = Math.max(30, Math.min(970, Math.round(drag.startCx + (pt.x - drag.startMouseX))));
        const nextCy = Math.max(30, Math.min(970, Math.round(drag.startCy + (pt.y - drag.startMouseY))));

        updateActiveBranch(b => ({
          ...b,
          themeConfig:
            drag.target === 'name'
              ? {
                  ...b.themeConfig,
                  namePosX: nextCx,
                  namePosY: nextCy
                }
              : {
                  ...b.themeConfig,
                  agePosX: nextCx,
                  agePosY: nextCy
                }
        }));
      } else if (drag.mode === 'resize') {
        const currentDist = Math.max(15, Math.hypot(pt.x - drag.startCx, pt.y - drag.startCy));
        const ratio = currentDist / drag.baseDist;
        const nextScale = Number(Math.max(0.25, Math.min(4.0, drag.startScale * ratio)).toFixed(2));

        updateActiveBranch(b => ({
          ...b,
          themeConfig:
            drag.target === 'name'
              ? { ...b.themeConfig, nameScale: nextScale }
              : { ...b.themeConfig, ageScale: nextScale }
        }));
      }
      return;
    }

    // Hover feedback when not dragging
    const { nameBox, ageBox } = getTitleAndAgeBoxes(activeBranch.template, activeBranch.themeConfig);
    const hitAgeHandle = ageBox && Math.hypot(pt.x - ageBox.handleX, pt.y - ageBox.handleY) <= ageBox.handleRadius + 8;
    const hitNameHandle = nameBox && Math.hypot(pt.x - nameBox.handleX, pt.y - nameBox.handleY) <= nameBox.handleRadius + 8;
    const hitAgeBox =
      ageBox && pt.x >= ageBox.x - 6 && pt.x <= ageBox.x + ageBox.w + 6 && pt.y >= ageBox.y - 6 && pt.y <= ageBox.y + ageBox.h + 6;
    const hitNameBox =
      nameBox && pt.x >= nameBox.x - 6 && pt.x <= nameBox.x + nameBox.w + 6 && pt.y >= nameBox.y - 6 && pt.y <= nameBox.y + nameBox.h + 6;

    if (hitAgeHandle) {
      setHoveredTextTarget('age');
      setCanvasCursor('nwse-resize');
    } else if (hitNameHandle) {
      setHoveredTextTarget('name');
      setCanvasCursor('nwse-resize');
    } else if (hitAgeBox) {
      setHoveredTextTarget('age');
      setCanvasCursor('grab');
    } else if (hitNameBox) {
      setHoveredTextTarget('name');
      setCanvasCursor('grab');
    } else {
      if (hoveredTextTarget !== null) setHoveredTextTarget(null);
      if (canvasCursor !== 'default') setCanvasCursor('default');
    }
  };

  const handleCanvasMouseUp = () => {
    if (dragStateRef.current) {
      dragStateRef.current = null;
      setCanvasCursor(hoveredTextTarget ? 'grab' : 'default');
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if ((wizardStep !== 3 && wizardStep !== 4) || !activeBranch.template || !stepCanvasRef.current) return;
    if (previewMode === 'guide_map') return;

    const pt = getCanvasNormalizedPoint(stepCanvasRef.current, e.clientX, e.clientY);
    const { nameBox, ageBox } = getTitleAndAgeBoxes(activeBranch.template, activeBranch.themeConfig);

    const hitAge =
      ageBox && pt.x >= ageBox.x - 10 && pt.x <= ageBox.x + ageBox.w + 10 && pt.y >= ageBox.y - 10 && pt.y <= ageBox.y + ageBox.h + 10;
    const hitName =
      nameBox && pt.x >= nameBox.x - 10 && pt.x <= nameBox.x + nameBox.w + 10 && pt.y >= nameBox.y - 10 && pt.y <= nameBox.y + nameBox.h + 10;

    if (!hitAge && !hitName) return;
    e.preventDefault();

    const delta = e.deltaY < 0 ? 0.08 : -0.08;
    const target: 'name' | 'age' = hitAge ? 'age' : 'name';
    setActiveTextTarget(target);

    updateActiveBranch(b => {
      const currentScale = target === 'name' ? (b.themeConfig.nameScale ?? 1.0) : (b.themeConfig.ageScale ?? 1.0);
      const nextScale = Number(Math.max(0.25, Math.min(4.0, currentScale + delta)).toFixed(2));
      return {
        ...b,
        themeConfig:
          target === 'name'
            ? { ...b.themeConfig, nameScale: nextScale }
            : { ...b.themeConfig, ageScale: nextScale }
      };
    });
  };

  // Keep quality audit updated
  useEffect(() => {
    if (activeBranch.template) {
      exportDualPdfs(activeBranch.template, activeBranch.themeConfig).then(res => {
        setAuditList(res.auditChecklist);
      });
    }
  }, [activeBranch.id, activeBranch.template, activeBranch.themeConfig]);

  const nowTime = () => {
    const d = new Date();
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  // Load one of the 5 Official Templates
  const handleSelectOfficialTemplate = (templateId: string, asLinesOnly = false, autoAdvance = true) => {
    const base = OFFICIAL_TEMPLATES.find(t => t.id === templateId) || OFFICIAL_TEMPLATES[0];
    const chosen = asLinesOnly
      ? cloneTemplateAsLinesOnly(base)
      : JSON.parse(JSON.stringify(base));

    const userMsg: ChatMessage = {
      id: `u-pdf-${Date.now()}`,
      sender: 'user',
      timestamp: nowTime(),
      text: `📎 PDF Oficial Selecionado: ${chosen.name} (${chosen.widthMm}×${chosen.heightMm}mm · ${chosen.orientation})`,
      stateAtTime: 'ANALYZING_PDF',
      commandBadge: asLinesOnly ? 'MOLDE EM LINHAS' : 'MAPA COLORIDO'
    };

    const botMsg: ChatMessage = {
      id: `b-pdf-${Date.now() + 1}`,
      sender: 'bot',
      timestamp: nowTime(),
      text: `${EXACT_MESSAGES.REGION_OPENING}\n\n${EXACT_MESSAGES.SINGLE_QUESTION}`,
      stateAtTime: 'WAITING_REGION_MEANINGS',
      detectedRegionsTable: chosen.regions
    };

    updateActiveBranch(b => ({
      ...b,
      state: 'WAITING_REGION_MEANINGS',
      template: chosen,
      mapConfirmed: false,
      messages: [...b.messages, userMsg, botMsg]
    }));
    setSelectedRegionId(chosen.regions[0]?.id || 'A');
    if (autoAdvance) {
      setWizardStep(2);
    }
  };

  // Handle Real External PDF File Upload
  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const analyzedSpec = await analyzeUploadedPdfFile(file, 1);
      const userMsg: ChatMessage = {
        id: `u-up-${Date.now()}`,
        sender: 'user',
        timestamp: nowTime(),
        text: `📎 PDF Oficial Enviado: ${file.name} (${analyzedSpec.pageCount} pág. · ${analyzedSpec.widthMm}×${analyzedSpec.heightMm}mm · ${analyzedSpec.orientation})`,
        stateAtTime: 'ANALYZING_PDF',
        commandBadge: 'UPLOAD PDF REAL'
      };
      const botMsg: ChatMessage = {
        id: `b-up-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: `${EXACT_MESSAGES.REGION_OPENING}\n\n${EXACT_MESSAGES.SINGLE_QUESTION}`,
        stateAtTime: 'WAITING_REGION_MEANINGS',
        detectedRegionsTable: analyzedSpec.regions
      };

      updateActiveBranch(b => ({
        ...b,
        state: 'WAITING_REGION_MEANINGS',
        template: analyzedSpec,
        mapConfirmed: false,
        messages: [...b.messages, userMsg, botMsg]
      }));
      setSelectedRegionId(analyzedSpec.regions[0]?.id || 'A');
      setWizardStep(2);
    } catch (err) {
      alert('Erro ao analisar o PDF enviado: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      e.target.value = '';
    }
  };

  // Handle Multi-Reference Images Upload for AI Auto-Fill & Complement (Step 3)
  const handleMultipleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const newRefs: ReferenceImageItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const dataUrl = await new Promise<string>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      const palette = await extractPaletteFromImage(dataUrl);

      newRefs.push({
        id: `ref-${Date.now()}-${i}`,
        name: file.name,
        dataUrl,
        role: 'auto',
        extractedPalette: palette,
        isAiGenerated: false
      });
    }

    const existingUserRefs = (activeBranch.themeConfig.referenceImages || []).filter(r => !r.isAiGenerated);
    const combinedRefs = [...existingUserRefs, ...newRefs];

    if (!activeBranch.template) {
      updateActiveBranch(b => ({
        ...b,
        themeConfig: { ...b.themeConfig, referenceImages: combinedRefs }
      }));
      return;
    }

    // Automatically trigger the AI Map Engine to create & complement all regions from the reference image(s)
    setIsAiGenerating(true);
    try {
      const result = await runFullAiMapAutoFillAndCreate({
        template: activeBranch.template,
        refImages: combinedRefs,
        currentTheme: activeBranch.themeConfig,
        apiKey: geminiApiKey,
        onProgress: (text, step, total) => {
          setAiProgressText(text);
          setAiProgressStep(step);
          setAiProgressTotal(total);
        }
      });

      updateActiveBranch(b => {
        if (!b.template) return b;
        return {
          ...b,
          state: 'BUILDING_MAP',
          template: { ...b.template, regions: result.updatedRegions },
          themeConfig: result.updatedTheme
        };
      });

      setPreviewMode('proof_pdf');
      setAiStatusBanner(
        result.usedRealGeminiApi
          ? `✨ IA Gemini (3.8 Flash + Nano Banana 2.1) analisou sua referência e criou/complementou as imagens de todas as ${result.updatedRegions.length} áreas seguindo o JSON Método MAP!`
          : `✨ Motor IA Método MAP analisou sua referência e criou/complementou imagens coordenadas exclusivas para todas as ${result.updatedRegions.length} áreas do molde!`
      );
    } finally {
      setIsAiGenerating(false);
      setAiProgressText('');
    }
  };

  // Upload a Reference Image directly to a specific Region (A, B, C...)
  const handleSingleRegionImageUpload = (regionId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      const palette = await extractPaletteFromImage(dataUrl);
      const refItem: ReferenceImageItem = {
        id: `ref-reg-${Date.now()}`,
        name: file.name,
        dataUrl,
        role: 'auto',
        extractedPalette: palette,
        isAiGenerated: false
      };

      updateActiveBranch(b => {
        if (!b.template) return b;
        const nextRefs = [...(b.themeConfig.referenceImages || []), refItem];
        return {
          ...b,
          template: {
            ...b.template,
            regions: b.template.regions.map(r =>
              r.id === regionId
                ? {
                    ...r,
                    customAssetDataUrl: dataUrl,
                    customAssetName: file.name,
                    imageFitMode: r.imageFitMode || 'cover',
                    assignedContent: `Imagem de Referência: ${file.name}`,
                    isAiCreated: false
                  }
                : r
            )
          },
          themeConfig: {
            ...b.themeConfig,
            referenceImages: nextRefs,
            namePrimaryColor: palette[0] || b.themeConfig.namePrimaryColor
          }
        };
      });

      setPreviewMode('proof_pdf');
      setAiStatusBanner(`📷 Imagem "${file.name}" aplicada diretamente na Área ${regionId} com sangria automática!`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Assign an already-uploaded Reference Image from the gallery to a specific Region
  const handleAssignGalleryImageToRegion = (refImg: ReferenceImageItem, regionId: string) => {
    updateActiveBranch(b => {
      if (!b.template) return b;
      return {
        ...b,
        template: {
          ...b.template,
          regions: b.template.regions.map(r =>
            r.id === regionId
              ? {
                  ...r,
                  customAssetDataUrl: refImg.dataUrl,
                  customAssetName: refImg.name,
                  imageFitMode: r.imageFitMode || 'cover',
                  assignedContent: refImg.isAiGenerated
                    ? `Arte criada por IA (${refImg.name})`
                    : `Imagem de Referência: ${refImg.name}`,
                  isAiCreated: Boolean(refImg.isAiGenerated)
                }
              : r
          )
        }
      };
    });
    setPreviewMode('proof_pdf');
    setAiStatusBanner(`✨ Imagem "${refImg.name}" vinculada à Área ${regionId}!`);
  };

  // Trigger Full AI Auto-Fill & Image Creation across all regions following the Método MAP JSON
  const handleRunAiAutoFill = async () => {
    const refs = activeBranch.themeConfig.referenceImages || [];
    if (refs.length === 0) {
      multiRefInputRef.current?.click();
      return;
    }
    if (!activeBranch.template) return;

    setIsAiGenerating(true);
    try {
      const result = await runFullAiMapAutoFillAndCreate({
        template: activeBranch.template,
        refImages: refs,
        currentTheme: activeBranch.themeConfig,
        apiKey: geminiApiKey,
        onProgress: (text, step, total) => {
          setAiProgressText(text);
          setAiProgressStep(step);
          setAiProgressTotal(total);
        }
      });

      updateActiveBranch(b => {
        if (!b.template) return b;
        return {
          ...b,
          state: 'BUILDING_MAP',
          template: { ...b.template, regions: result.updatedRegions },
          themeConfig: result.updatedTheme
        };
      });

      setPreviewMode('proof_pdf');
      setAiStatusBanner(
        result.usedRealGeminiApi
          ? `✨ IA Gemini (3.8 Flash + Nano Banana 2.1) analisou a referência e criou/complementou todas as áreas (${result.updatedRegions.map(r => r.id).join(', ')}) respeitando o JSON Método MAP!`
          : `✨ Motor IA Método MAP analisou a referência e criou/complementou artes exclusivas para todas as áreas (${result.updatedRegions.map(r => r.id).join(', ')}) seguindo o JSON Método MAP!`
      );
    } finally {
      setIsAiGenerating(false);
      setAiProgressText('');
    }
  };

  // Trigger AI Image Creation / Complementing for a single specific region (A, B, C...)
  const handleRunSingleRegionAi = async (regionId: string, regionIndex: number) => {
    if (!activeBranch.template) return;
    const targetRegion = activeBranch.template.regions.find(r => r.id === regionId);
    if (!targetRegion) return;

    const refs = activeBranch.themeConfig.referenceImages || [];
    if (refs.length === 0) {
      multiRefInputRef.current?.click();
      return;
    }

    setActiveSingleAiRegionId(regionId);
    try {
      const res = await runSingleRegionAiCreate({
        region: targetRegion,
        regionIndex,
        template: activeBranch.template,
        refImages: refs,
        currentTheme: activeBranch.themeConfig,
        apiKey: geminiApiKey
      });

      updateActiveBranch(b => {
        if (!b.template) return b;
        const otherRefs = (b.themeConfig.referenceImages || []).filter(
          item => !(item.isAiGenerated && item.targetRegionId === regionId)
        );
        return {
          ...b,
          state: 'BUILDING_MAP',
          template: {
            ...b.template,
            regions: b.template.regions.map(r => (r.id === regionId ? res.updatedRegion : r))
          },
          themeConfig: {
            ...b.themeConfig,
            referenceImages: [...otherRefs, res.generatedRefItem]
          }
        };
      });

      setPreviewMode('proof_pdf');
      setAiStatusBanner(
        `✨ IA criou e complementou uma nova arte exclusiva para a Área ${regionId} (${targetRegion.assignedFunction.replace(/_/g, ' ')}) seguindo sua referência!`
      );
    } finally {
      setActiveSingleAiRegionId(null);
    }
  };

  // Upload Character PNG isolated overlay
  const handleCharacterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      updateActiveBranch(b => ({
        ...b,
        themeConfig: {
          ...b.themeConfig,
          uploadedCharacterPng: dataUrl,
          showCharacterOverlay: true
        }
      }));
      setAiStatusBanner(`✨ Personagem/Elemento "${file.name}" adicionado em destaque sobre a face principal!`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Execute Chatbot / MAP Command
  const handleSendCommand = async (overrideText?: string) => {
    const raw = (overrideText ?? chatInput).trim();
    if (!raw) return;
    if (!overrideText) setChatInput('');

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: nowTime(),
      text: raw,
      stateAtTime: activeBranch.state
    };

    if (isDisclosureAttempt(raw)) {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: EXACT_MESSAGES.DISCLOSURE_RESPONSE,
        stateAtTime: activeBranch.state,
        commandBadge: 'PROTEÇÃO DE SIGILO'
      };
      updateActiveBranch(b => ({ ...b, messages: [...b.messages, userMsg, botMsg] }));
      return;
    }

    if (isActivationCommand(raw)) {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: EXACT_MESSAGES.FIRST_RESPONSE,
        stateAtTime: 'WAITING_PDF',
        commandBadge: 'MÉTODO MAP INICIADO'
      };
      updateActiveBranch(b => ({
        ...b,
        state: 'WAITING_PDF',
        messages: [...b.messages, { ...userMsg, commandBadge: 'ATIVAR MAP' }, botMsg]
      }));
      setWizardStep(1);
      return;
    }

    if (raw.toUpperCase().includes('TROCAR MOLDE OFICIAL')) {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: EXACT_MESSAGES.FIRST_RESPONSE,
        stateAtTime: 'WAITING_PDF',
        commandBadge: 'TROCAR MOLDE OFICIAL'
      };
      updateActiveBranch(b => ({
        ...b,
        state: 'WAITING_PDF',
        mapConfirmed: false,
        messages: [...b.messages, { ...userMsg, commandBadge: 'TROCAR MOLDE OFICIAL' }, botMsg]
      }));
      setWizardStep(1);
      return;
    }

    if (raw.toUpperCase().includes('NOVA ARTE COM O MESMO MAPA')) {
      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: `Molde oficial (${activeBranch.template?.name}) e Mapa de Composição preservados! Envie as novas imagens de referência ou altere Nome e Idade na Etapa 3.`,
        stateAtTime: 'BUILDING_MAP',
        commandBadge: 'NOVA ARTE COM O MESMO MAPA'
      };
      updateActiveBranch(b => ({
        ...b,
        state: 'BUILDING_MAP',
        messages: [...b.messages, { ...userMsg, commandBadge: 'NOVA ARTE COM O MESMO MAPA' }, botMsg]
      }));
      setWizardStep(3);
      return;
    }

    if (raw.toUpperCase().includes('CONFIRMAR MAPA') && activeBranch.template) {
      const { updatedRegions, updatedTheme } = parseUserRegionDefinitions(
        raw,
        activeBranch.template.regions,
        activeBranch.themeConfig
      );
      const updatedTemplate = {
        ...activeBranch.template,
        regions: updatedRegions
      };
      const exported = await exportDualPdfs(updatedTemplate, updatedTheme);
      setAuditList(exported.auditChecklist);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: `${EXACT_MESSAGES.MAP_CONFIRMED_START}\n\n✔ Os 2 PDFs obrigatórios (Impressão + Conferência) estão prontos na Etapa 5.`,
        stateAtTime: 'READY',
        compositionSummary: updatedRegions,
        auditChecklist: exported.auditChecklist,
        commandBadge: 'CONFIRMAR MAPA'
      };

      updateActiveBranch(b => ({
        ...b,
        state: 'READY',
        mapConfirmed: true,
        template: updatedTemplate,
        themeConfig: updatedTheme,
        lastPrintPdfUrl: exported.printPdfBlobUrl,
        lastProofPdfUrl: exported.proofPdfBlobUrl,
        messages: [...b.messages, { ...userMsg, commandBadge: 'CONFIRMAR MAPA' }, botMsg]
      }));
      setWizardStep(5);
      return;
    }

    if (activeBranch.template) {
      const { updatedRegions, updatedTheme } = parseUserRegionDefinitions(
        raw,
        activeBranch.template.regions,
        activeBranch.themeConfig
      );
      const updatedTemplate = {
        ...activeBranch.template,
        regions: updatedRegions
      };
      const botMsg: ChatMessage = {
        id: `bot-${Date.now() + 1}`,
        sender: 'bot',
        timestamp: nowTime(),
        text: `Mapa de Composição atualizado!\n\n${EXACT_MESSAGES.ASK_CONFIRM_MAP}`,
        stateAtTime: 'BUILDING_MAP',
        compositionSummary: updatedRegions
      };
      updateActiveBranch(b => ({
        ...b,
        state: 'BUILDING_MAP',
        template: updatedTemplate,
        themeConfig: updatedTheme,
        messages: [...b.messages, userMsg, botMsg]
      }));
    }
  };

  // Create a new isolated Product Branch
  const handleCreateBranch = () => {
    const idx = branches.length + 1;
    const newBranch: ProductBranch = {
      id: `branch-${Date.now()}`,
      name: `PRODUTO ${idx}`,
      productType: 'Novo Molde',
      createdAt: nowTime(),
      state: 'WAITING_PDF',
      template: JSON.parse(JSON.stringify(OFFICIAL_TEMPLATES[0])),
      themeConfig: { ...DEFAULT_THEME, referenceImages: [] },
      mapConfirmed: false,
      messages: [
        {
          id: `nb-${Date.now()}`,
          sender: 'bot',
          timestamp: nowTime(),
          text: EXACT_MESSAGES.FIRST_RESPONSE,
          stateAtTime: 'WAITING_PDF',
          commandBadge: 'NOVO BRAÇO'
        }
      ]
    };
    setBranches(prev => [...prev, newBranch]);
    setActiveBranchId(newBranch.id);
    setWizardStep(1);
  };

  // Download Print PDF and/or Proof PDF
  const handleDownloadPdf = async (which: 'print' | 'proof' | 'both') => {
    if (!activeBranch.template) return;
    setIsExporting(true);
    try {
      const res = await exportDualPdfs(activeBranch.template, activeBranch.themeConfig);
      setAuditList(res.auditChecklist);
      const slug = activeBranch.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      if (which === 'print' || which === 'both') {
        const a1 = document.createElement('a');
        a1.href = res.printPdfBlobUrl;
        a1.download = `${slug}_${activeBranch.themeConfig.childName.toLowerCase()}_1_IMPRESSAO.pdf`;
        a1.click();
      }
      if (which === 'proof' || which === 'both') {
        setTimeout(() => {
          const a2 = document.createElement('a');
          a2.href = res.proofPdfBlobUrl;
          a2.download = `${slug}_${activeBranch.themeConfig.childName.toLowerCase()}_2_CONFERENCIA.pdf`;
          a2.click();
        }, 250);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const refImages = activeBranch.themeConfig.referenceImages || [];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-800 flex flex-col">
      {/* Hidden File Inputs */}
      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        onChange={handlePdfFileUpload}
        className="hidden"
      />
      <input
        ref={multiRefInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleMultipleReferenceUpload}
        className="hidden"
      />

      {/* Top Clean Navigation Header */}
      <header className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand + Active Product Branch Selector */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-sm font-black text-white text-sm tracking-tight">
              MAP
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm sm:text-base">ArtFlix Studio</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 font-semibold">
                  Método MAP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Fluxo guiado passo a passo · Preenchimento inteligente no molde
              </p>
            </div>

            {/* Clean Product Branch Switcher */}
            <div className="hidden md:flex items-center gap-1.5 ml-3 pl-3 border-l border-slate-200">
              <FolderGit2 className="w-3.5 h-3.5 text-orange-500" />
              <select
                value={activeBranch.id}
                onChange={e => setActiveBranchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-orange-400"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    🌿 {b.name} ({b.template?.name.replace(' (Com Mapa Geométrico)', '')})
                  </option>
                ))}
              </select>
              <button
                onClick={handleCreateBranch}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-600 border border-slate-200 transition"
                title="Criar novo braço para outro produto"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Right Utility Actions (Tucked cleanly away) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsChatDrawerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Cpu className="w-3.5 h-3.5 text-orange-500" />
              <span>Console Comandos</span>
            </button>
            <button
              onClick={() => setIsDecoderOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-600 border border-slate-200 transition"
              title="Inspecionar JSON Oficial do Método MAP"
            >
              <FileCode2 className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Clean 5-Step Wizard Bar */}
        <div className="bg-slate-50/80 border-t border-slate-200/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {WIZARD_STEPS.map(s => {
              const isCurrent = wizardStep === s.step;
              const isCompleted = wizardStep > s.step;
              return (
                <button
                  key={s.step}
                  onClick={() => setWizardStep(s.step)}
                  className={`text-left px-3 py-2 rounded-xl border transition flex items-center gap-2.5 ${
                    isCurrent
                      ? 'bg-white border-orange-400 shadow-xs ring-2 ring-orange-500/10'
                      : isCompleted
                        ? 'bg-emerald-50/60 border-emerald-200 hover:bg-white'
                        : 'bg-white/60 border-slate-200/80 hover:bg-white opacity-75 hover:opacity-100'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-orange-500 text-white'
                        : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isCompleted ? '✓' : s.step}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-xs font-bold truncate ${
                        isCurrent ? 'text-orange-700' : isCompleted ? 'text-emerald-800' : 'text-slate-700'
                      }`}
                    >
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate hidden md:block">{s.subtitle}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Dedicated Screen Area (1 Screen Per Step) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* =====================================================================
            TELA 1: ESCOLHER OU ENVIAR O MOLDE OFICIAL (PDF)
           ===================================================================== */}
        {wizardStep === 1 && (
          <div className="space-y-8">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">
                ETAPA 1 DE 5 · MOLDE OFICIAL
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Envie ou escolha o Molde Oficial em PDF
              </h1>
              <p className="text-sm text-slate-600">
                O sistema preserva 100% das medidas físicas, linhas de corte/dobra, furos, QR Code e marcas de registro do seu molde.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Upload PDF or Pick from 5 Official Templates */}
              <div className="lg:col-span-7 space-y-5">
                {/* Big Clean Dropzone to Upload User's Own PDF */}
                <div
                  onClick={() => pdfInputRef.current?.click()}
                  className="bg-white hover:bg-orange-50/40 border-2 border-dashed border-orange-300 rounded-2xl p-8 text-center cursor-pointer transition shadow-xs group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition">
                    <FileUp className="w-7 h-7" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clique para enviar o PDF do seu Molde Oficial
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Aceita tanto <strong>Molde com Mapa Geométrico Colorido (Opção 2)</strong> quanto{' '}
                    <strong>Molde Somente com Linhas (Opção 1)</strong>.
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold shadow-sm">
                    <Upload className="w-4 h-4" />
                    Selecionar Arquivo PDF no Computador
                  </span>
                </div>

                {/* 5 Built-in Official Templates */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Ou escolha um dos 5 Moldes Oficiais já carregados
                      </h3>
                      <p className="text-xs text-slate-500">
                        Moldes oficiais dos arquivos anexados prontos para testar agora:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {OFFICIAL_TEMPLATES.map(t => {
                      const isSelected = activeBranch.template?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`p-3.5 rounded-xl border transition flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-orange-50/70 border-orange-400 shadow-xs'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">
                                {t.name.replace(' (Com Mapa Geométrico)', '')}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                                {t.regions.length} áreas
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {t.widthMm}×{t.heightMm}mm · {t.orientation}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleSelectOfficialTemplate(t.id, false, false)}
                              className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                                isSelected && activeBranch.template?.mode !== 'lines_only'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-white hover:bg-orange-50 text-slate-700 border-slate-200'
                              }`}
                            >
                              🎨 Mapa Colorido
                            </button>
                            <button
                              onClick={() => handleSelectOfficialTemplate(t.id, true, false)}
                              className={`py-1.5 px-2.5 rounded-lg text-[11px] font-semibold border transition ${
                                isSelected && activeBranch.template?.mode === 'lines_only'
                                  ? 'bg-slate-800 text-white border-slate-800'
                                  : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              ✏️ Só Linhas
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Clean Preview of the Selected Mold */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-orange-600 font-bold">
                      MOLDE SELECIONADO ATUALMENTE
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {activeBranch.template?.name}
                    </h3>
                  </div>
                  <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                    {activeBranch.template?.widthMm}×{activeBranch.template?.heightMm}mm
                  </span>
                </div>

                <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex items-center justify-center">
                  <canvas
                    ref={stepCanvasRef}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-xs"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <span>
                    ✔ <strong>{activeBranch.template?.regions.length || 0} áreas</strong> geométricas detectadas
                  </span>
                  <span>✔ QR Code & Marcas protegidos</span>
                </div>

                <button
                  onClick={() => setWizardStep(2)}
                  className="w-full py-3.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/15 transition flex items-center justify-center gap-2"
                >
                  <span>Continuar para Etapa 2: Mapear Áreas do Molde →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TELA 2: LEITURA GEOMÉTRICA E SIGNIFICADO DAS ÁREAS (A, B, C...)
           ===================================================================== */}
        {wizardStep === 2 && activeBranch.template && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase text-orange-600">
                  ETAPA 2 DE 5 · SIGNIFICADO DAS ÁREAS DO MOLDE
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  O que vai em cada área ({activeBranch.template.regions.map(r => r.id).join(', ')})?
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  As cores do PDF servem apenas como guia visual. Confirme ou ajuste a função de cada área abaixo antes de enviar suas imagens de referência.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition"
                >
                  Avançar para Etapa 3: Imagens de Referência →
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Clean Visual Map Canvas */}
              <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs lg:sticky lg:top-32">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Mapa Geométrico Detectado ({activeBranch.template.name})
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Clique em uma área ao lado para destacar
                  </span>
                </div>
                <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
                  <canvas
                    ref={stepCanvasRef}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-xs"
                  />
                </div>
                {/* Quick Text Definition Bar */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <label className="text-[11px] font-semibold text-slate-600 block">
                    Atalho por texto (opcional — igual ao Chatbot MAP):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={quickMappingText}
                      onChange={e => setQuickMappingText(e.target.value)}
                      placeholder="Ex: A = papel principal; B = lateral; C = barrado"
                      className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      onClick={() => {
                        if (!quickMappingText.trim()) return;
                        handleSendCommand(quickMappingText);
                        setQuickMappingText('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>

              {/* Right: Clean Region Cards (A, B, C...) */}
              <div className="lg:col-span-6 space-y-3">
                {activeBranch.template.regions.map(region => {
                  const isSelected = selectedRegionId === region.id;
                  return (
                    <div
                      key={region.id}
                      onClick={() => setSelectedRegionId(region.id)}
                      className={`p-4 rounded-2xl border transition cursor-pointer ${
                        isSelected
                          ? 'bg-white border-orange-400 shadow-sm ring-2 ring-orange-500/10'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 rounded-xl bg-orange-500 text-white font-mono font-bold text-base flex items-center justify-center shrink-0 shadow-2xs">
                            {region.id}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-sm border border-slate-300 shrink-0"
                                style={{ backgroundColor: region.colorHex }}
                              />
                              <span className="text-sm font-bold text-slate-900">
                                Área {region.id} · Cor-guia {region.colorName}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {region.shapeAndLocation} ({region.pageAndFace})
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                          {region.repetitions}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                        <label className="text-xs font-semibold text-slate-700 sm:w-44 shrink-0">
                          O que vai nesta área?
                        </label>
                        <select
                          value={region.assignedFunction}
                          onChange={e => {
                            const newFn = e.target.value as RegionFunction;
                            const labelObj = FUNCTION_OPTIONS.find(o => o.value === newFn);
                            updateActiveBranch(b => {
                              if (!b.template) return b;
                              return {
                                ...b,
                                template: {
                                  ...b.template,
                                  regions: b.template.regions.map(r =>
                                    r.id === region.id
                                      ? {
                                          ...r,
                                          assignedFunction: newFn,
                                          assignedContent: labelObj?.label || r.assignedContent
                                        }
                                      : r
                                  )
                                }
                              };
                            });
                          }}
                          className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-orange-500"
                        >
                          {FUNCTION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setWizardStep(3)}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-md shadow-orange-500/15 transition"
                  >
                    Continuar para Etapa 3: Enviar Imagens de Referência →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TELA 3: ENVIAR IMAGENS DE REFERÊNCIA PARA A IA CRIAR E COMPLEMENTAR O MOLDE
           ===================================================================== */}
        {wizardStep === 3 && activeBranch.template && (
          <div className="space-y-6">
            {/* Step Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase text-orange-600">
                  ETAPA 3 DE 5 · MOTOR DE IA GENERATIVA & IMAGENS DE REFERÊNCIA
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Auto-Preencher, Criar e Complementar Áreas com IA (Método MAP JSON)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Envie 1 ou mais imagens de referência. A IA analisa o estilo, extrai a paleta e cria/complementa automaticamente as imagens de cada área ({activeBranch.template.regions.map(r => r.id).join(', ')}) respeitando o JSON do Método MAP.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setWizardStep(2)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  ← Voltar
                </button>
                <button
                  onClick={() => setWizardStep(4)}
                  className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-sm transition"
                >
                  Avançar para Etapa 4: Conferir Composição →
                </button>
              </div>
            </div>

            {/* Live AI Progress Bar when AI is generating & complementing images */}
            {isAiGenerating && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 animate-spin" />
                    {aiProgressText || 'IA criando e complementando imagens para as áreas do molde...'}
                  </span>
                  <span className="font-mono text-indigo-700">
                    Etapa {aiProgressStep} / {aiProgressTotal}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-indigo-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-orange-500 transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((aiProgressStep / Math.max(1, aiProgressTotal)) * 100))}%`
                    }}
                  />
                </div>
              </div>
            )}

            {aiStatusBanner && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{aiStatusBanner}</span>
                </div>
                <button
                  onClick={() => setAiStatusBanner(null)}
                  className="text-emerald-600 hover:text-emerald-900 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column (7 cols): AI Engine Config + Reference Image Upload + Per-Region AI Creation + Personalization */}
              <div className="lg:col-span-7 space-y-6">
                {/* 1. Reference Images Gallery & Real AI Auto-Fill + Image Complementing */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-orange-500" />
                        1. Imagens de Referência & Motor de Criação IA (Método MAP)
                      </h3>
                      <p className="text-xs text-slate-500">
                        A IA lê sua imagem de referência e <strong>cria/complementa as imagens</strong> para cada área ({activeBranch.template.regions.map(r => r.id).join(', ')}) conforme sua função no JSON do Método MAP.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowApiKeyConfig(prev => !prev)}
                        className={`px-3 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition ${
                          geminiApiKey
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Cpu className="w-3.5 h-3.5" />
                        {geminiApiKey ? 'API Gemini Conectada ✓' : 'Configurar Chave API Gemini'}
                      </button>
                      <button
                        onClick={() => multiRefInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        + Enviar Imagem de Referência
                      </button>
                    </div>
                  </div>

                  {/* Optional Gemini API Key & AI Creative Controls */}
                  {showApiKeyConfig && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">
                          Chave da API Google Gemini (`gemini-3.8-flash` + `gemini-nano-banana-2.1`)
                        </label>
                        <span className="text-[10px] font-mono text-slate-500">
                          Salva localmente no navegador
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={geminiApiKey}
                          onChange={e => {
                            setGeminiApiKey(e.target.value);
                            saveGeminiApiKey(e.target.value);
                          }}
                          placeholder="Cole sua GEMINI_API_KEY (AIzaSy...) para geração em nuvem com Nano Banana 2.1"
                          className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-800"
                        />
                        <button
                          onClick={() => setShowApiKeyConfig(false)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold"
                        >
                          Salvar
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Com chave configurada, usa <strong>Gemini 3.8 Flash</strong> para planejar o JSON Método MAP e <strong>Gemini Nano Banana 2.1</strong> para gerar novas imagens. Sem chave, usa o <strong>Sintetizador Neural Local MAP</strong> que cria papéis secundários, laterais, barrados e toppers a partir dos pixels e paleta da sua referência!
                      </p>
                    </div>
                  )}

                  {/* AI Strategy & Creative Prompt Controls */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3.5 rounded-xl bg-orange-50/40 border border-orange-200/80">
                    <div className="sm:col-span-5">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Modo de Criação da IA nas Áreas ({activeBranch.template.regions.map(r => r.id).join(', ')})
                      </label>
                      <select
                        value={activeBranch.themeConfig.aiStrategyMode || 'complement_all'}
                        onChange={e =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: {
                              ...b.themeConfig,
                              aiStrategyMode: e.target.value as 'complement_all' | 'keep_primary_complement_rest'
                            }
                          }))
                        }
                        className="w-full bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-800"
                      >
                        <option value="complement_all">
                          ✨ Criar e Complementar TODAS as Áreas com IA (Recomendado)
                        </option>
                        <option value="keep_primary_complement_rest">
                          🖼️ Manter Referência na Principal + Criar Complementares nas Demais
                        </option>
                      </select>
                    </div>
                    <div className="sm:col-span-7">
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        Instrução Criativa para a IA Complementar (Opcional)
                      </label>
                      <input
                        type="text"
                        value={activeBranch.themeConfig.aiCreativeInstruction || ''}
                        onChange={e =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: {
                              ...b.themeConfig,
                              aiCreativeInstruction: e.target.value
                            }
                          }))
                        }
                        placeholder="Ex: Seguir a referência, criar poá suave no papel secundário e listras na lateral..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Prominent AI Action Button */}
                  {refImages.length > 0 && (
                    <button
                      onClick={handleRunAiAutoFill}
                      disabled={isAiGenerating}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold shadow-md flex items-center justify-center gap-2 transition disabled:opacity-60"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {isAiGenerating
                          ? 'IA Criando e Complementando Imagens para todas as áreas...'
                          : `✨ Auto-Preencher & Criar Imagens Complementares com IA (Áreas ${activeBranch.template.regions.map(r => r.id).join(', ')})`}
                      </span>
                    </button>
                  )}

                  {refImages.length === 0 ? (
                    <div
                      onClick={() => multiRefInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 hover:border-orange-400 bg-slate-50/70 hover:bg-orange-50/30 rounded-xl p-6 text-center cursor-pointer transition"
                    >
                      <Upload className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                      <div className="text-xs font-bold text-slate-800">
                        Arraste ou clique aqui para enviar sua Imagem de Referência (JPG, PNG, WebP)
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Envie até mesmo 1 única imagem de inspiração! A IA vai criar e complementar as imagens coordenadas para todas as áreas ({activeBranch.template.regions.map(r => r.id).join(', ')}) respeitando o Método MAP.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {refImages.map(refImg => (
                        <div
                          key={refImg.id}
                          className={`p-3 rounded-xl border flex gap-3 items-center ${
                            refImg.isAiGenerated
                              ? 'border-indigo-200 bg-indigo-50/40'
                              : 'border-slate-200 bg-slate-50/60'
                          }`}
                        >
                          <img
                            src={refImg.dataUrl}
                            alt={refImg.name}
                            className="w-16 h-16 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                                  refImg.isAiGenerated
                                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    : 'bg-orange-100 text-orange-800 border border-orange-200'
                                }`}
                              >
                                {refImg.isAiGenerated
                                  ? `✨ CRIADA PELA IA · ÁREA ${refImg.targetRegionId || ''}`
                                  : '📷 SUA REFERÊNCIA'}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-slate-800 truncate" title={refImg.name}>
                              {refImg.name}
                            </div>
                            {/* Extracted Palette Dots */}
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 mr-1">Paleta IA:</span>
                              {refImg.extractedPalette.map((hex, i) => (
                                <span
                                  key={i}
                                  className="w-3 h-3 rounded-full border border-white shadow-2xs"
                                  style={{ backgroundColor: hex }}
                                  title={`Cor extraída: ${hex}`}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                onClick={() =>
                                  handleAssignGalleryImageToRegion(refImg, selectedRegionId || 'A')
                                }
                                className="px-2 py-1 rounded-md bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-bold transition"
                                title={`Aplicar esta imagem na Área ${selectedRegionId || 'A'}`}
                              >
                                Aplicar na Área {selectedRegionId || 'A'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Per-Region Direct Reference Image Assignment & Individual AI Complement (A, B, C...) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-orange-500" />
                        2. Áreas do Molde ({activeBranch.template.regions.map(r => r.id).join(', ')}) · Criar ou Ajustar por Área
                      </h3>
                      <p className="text-xs text-slate-500">
                        Clique em <strong>&ldquo;✨ Criar c/ IA&rdquo;</strong> em qualquer área para a IA gerar uma nova imagem complementar para aquele recorte:
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {activeBranch.template.regions.map((region, rIdx) => {
                      const isSelected = selectedRegionId === region.id;
                      const isSingleLoading = activeSingleAiRegionId === region.id;
                      return (
                        <div
                          key={region.id}
                          onClick={() => setSelectedRegionId(region.id)}
                          className={`p-3.5 rounded-xl border transition flex flex-col gap-2.5 cursor-pointer ${
                            isSelected
                              ? 'bg-orange-50/40 border-orange-400'
                              : 'bg-slate-50/60 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-8 h-8 rounded-lg bg-orange-500 text-white font-mono font-bold text-sm flex items-center justify-center shrink-0">
                                {region.id}
                              </span>
                              {region.customAssetDataUrl ? (
                                <img
                                  src={region.customAssetDataUrl}
                                  alt={region.customAssetName || region.id}
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-300 bg-white shrink-0"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-lg border border-slate-300 flex items-center justify-center text-[10px] font-mono text-slate-600 shrink-0"
                                  style={{ backgroundColor: region.colorHex + '33' }}
                                >
                                  Kit
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900">
                                    Área {region.id} ·{' '}
                                    {FUNCTION_OPTIONS.find(f => f.value === region.assignedFunction)?.label ||
                                      region.assignedFunction}
                                  </span>
                                  {region.isAiCreated && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      ✨ CRIADO PELA IA
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {region.customAssetName
                                    ? `${region.customAssetName}`
                                    : 'Envie uma referência acima para a IA criar a arte desta área'}
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                              <select
                                value={region.imageFitMode || 'cover'}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  const mode = e.target.value as ImageFitMode;
                                  updateActiveBranch(b => {
                                    if (!b.template) return b;
                                    return {
                                      ...b,
                                      template: {
                                        ...b.template,
                                        regions: b.template.regions.map(r =>
                                          r.id === region.id ? { ...r, imageFitMode: mode } : r
                                        )
                                      }
                                    };
                                  });
                                }}
                                className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-700"
                              >
                                {FIT_MODE_OPTIONS.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  handleRunSingleRegionAi(region.id, rIdx);
                                }}
                                disabled={isSingleLoading || isAiGenerating}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1 transition shadow-2xs disabled:opacity-50"
                                title="Usar IA para criar/complementar imagem exclusiva para esta área seguindo a referência"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{isSingleLoading ? 'Criando...' : 'Criar c/ IA'}</span>
                              </button>

                              <input
                                ref={el => {
                                  regionFileInputRefs.current[region.id] = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={e => handleSingleRegionImageUpload(region.id, e)}
                                className="hidden"
                              />
                              <button
                                onClick={e => {
                                  e.stopPropagation();
                                  regionFileInputRefs.current[region.id]?.click();
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-orange-50 text-orange-700 border border-orange-200 text-xs font-semibold flex items-center gap-1 transition shadow-2xs"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Trocar</span>
                              </button>

                              {region.customAssetDataUrl && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    updateActiveBranch(b => {
                                      if (!b.template) return b;
                                      return {
                                        ...b,
                                        template: {
                                          ...b.template,
                                          regions: b.template.regions.map(r =>
                                            r.id === region.id
                                              ? {
                                                  ...r,
                                                  customAssetDataUrl: undefined,
                                                  customAssetName: undefined,
                                                  isAiCreated: false
                                                }
                                              : r
                                          )
                                        }
                                      };
                                    });
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition"
                                  title="Remover imagem desta área"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {region.aiMapRecord && (
                            <div className="text-[10px] font-mono text-slate-600 bg-white/90 px-2.5 py-1.5 rounded-lg border border-slate-200/80">
                              <strong className="text-indigo-700">JSON MAP:</strong> {region.aiMapRecord}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Personalization (Child Name, Age, Windows Fonts, Manual Position & Size on Art, Character PNG Overlay, Preset Kits) */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Palette className="w-4 h-4 text-orange-500" />
                        3. Personalização: Nome, Idade, Fontes do Windows & Tamanho/Posição na Arte
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Escolha qualquer fonte instalada no seu Windows e <strong>arraste ou redimensione o Nome e a Idade diretamente na arte ao lado</strong> (ou pelos controles abaixo).
                      </p>
                    </div>

                    <input
                      ref={customFontInputRef}
                      type="file"
                      accept=".ttf,.otf,.woff,.woff2"
                      onChange={handleCustomFontFileUpload}
                      className="hidden"
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleLoadAllWindowsFonts}
                        disabled={isLoadingLocalFonts}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold flex items-center gap-1.5 transition"
                        title="Consultar 100% das fontes instaladas em C:\Windows\Fonts"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLocalFonts ? 'animate-spin' : ''}`} />
                        <span>
                          {nativeFontsLoaded
                            ? `Fontes do Windows (${windowsFonts.length})`
                            : '🖥️ Puxar Todas as Fontes do Windows'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => customFontInputRef.current?.click()}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-[11px] font-semibold flex items-center gap-1 transition"
                        title="Carregar um arquivo de fonte .TTF ou .OTF do seu computador"
                      >
                        <Plus className="w-3.5 h-3.5 text-orange-500" />
                        <span>Fonte (.TTF/.OTF)</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 1: Name, Age, Bleed */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">Nome da Criança / Título</label>
                      <input
                        type="text"
                        value={activeBranch.themeConfig.childName}
                        onFocus={() => setActiveTextTarget('name')}
                        onChange={e =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: { ...b.themeConfig, childName: e.target.value }
                          }))
                        }
                        className="mt-1 w-full bg-slate-50 border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Idade</label>
                      <input
                        type="text"
                        value={activeBranch.themeConfig.childAge}
                        onFocus={() => setActiveTextTarget('age')}
                        onChange={e =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: { ...b.themeConfig, childAge: e.target.value }
                          }))
                        }
                        className="mt-1 w-full bg-slate-50 border border-slate-300 focus:border-purple-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Sangria (mm)</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="6"
                        value={activeBranch.themeConfig.bleedMm}
                        onChange={e =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: { ...b.themeConfig, bleedMm: parseFloat(e.target.value) || 0 }
                          }))
                        }
                        className="mt-1 w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  {/* Row 2: Windows Installed Fonts Selector + Live Font Preview Grid */}
                  <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span>🔤 Fonte Instalada no Windows ({windowsFonts.length} disponíveis)</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            Atual: {activeBranch.themeConfig.fontFamily}
                          </span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={fontSearchQuery}
                        onChange={e => setFontSearchQuery(e.target.value)}
                        placeholder="🔍 Filtrar fonte do Windows (ex: Cooper, Script, Impact, Comic...)"
                        className="w-full sm:w-64 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Selecionar Fonte Principal (Nome):
                        </label>
                        <select
                          value={activeBranch.themeConfig.fontFamily}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, fontFamily: e.target.value }
                            }))
                          }
                          style={{ fontFamily: `"${activeBranch.themeConfig.fontFamily}", sans-serif` }}
                          className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                        >
                          {windowsFonts
                            .filter(f => !fontSearchQuery.trim() || f.toLowerCase().includes(fontSearchQuery.toLowerCase()))
                            .map(fontName => (
                              <option
                                key={fontName}
                                value={fontName}
                                style={{ fontFamily: `"${fontName}", sans-serif` }}
                              >
                                {fontName} — {activeBranch.themeConfig.childName || 'MARIA'}{' '}
                                {activeBranch.themeConfig.childAge || '3 ANOS'}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600">
                          Fonte da Idade (Mesma do Nome ou separada):
                        </label>
                        <select
                          value={activeBranch.themeConfig.ageFontFamily || ''}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: {
                                ...b.themeConfig,
                                ageFontFamily: e.target.value || undefined
                              }
                            }))
                          }
                          style={{
                            fontFamily: `"${
                              activeBranch.themeConfig.ageFontFamily || activeBranch.themeConfig.fontFamily
                            }", sans-serif`
                          }}
                          className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                        >
                          <option value="">Usar a mesma fonte do Nome ({activeBranch.themeConfig.fontFamily})</option>
                          {windowsFonts
                            .filter(f => !fontSearchQuery.trim() || f.toLowerCase().includes(fontSearchQuery.toLowerCase()))
                            .map(fontName => (
                              <option
                                key={fontName}
                                value={fontName}
                                style={{ fontFamily: `"${fontName}", sans-serif` }}
                              >
                                {fontName} — {activeBranch.themeConfig.childAge || '3 ANOS'}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>

                    {/* Quick Visual Windows Font Gallery (scrollable pills rendered in each Windows font) */}
                    <div className="max-h-32 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
                      {windowsFonts
                        .filter(f => !fontSearchQuery.trim() || f.toLowerCase().includes(fontSearchQuery.toLowerCase()))
                        .slice(0, 48)
                        .map(fontName => {
                          const isSelectedFont = activeBranch.themeConfig.fontFamily === fontName;
                          return (
                            <button
                              key={fontName}
                              type="button"
                              onClick={() =>
                                updateActiveBranch(b => ({
                                  ...b,
                                  themeConfig: { ...b.themeConfig, fontFamily: fontName }
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-lg border text-left transition truncate ${
                                isSelectedFont
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                  : 'bg-white hover:bg-indigo-50/60 text-slate-800 border-slate-200'
                              }`}
                              title={`Aplicar fonte do Windows: ${fontName}`}
                            >
                              <div className="text-[9px] opacity-75 truncate font-sans">{fontName}</div>
                              <div
                                className="text-xs font-bold truncate"
                                style={{ fontFamily: `"${fontName}", sans-serif` }}
                              >
                                {activeBranch.themeConfig.childName || 'MARIA'}
                              </div>
                            </button>
                          );
                        })}
                    </div>

                    {/* Text Colors Row */}
                    <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                      <label className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="color"
                          value={activeBranch.themeConfig.namePrimaryColor || '#EC4899'}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, namePrimaryColor: e.target.value }
                            }))
                          }
                          className="w-6 h-6 rounded border-0 cursor-pointer"
                        />
                        <span className="truncate">Cor do Nome</span>
                      </label>

                      <label className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="color"
                          value={activeBranch.themeConfig.agePrimaryColor || '#A855F7'}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, agePrimaryColor: e.target.value }
                            }))
                          }
                          className="w-6 h-6 rounded border-0 cursor-pointer"
                        />
                        <span className="truncate">Cor da Idade</span>
                      </label>

                      <label className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 cursor-pointer">
                        <input
                          type="color"
                          value={activeBranch.themeConfig.nameOutlineColor || '#6D28D9'}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, nameOutlineColor: e.target.value }
                            }))
                          }
                          className="w-6 h-6 rounded border-0 cursor-pointer"
                        />
                        <span className="truncate">Cor Contorno</span>
                      </label>
                    </div>
                  </div>

                  {/* Row 3: Manual Size & Position Controls for Name and Age (Synchronized with Direct Canvas Drag & Resize) */}
                  {(() => {
                    const { nameBox, ageBox } = getTitleAndAgeBoxes(
                      activeBranch.template,
                      activeBranch.themeConfig
                    );
                    const nameScalePct = Math.round((activeBranch.themeConfig.nameScale ?? 1.0) * 100);
                    const ageScalePct = Math.round((activeBranch.themeConfig.ageScale ?? 1.0) * 100);
                    const curNameX = nameBox?.cx ?? 500;
                    const curNameY = nameBox?.cy ?? 580;
                    const curAgeX = ageBox?.cx ?? curNameX;
                    const curAgeY = ageBox?.cy ?? 640;

                    return (
                      <div className="p-3.5 rounded-xl bg-indigo-50/40 border border-indigo-200/80 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Ruler className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-bold text-slate-900">
                              Tamanho e Posição Manual na Arte (Arraste no Molde ou Ajuste Aqui)
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-indigo-800 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showTextGizmos}
                                onChange={e => setShowTextGizmos(e.target.checked)}
                                className="rounded border-indigo-300 text-indigo-600"
                              />
                              Mostrar Alças (⤡) na Arte
                            </label>
                            <button
                              type="button"
                              onClick={handleResetTextPositionAndSize}
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition"
                              title="Restaurar tamanho e posição padrão do Nome e Idade"
                            >
                              ↺ Resetar Posição/Tamanho
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Controls for NOME */}
                          <div
                            onClick={() => setActiveTextTarget('name')}
                            className={`p-3 rounded-xl border space-y-2 transition ${
                              activeTextTarget === 'name'
                                ? 'bg-white border-indigo-500 shadow-2xs'
                                : 'bg-white/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-indigo-900">
                                ✥ NOME ({nameBox?.fontSize || 38}px · {nameScalePct}%)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        nameScale: Number(
                                          Math.max(0.25, (b.themeConfig.nameScale ?? 1.0) - 0.1).toFixed(2)
                                        )
                                      }
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 text-xs font-bold text-slate-700"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        nameScale: Number(
                                          Math.min(4.0, (b.themeConfig.nameScale ?? 1.0) + 0.1).toFixed(2)
                                        )
                                      }
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 text-xs font-bold text-slate-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Tamanho do Nome</span>
                                <span className="font-mono font-bold text-indigo-700">{nameScalePct}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.25"
                                max="3.5"
                                step="0.05"
                                value={activeBranch.themeConfig.nameScale ?? 1.0}
                                onChange={e =>
                                  updateActiveBranch(b => ({
                                    ...b,
                                    themeConfig: {
                                      ...b.themeConfig,
                                      nameScale: parseFloat(e.target.value) || 1.0
                                    }
                                  }))
                                }
                                className="w-full accent-indigo-600 cursor-pointer"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Posição X (Horiz.)</span>
                                  <span className="font-mono">{curNameX}</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="960"
                                  value={curNameX}
                                  onChange={e =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        namePosX: parseInt(e.target.value, 10)
                                      }
                                    }))
                                  }
                                  className="w-full accent-indigo-600 cursor-pointer"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Posição Y (Vert.)</span>
                                  <span className="font-mono">{curNameY}</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="960"
                                  value={curNameY}
                                  onChange={e =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        namePosY: parseInt(e.target.value, 10)
                                      }
                                    }))
                                  }
                                  className="w-full accent-indigo-600 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Controls for IDADE */}
                          <div
                            onClick={() => setActiveTextTarget('age')}
                            className={`p-3 rounded-xl border space-y-2 transition ${
                              activeTextTarget === 'age'
                                ? 'bg-white border-purple-500 shadow-2xs'
                                : 'bg-white/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-purple-900">
                                ✥ IDADE ({ageBox?.fontSize || 24}px · {ageScalePct}%)
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        ageScale: Number(
                                          Math.max(0.25, (b.themeConfig.ageScale ?? 1.0) - 0.1).toFixed(2)
                                        )
                                      }
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-purple-100 text-xs font-bold text-slate-700"
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        ageScale: Number(
                                          Math.min(4.0, (b.themeConfig.ageScale ?? 1.0) + 0.1).toFixed(2)
                                        )
                                      }
                                    }))
                                  }
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-purple-100 text-xs font-bold text-slate-700"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between text-[10px] text-slate-500">
                                <span>Tamanho da Idade</span>
                                <span className="font-mono font-bold text-purple-700">{ageScalePct}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.25"
                                max="3.5"
                                step="0.05"
                                value={activeBranch.themeConfig.ageScale ?? 1.0}
                                onChange={e =>
                                  updateActiveBranch(b => ({
                                    ...b,
                                    themeConfig: {
                                      ...b.themeConfig,
                                      ageScale: parseFloat(e.target.value) || 1.0
                                    }
                                  }))
                                }
                                className="w-full accent-purple-600 cursor-pointer"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Posição X (Horiz.)</span>
                                  <span className="font-mono">{curAgeX}</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="960"
                                  value={curAgeX}
                                  onChange={e =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        agePosX: parseInt(e.target.value, 10)
                                      }
                                    }))
                                  }
                                  className="w-full accent-purple-600 cursor-pointer"
                                />
                              </div>
                              <div>
                                <div className="flex justify-between text-[10px] text-slate-500">
                                  <span>Posição Y (Vert.)</span>
                                  <span className="font-mono">{curAgeY}</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="960"
                                  value={curAgeY}
                                  onChange={e =>
                                    updateActiveBranch(b => ({
                                      ...b,
                                      themeConfig: {
                                        ...b.themeConfig,
                                        agePosY: parseInt(e.target.value, 10)
                                      }
                                    }))
                                  }
                                  className="w-full accent-purple-600 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={activeBranch.themeConfig.showTitleOverlay !== false}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, showTitleOverlay: e.target.checked }
                            }))
                          }
                          className="rounded border-slate-300 text-orange-500"
                        />
                        Exibir Nome + Idade na Frente
                      </label>
                      <label className="inline-flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={activeBranch.themeConfig.showCharacterOverlay !== false}
                          onChange={e =>
                            updateActiveBranch(b => ({
                              ...b,
                              themeConfig: { ...b.themeConfig, showCharacterOverlay: e.target.checked }
                            }))
                          }
                          className="rounded border-slate-300 text-orange-500"
                        />
                        Exibir Personagem em Destaque
                      </label>
                    </div>

                    <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 border border-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition">
                      <Upload className="w-3.5 h-3.5 text-orange-500" />
                      <span>Enviar Personagem PNG Transparente</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCharacterUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Quick Preset Fallback if user has no images handy */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 mr-1">Ou testar com Kit Pronto:</span>
                    {THEME_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() =>
                          updateActiveBranch(b => ({
                            ...b,
                            themeConfig: {
                              ...b.themeConfig,
                              themeName: preset.name,
                              primaryPatternId: preset.primaryPatternId,
                              secondaryPatternId: preset.secondaryPatternId,
                              borderStyleId: preset.borderStyleId,
                              characterPresetId: preset.characterPresetId,
                              namePrimaryColor: preset.namePrimaryColor,
                              nameOutlineColor: preset.nameOutlineColor,
                              childName: preset.defaultChildName,
                              childAge: preset.defaultChildAge
                            }
                          }))
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-orange-700 text-[11px] font-medium border border-slate-200 transition"
                      >
                        {preset.name.split(' (')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column (5 cols): Sticky Live Mold Preview */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs lg:sticky lg:top-32">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-orange-600 font-bold">
                      PREVIEW INTERATIVO · ARRASTE NOME E IDADE
                    </span>
                    <h3 className="text-sm font-bold text-slate-900">
                      {activeBranch.template.name.replace(' (Com Mapa Geométrico)', '')}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-[11px] font-semibold">
                    <button
                      onClick={() => setPreviewMode('proof_pdf')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        previewMode === 'proof_pdf'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Com Linhas
                    </button>
                    <button
                      onClick={() => setPreviewMode('print_pdf')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        previewMode === 'print_pdf'
                          ? 'bg-white text-emerald-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Impressão Limpa
                    </button>
                    <button
                      onClick={() => setPreviewMode('guide_map')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        previewMode === 'guide_map'
                          ? 'bg-white text-orange-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Mapa A, B, C
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 space-y-2">
                  <canvas
                    ref={stepCanvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onWheel={handleCanvasWheel}
                    style={{ cursor: canvasCursor }}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-sm select-none"
                  />
                  {previewMode !== 'guide_map' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-1 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-[11px] text-indigo-900">
                      <span>
                        💡 <strong>Dica na Arte:</strong> Clique e arraste o <strong>NOME</strong> ou a <strong>IDADE</strong> para mover, ou puxe a bolinha <strong>⤡</strong> no canto (ou use o scroll do mouse) para redimensionar!
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-600">
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <Scissors className="w-3.5 h-3.5" />
                    Sangria +{activeBranch.themeConfig.bleedMm}mm ativa
                  </span>
                  <span className="flex items-center gap-1 text-sky-700 font-medium">
                    <QrCode className="w-3.5 h-3.5" />
                    QR Code & Registro preservados
                  </span>
                </div>

                <button
                  onClick={() => setWizardStep(4)}
                  className="w-full py-3.5 px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm shadow-md shadow-orange-500/15 transition"
                >
                  Continuar para Etapa 4: Conferir Composição →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TELA 4: REVISÃO DO MAPA DE COMPOSIÇÃO E CONFIRMAÇÃO (CONFIRMAR MAPA)
           ===================================================================== */}
        {wizardStep === 4 && activeBranch.template && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase text-orange-600">
                  ETAPA 4 DE 5 · CONFERÊNCIA DO MAPA DE COMPOSIÇÃO
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Revise o Mapa de Composição antes de finalizar os 2 PDFs
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifique se todas as áreas estão com a função e imagem corretas. Se precisar ajustar alguma área, clique em &ldquo;Trocar Imagem / Ajustar&rdquo;.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  ← Voltar para Imagens
                </button>
                <button
                  onClick={() => handleSendCommand('CONFIRMAR MAPA')}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/15 transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFIRMAR MAPA E GERAR OS 2 PDFs →</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Official Composition Map Table */}
              <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900">
                  Resumo Oficial do Mapa de Composição
                </h3>
                <div className="space-y-2.5">
                  {activeBranch.template.regions.map(r => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-orange-500 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {r.id}
                        </span>
                        {r.customAssetDataUrl && (
                          <img
                            src={r.customAssetDataUrl}
                            alt={r.id}
                            className="w-9 h-9 rounded-md object-cover border border-slate-300 shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            Área {r.id} → {r.assignedFunction.replace(/_/g, ' ').toUpperCase()}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {r.customAssetName ? `📷 ${r.customAssetName}` : r.assignedContent}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedRegionId(r.id);
                          setWizardStep(3);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-orange-50 text-orange-700 border border-slate-200 text-[11px] font-semibold shrink-0"
                      >
                        Ajustar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1 text-xs text-emerald-900">
                  <div className="font-bold">Configuração Técnica Pronta:</div>
                  <div>• Nome / Idade: {activeBranch.themeConfig.childName} ({activeBranch.themeConfig.childAge})</div>
                  <div>• Sangria Externa: +{activeBranch.themeConfig.bleedMm}mm além das linhas de corte</div>
                  <div>• Proteção de QR Code e Marcas de Registro ativa</div>
                </div>

                <button
                  onClick={() => handleSendCommand('CONFIRMAR MAPA')}
                  className="w-full py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/15 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>✓ CONFIRMAR MAPA E IR PARA DOWNLOAD DOS 2 PDFs</span>
                </button>
              </div>

              {/* Right: Large High-Res Inspection Canvas */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Inspeção Visual da Arte no Molde
                    </h3>
                    <p className="text-xs text-slate-500">
                      Alterne entre a visualização com linhas de conferência e a folha de impressão limpa:
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                    <button
                      onClick={() => setPreviewMode('proof_pdf')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        previewMode === 'proof_pdf'
                          ? 'bg-sky-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Conferência (Com Linhas)
                    </button>
                    <button
                      onClick={() => setPreviewMode('print_pdf')}
                      className={`px-3 py-1.5 rounded-lg transition ${
                        previewMode === 'print_pdf'
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Impressão (Sem Linhas)
                    </button>
                  </div>
                </div>

                <div className="bg-slate-100 rounded-xl p-4 border border-slate-200 space-y-2">
                  <canvas
                    ref={stepCanvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                    onWheel={handleCanvasWheel}
                    style={{ cursor: canvasCursor }}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-sm select-none"
                  />
                  {previewMode !== 'guide_map' && (
                    <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-indigo-50/90 border border-indigo-200/80 text-[11px] text-indigo-900">
                      <span>
                        💡 Você também pode arrastar ou redimensionar (<strong>⤡</strong>) o <strong>Nome</strong> e a <strong>Idade</strong> diretamente aqui na conferência!
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TELA 5: EXPORTAÇÃO DUPLA OBRIGATÓRIA (2 PDFs) & AUDITORIA
           ===================================================================== */}
        {wizardStep === 5 && activeBranch.template && (
          <div className="space-y-6">
            {/* Celebratory Top Banner */}
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                  ✓ ETAPA 5 DE 5 · ARTE FINALIZADA & AUDITADA
                </span>
                <h2 className="text-2xl font-bold text-slate-900">
                  Seus 2 PDFs Obrigatórios estão prontos para baixar!
                </h2>
                <p className="text-xs text-slate-600">
                  Gerados simultaneamente a partir da mesma matriz vetorial (<em>shared_source</em>) com alinhamento idêntico.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setWizardStep(3)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Nova Arte no Mesmo Molde</span>
                </button>
                <button
                  onClick={() => handleDownloadPdf('both')}
                  disabled={isExporting}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-orange-500/20 flex items-center gap-2 transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Baixar os 2 PDFs Juntos (Impressão + Conferência)</span>
                </button>
              </div>
            </div>

            {/* Side-by-Side Dual PDF Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* PDF 1: Print PDF */}
              <div className="bg-white border border-emerald-200 rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      ARQUIVO 1 · PDF PARA IMPRESSÃO
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      PDF para Impressão (Limpo · Sem Linhas Técnicas)
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDownloadPdf('print')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Baixar PDF Impressão</span>
                  </button>
                </div>

                <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
                  <canvas
                    ref={printFinalCanvasRef}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-xs"
                  />
                </div>

                <p className="text-xs text-slate-600">
                  ✔ Contém a arte final com sangria (+{activeBranch.themeConfig.bleedMm}mm), marcas de registro e QR Code preservados e <strong>zero linhas de corte ou dobra visíveis</strong>.
                </p>
              </div>

              {/* PDF 2: Proof PDF */}
              <div className="bg-white border border-sky-200 rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                      ARQUIVO 2 · PDF DE CONFERÊNCIA
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      PDF de Conferência (Mesma Arte + Linhas do Molde)
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDownloadPdf('proof')}
                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Baixar PDF Conferência</span>
                  </button>
                </div>

                <div className="bg-slate-100 rounded-xl p-3 border border-slate-200">
                  <canvas
                    ref={proofFinalCanvasRef}
                    className="w-full aspect-[297/210] rounded-lg bg-white shadow-xs"
                  />
                </div>

                <p className="text-xs text-slate-600">
                  ✔ Exibe exatamente a mesma composição com as <strong>linhas técnicas de corte, vincos de dobra e furos sobrepostos</strong> para validação de encaixe.
                </p>
              </div>
            </div>

            {/* Clean Compact Quality Audit Checklist */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Checklist de Controle de Qualidade Pré-Impressão
                  </h3>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  {auditList.filter(i => i.passed).length}/{auditList.length} Aprovados ✓
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {auditList.map(item => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-slate-800">{item.title}</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    </div>
                    <div className="text-[10px] font-mono text-emerald-700">{item.measuredValue}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Slide-Over Drawer for Chatbot Console & Official MAP Commands */}
      {isChatDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-orange-500" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Console de Comandos · Método MAP</h3>
                  <p className="text-[11px] text-slate-500">
                    Histórico do assistente e atalhos oficiais da skill
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsChatDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap gap-1.5">
              <button
                onClick={() => handleSendCommand('Iniciar Método MAP')}
                className="px-2 py-1 rounded bg-white text-[10px] font-mono font-semibold text-orange-700 border border-slate-200"
              >
                Iniciar Método MAP
              </button>
              <button
                onClick={() => handleSendCommand('CONFIRMAR MAPA')}
                className="px-2 py-1 rounded bg-emerald-50 text-[10px] font-mono font-bold text-emerald-700 border border-emerald-200"
              >
                CONFIRMAR MAPA
              </button>
              <button
                onClick={() => handleSendCommand('NOVA ARTE COM O MESMO MAPA')}
                className="px-2 py-1 rounded bg-sky-50 text-[10px] font-mono font-semibold text-sky-700 border border-sky-200"
              >
                NOVA ARTE MESMO MAPA
              </button>
              <button
                onClick={() => handleSendCommand('TROCAR MOLDE OFICIAL')}
                className="px-2 py-1 rounded bg-rose-50 text-[10px] font-mono font-semibold text-rose-700 border border-rose-200"
              >
                TROCAR MOLDE OFICIAL
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FAFBFD]">
              {activeBranch.messages.map(msg => (
                <div
                  key={msg.id}
                  className={`rounded-2xl p-3.5 text-xs leading-relaxed border ${
                    msg.sender === 'user'
                      ? 'bg-orange-50 border-orange-200 text-slate-800 ml-6'
                      : 'bg-white border-slate-200 text-slate-700 mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <span className="font-bold text-slate-700">
                      {msg.sender === 'user' ? 'Você' : '🤖 Bot Método MAP'}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <div className="whitespace-pre-line">{msg.text}</div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-white border-t border-slate-200 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSendCommand();
                }}
                placeholder="Digite um comando (ex: CONFIRMAR MAPA)..."
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-orange-500"
              />
              <button
                onClick={() => handleSendCommand()}
                className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* JSON Reverse Engineering Modal */}
      <JsonDecoderModal isOpen={isDecoderOpen} onClose={() => setIsDecoderOpen(false)} />
    </div>
  );
}
export default App;
