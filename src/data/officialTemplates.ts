import { OfficialTemplateSpec, DetectedRegion } from '../types/mapTypes';

export const OFFICIAL_TEMPLATES: OfficialTemplateSpec[] = [
  // 1. SACOLA NUVEM (Page 1 of both PDFs + Page 6 Mermaid Example in Guide)
  {
    id: 'sacola-nuvem-color',
    name: 'Sacola Nuvem (Com Mapa Geométrico)',
    category: 'Sacola Personalizada',
    mode: 'colored_map',
    pageCount: 1,
    widthMm: 297,
    heightMm: 210,
    orientation: 'Paisagem',
    description: 'Molde oficial da Sacola Nuvem com topo ondulado (5 arcos), 2 furos de alça, painel frontal amplo (Vermelho), sanfona lateral com vinco triangular (Azul) e fundo de encaixe.',
    outerCutPolygon: [
      { x: 55, y: 105 }, { x: 725, y: 105 }, { x: 895, y: 105 }, { x: 945, y: 138 },
      { x: 945, y: 745 }, { x: 895, y: 780 }, { x: 890, y: 920 }, { x: 730, y: 920 },
      { x: 725, y: 780 }, { x: 700, y: 945 }, { x: 80, y: 945 }, { x: 55, y: 780 }
    ],
    regions: [
      {
        id: 'A',
        colorName: 'Vermelho',
        colorHex: '#EF2B2D',
        shapeAndLocation: 'Retângulo amplo com topo em arcos nuvem (esquerda/centro)',
        pageAndFace: 'Página 1 · Painel Frontal Principal da Sacola',
        repetitions: 'Único (1 ocorrência)',
        overlaps: 'Contém 2 furos técnicos de alça preservados no topo; permite sobreposição de Barrado, Personagem, Nome e Idade',
        pageIndex: 0,
        polygon: [
          { x: 60, y: 65 }, { x: 720, y: 65 }, { x: 720, y: 760 }, { x: 60, y: 760 }
        ],
        bbox: { x: 60, y: 65, w: 660, h: 695 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Digital Principal + Barrado + Personagem + Nome e Idade',
        positionAndOrientation: 'Horizontal frontal (0°), centralizado na face principal',
        overlapRule: 'Fundo base com camada de escamas/barrado na metade inferior, personagem à esquerda e título à direita'
      },
      {
        id: 'B',
        colorName: 'Azul',
        colorHex: '#1977BD',
        shapeAndLocation: 'Retângulo vertical direito (sanfona lateral + aba de colagem)',
        pageAndFace: 'Página 1 · Lateral Sanfonada Direita e Aba',
        repetitions: 'Único (1 ocorrência)',
        overlaps: 'Cruzado por linhas vermelhas de vinco lateral e triângulo de fundo',
        pageIndex: 0,
        polygon: [
          { x: 740, y: 82 }, { x: 948, y: 82 }, { x: 948, y: 758 }, { x: 740, y: 758 }
        ],
        bbox: { x: 740, y: 82, w: 208, h: 676 },
        assignedFunction: 'lateral',
        assignedContent: 'Papel Secundário / Estampa Lateral Coordenada',
        positionAndOrientation: 'Vertical (0°), contínuo na sanfona lateral',
        overlapRule: 'Apenas estampa contínua sem textos que possam ser divididos pelo vinco central'
      }
    ],
    technicalLines: [
      // Scalloped top wave cut line (5 arcs) + outer black cut lines
      {
        type: 'cut',
        color: '#0F172A',
        strokeWidth: 2.2,
        pathSvg: 'M 55 105 Q 122 25 189 105 Q 256 25 323 105 Q 390 25 457 105 Q 524 25 591 105 Q 658 25 725 105 L 895 105 L 945 138 L 945 745 L 895 780 L 890 920 L 730 920 L 730 780 M 725 780 L 700 945 M 55 105 L 55 780 L 80 945 M 80 945 L 700 945'
      },
      // Two handle holes
      {
        type: 'hole',
        color: '#0F172A',
        strokeWidth: 2.2,
        circle: { cx: 247, cy: 152, r: 12 }
      },
      {
        type: 'hole',
        color: '#0F172A',
        strokeWidth: 2.2,
        circle: { cx: 532, cy: 152, r: 12 }
      },
      // Red solid fold lines
      {
        type: 'fold_solid',
        color: '#DC2626',
        strokeWidth: 2.0,
        pathSvg: 'M 55 780 L 895 780 M 725 105 L 725 780 M 895 105 L 895 780 M 810 105 L 810 662 M 725 780 L 810 662 L 895 780'
      }
    ],
    technicalElements: [
      {
        id: 'reg-tl',
        type: 'registration_mark',
        label: 'Marca de Registro Superior Esquerda',
        bbox: { x: 18, y: 18, w: 24, h: 24 },
        safeMarginMm: 5,
        preserved: true
      },
      {
        id: 'reg-tr',
        type: 'registration_mark',
        label: 'Marca de Registro Superior Direita',
        bbox: { x: 952, y: 18, w: 24, h: 24 },
        safeMarginMm: 5,
        preserved: true
      },
      {
        id: 'qr-tr',
        type: 'qr_code',
        label: 'QR Code de Registro / Corte Silhouette',
        bbox: { x: 922, y: 48, w: 46, h: 46 },
        safeMarginMm: 4,
        preserved: true
      }
    ]
  },

  // 2. CAIXA MILK (Page 4 of PDF 1, Page 2 of PDF 2, Page 5 of Guide)
  {
    id: 'caixa-milk-color',
    name: 'Caixa Milk (Com Mapa Geométrico)',
    category: 'Caixa Milk Clássica',
    mode: 'colored_map',
    pageCount: 1,
    widthMm: 297,
    heightMm: 210,
    orientation: 'Paisagem',
    description: 'Molde oficial da Caixa Milk com faixa superior verde (telhado + abas de fechamento com furos para laço), 4 painéis verticais alternados (Azul / Vermelho / Azul / Vermelho), aba lateral de colagem e fundo de encaixe.',
    outerCutPolygon: [
      { x: 56, y: 105 }, { x: 268, y: 105 }, { x: 268, y: 38 }, { x: 480, y: 38 },
      { x: 480, y: 105 }, { x: 692, y: 105 }, { x: 692, y: 38 }, { x: 904, y: 38 },
      { x: 904, y: 105 }, { x: 942, y: 122 }, { x: 942, y: 710 }, { x: 904, y: 736 },
      { x: 845, y: 955 }, { x: 745, y: 955 }, { x: 688, y: 736 }, { x: 688, y: 890 },
      { x: 480, y: 960 }, { x: 268, y: 960 }, { x: 56, y: 890 }
    ],
    regions: [
      {
        id: 'A',
        colorName: 'Verde',
        colorHex: '#1FA149',
        shapeAndLocation: 'Faixa horizontal superior cobrindo telhado, triângulos laterais e abas superiores',
        pageAndFace: 'Página 1 · Topo / Telhado e Abas de Fechamento (4 faces superiores)',
        repetitions: '1 faixa contínua atravessando as 4 colunas do topo',
        overlaps: 'Atravessada pelas linhas tracejadas dos triângulos de dobra e vazados de fita',
        pageIndex: 0,
        polygon: [
          { x: 52, y: 32 }, { x: 946, y: 32 }, { x: 946, y: 304 }, { x: 52, y: 304 }
        ],
        bbox: { x: 52, y: 32, w: 894, h: 272 },
        assignedFunction: 'barrado',
        assignedContent: 'Papel Digital de Topo / Telhado Coordenado',
        positionAndOrientation: 'Horizontal superior (0°)',
        overlapRule: 'Substituir guia verde por estampa coordenada mantendo livres os 2 vazados retangulares de fita'
      },
      {
        id: 'B',
        colorName: 'Azul',
        colorHex: '#1877BC',
        shapeAndLocation: 'Retângulos verticais nas colunas 1 e 3 (faces laterais)',
        pageAndFace: 'Página 1 · Painéis Laterais 1 (esquerda) e 3 (centro-direita)',
        repetitions: 'Repete em 2 faces (Coluna 1 e Coluna 3)',
        overlaps: 'Interno às linhas tracejadas sem encostar nas bordas técnicas (conforme Regra da pág. 5)',
        pageIndex: 0,
        polygon: [
          { x: 62, y: 324 }, { x: 259, y: 324 }, { x: 259, y: 716 }, { x: 62, y: 716 }
        ],
        bbox: { x: 62, y: 324, w: 197, h: 392 },
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário + Elementos Secundários',
        positionAndOrientation: 'Vertical (0°) nas 2 faces laterais',
        overlapRule: 'Mesma composição aplicada nas Colunas 1 e 3'
      },
      {
        id: 'C',
        colorName: 'Vermelho-Laranja',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Retângulos verticais nas colunas 2 e 4 (frente e verso)',
        pageAndFace: 'Página 1 · Painel Frontal (Coluna 2) e Painel Traseiro (Coluna 4)',
        repetitions: 'Repete em 2 faces (Coluna 2 = Frente, Coluna 4 = Verso)',
        overlaps: 'Na Coluna 2 recebe Personagem Principal + Nome + Idade sobrepostos',
        pageIndex: 0,
        polygon: [
          { x: 274, y: 324 }, { x: 472, y: 324 }, { x: 472, y: 716 }, { x: 274, y: 716 }
        ],
        bbox: { x: 274, y: 324, w: 198, h: 392 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Principal + Personagem + Nome e Idade na Frente (Coluna 2)',
        positionAndOrientation: 'Vertical (0°) centralizado na face frontal e traseira',
        overlapRule: 'Fundo principal nas colunas 2 e 4; aplique de personagem + nome/idade centralizado na Coluna 2'
      },
      {
        id: 'D',
        colorName: 'Azul (Rep. Coluna 3)',
        colorHex: '#1877BC',
        shapeAndLocation: 'Retângulo vertical na coluna 3 (2ª lateral)',
        pageAndFace: 'Página 1 · Painel Lateral Direito (Coluna 3)',
        repetitions: 'Par da Área B (2ª ocorrência Azul)',
        overlaps: 'Nenhuma sobreposição crítica',
        pageIndex: 0,
        polygon: [
          { x: 488, y: 324 }, { x: 684, y: 324 }, { x: 684, y: 716 }, { x: 488, y: 716 }
        ],
        bbox: { x: 488, y: 324, w: 196, h: 392 },
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário (mesma função de B)',
        positionAndOrientation: 'Vertical (0°)',
        overlapRule: 'Segue exatamente o padrão definido para B'
      },
      {
        id: 'E',
        colorName: 'Vermelho-Laranja (Rep. Coluna 4)',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Retângulo vertical na coluna 4 (verso)',
        pageAndFace: 'Página 1 · Painel Traseiro (Coluna 4)',
        repetitions: 'Par da Área C (2ª ocorrência Vermelho-Laranja)',
        overlaps: 'Recebe elemento secundário ou logo/tag no verso',
        pageIndex: 0,
        polygon: [
          { x: 699, y: 324 }, { x: 896, y: 324 }, { x: 896, y: 716 }, { x: 699, y: 716 }
        ],
        bbox: { x: 699, y: 324, w: 197, h: 392 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Digital Principal + Elemento Decorativo de Verso',
        positionAndOrientation: 'Vertical (0°)',
        overlapRule: 'Mesmo papel de C, sem duplicar o nome principal se desejar verso limpo'
      }
    ],
    technicalLines: [
      // Outer Black Cut Lines
      {
        type: 'cut',
        color: '#1E293B',
        strokeWidth: 1.8,
        pathSvg: 'M 56 105 L 268 105 L 268 38 L 480 38 L 480 105 L 692 105 L 692 38 L 904 38 L 904 105 L 942 122 L 942 225 L 904 308 L 942 332 L 942 710 L 904 736 L 845 955 L 745 955 L 692 736 L 692 890 L 570 890 L 590 815 L 480 736 L 480 960 L 428 960 L 428 890 L 320 890 L 320 960 L 268 960 L 268 736 L 160 815 L 178 890 L 56 890 Z M 731 54 L 742 54 L 742 98 L 731 98 Z M 855 54 L 866 54 L 866 98 L 855 98 Z'
      },
      // Pink/Red Dashed Fold Lines
      {
        type: 'fold_dashed',
        color: '#E11D48',
        strokeWidth: 1.5,
        pathSvg: 'M 56 308 L 904 308 M 56 736 L 904 736 M 268 105 L 268 736 M 480 105 L 480 736 M 692 105 L 692 736 M 904 105 L 904 736 M 56 308 L 162 105 L 268 308 M 480 308 L 586 105 L 692 308'
      }
    ],
    technicalElements: [
      {
        id: 'reg-tl',
        type: 'registration_mark',
        label: 'Marca de Registro Superior Esquerda',
        bbox: { x: 16, y: 16, w: 22, h: 22 },
        safeMarginMm: 5,
        preserved: true
      },
      {
        id: 'reg-tr',
        type: 'registration_mark',
        label: 'Marca de Registro Superior Direita',
        bbox: { x: 954, y: 16, w: 22, h: 22 },
        safeMarginMm: 5,
        preserved: true
      },
      {
        id: 'qr-br',
        type: 'qr_code',
        label: 'QR Code de Controle de Lote',
        bbox: { x: 928, y: 895, w: 46, h: 46 },
        safeMarginMm: 4,
        preserved: true
      }
    ]
  },

  // 3. CAIXA PIRÂMIDE (Page 5 of PDF 1, Page 3 of PDF 2)
  {
    id: 'caixa-piramide-color',
    name: 'Caixa Pirâmide + Aplique Escalopado (Com Mapa Geométrico)',
    category: 'Caixa Cone / Pirâmide',
    mode: 'colored_map',
    pageCount: 1,
    widthMm: 297,
    heightMm: 210,
    orientation: 'Paisagem',
    description: 'Molde em leque com 4 faces triangulares convergindo no vértice inferior esquerdo (Verde, Azul, Vermelho-Laranja, Azul), abas de fundo arredondadas e tag/aplique circular escalopado (Vermelho-Laranja) à direita.',
    outerCutPolygon: [
      { x: 28, y: 105 }, { x: 63, y: 895 }, { x: 625, y: 882 }, { x: 698, y: 830 },
      { x: 660, y: 600 }, { x: 785, y: 365 }, { x: 700, y: 155 }, { x: 480, y: 220 },
      { x: 278, y: 165 }
    ],
    regions: [
      {
        id: 'A',
        colorName: 'Verde',
        colorHex: '#1FA149',
        shapeAndLocation: 'Triângulo lateral esquerdo + aba de colagem (1ª face do leque)',
        pageAndFace: 'Página 1 · Face 1 (Lateral Esquerda + Aba de Colagem)',
        repetitions: 'Único (1 ocorrência)',
        overlaps: 'Inclui linha de vinco da aba lateral esquerda',
        pageIndex: 0,
        polygon: [
          { x: 32, y: 112 }, { x: 274, y: 170 }, { x: 64, y: 885 }, { x: 32, y: 745 }
        ],
        bbox: { x: 32, y: 112, w: 242, h: 773 },
        rotationDeg: -72,
        assignedFunction: 'lateral',
        assignedContent: 'Papel Digital Lateral / Fundo Complementar',
        positionAndOrientation: 'Inclinado acompanhando o eixo radial da Face 1 (-72°)',
        overlapRule: 'Preencher face e aba lateral garantindo continuidade na colagem'
      },
      {
        id: 'B',
        colorName: 'Azul',
        colorHex: '#1877BC',
        shapeAndLocation: 'Triângulos nas Faces 2 e 4 do leque piramidal',
        pageAndFace: 'Página 1 · Faces Laterais 2 e 4 da Pirâmide',
        repetitions: 'Repete em 2 faces (Face 2 e Face 4)',
        overlaps: 'Nenhuma sobreposição interna',
        pageIndex: 0,
        polygon: [
          { x: 280, y: 174 }, { x: 456, y: 336 }, { x: 72, y: 882 }
        ],
        bbox: { x: 72, y: 174, w: 384, h: 708 },
        rotationDeg: -48,
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário nas 2 laterais da pirâmide',
        positionAndOrientation: 'Orientado para o vértice superior da pirâmide (-48°)',
        overlapRule: 'Mesma estampa aplicada nas Faces 2 e 4'
      },
      {
        id: 'C',
        colorName: 'Vermelho-Laranja (Face Central)',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Triângulo central do leque (Face 3 frontal)',
        pageAndFace: 'Página 1 · Face 3 Principal (Frente da Pirâmide)',
        repetitions: 'Repete a cor no aplique circular E (2 ocorrências da cor)',
        overlaps: 'Recebe Personagem Principal + Nome/Idade orientados no eixo da face central',
        pageIndex: 0,
        polygon: [
          { x: 459, y: 342 }, { x: 578, y: 586 }, { x: 78, y: 886 }
        ],
        bbox: { x: 78, y: 342, w: 500, h: 544 },
        rotationDeg: -26,
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Digital Principal + Personagem Central + Nome',
        positionAndOrientation: 'Alinhado ao eixo radial da Face 3 (-26°)',
        overlapRule: 'Evitar posicionar rosto ou letras próximo ao bico fino inferior esquerdo'
      },
      {
        id: 'D',
        colorName: 'Azul (Rep. Face 4)',
        colorHex: '#1877BC',
        shapeAndLocation: 'Triângulo inferior direito do leque (Face 4)',
        pageAndFace: 'Página 1 · Face 4 Lateral Direita',
        repetitions: '2ª ocorrência Azul (par da Área B)',
        overlaps: 'Nenhuma sobreposição',
        pageIndex: 0,
        polygon: [
          { x: 582, y: 593 }, { x: 620, y: 878 }, { x: 85, y: 892 }
        ],
        bbox: { x: 85, y: 593, w: 535, h: 299 },
        rotationDeg: -8,
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário (mesma estampa de B)',
        positionAndOrientation: 'Alinhado ao eixo da Face 4 (-8°)',
        overlapRule: 'Continuidade visual com a Face 2'
      },
      {
        id: 'E',
        colorName: 'Vermelho-Laranja (Círculo Escalopado)',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Círculo com borda escalopada (flor/nuvem) à direita',
        pageAndFace: 'Página 1 · Tag / Aplique 3D Redondo Separado',
        repetitions: 'Mesma cor de C, formato circular independente',
        overlaps: 'Contém linha de corte escalopada interna',
        pageIndex: 0,
        polygon: [
          { x: 695, y: 435 }, { x: 975, y: 435 }, { x: 975, y: 835 }, { x: 695, y: 835 }
        ],
        bbox: { x: 695, y: 435, w: 280, h: 400 },
        assignedFunction: 'aplique_topper',
        assignedContent: 'Aplique 3D com Personagem + Nome + Idade em Moldura Escalopada',
        positionAndOrientation: 'Horizontal (0°), centralizado no medalhão escalopado',
        overlapRule: 'Sangria circular externa à linha de corte escalopada'
      }
    ],
    technicalLines: [
      {
        type: 'cut',
        color: '#1E293B',
        strokeWidth: 1.8,
        pathSvg: 'M 28 128 L 62 104 L 278 166 L 325 100 Q 348 85 372 105 L 474 218 Q 492 238 474 268 L 458 338 L 642 162 Q 685 138 712 182 L 784 326 Q 802 365 762 412 L 582 588 L 656 602 L 696 815 Q 702 855 660 872 L 626 884 L 63 896 L 28 746 Z'
      },
      {
        type: 'fold_solid',
        color: '#334155',
        strokeWidth: 1.5,
        pathSvg: 'M 62 104 L 63 896 M 278 166 L 63 896 M 458 338 L 63 896 M 582 588 L 63 896 M 278 166 L 458 338 L 582 588 L 626 884'
      },
      // Scalloped topper cut line on the right
      {
        type: 'cut',
        color: '#1E293B',
        strokeWidth: 1.8,
        circle: { cx: 835, cy: 635, r: 122 }
      }
    ],
    technicalElements: [
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
        id: 'qr-tr',
        type: 'qr_code',
        label: 'QR Code Silhouette Cameo',
        bbox: { x: 918, y: 52, w: 48, h: 48 },
        safeMarginMm: 4,
        preserved: true
      }
    ]
  },

  // 4. CAIXA CANUDO (Page 2 of PDF 1, Page 4 of PDF 2)
  {
    id: 'caixa-canudo-color',
    name: 'Caixa Canudo (Com Mapa Geométrico)',
    category: 'Caixa com Suporte para Canudo',
    mode: 'colored_map',
    pageCount: 1,
    widthMm: 297,
    heightMm: 210,
    orientation: 'Paisagem',
    description: 'Molde oficial da Caixa Canudo com cúpula trapezoidal verde (com 4 furos circulares nas abas diagonais para encaixe do canudo e laço), 1 painel frontal vermelho e 3 painéis azuis.',
    outerCutPolygon: [
      { x: 60, y: 432 }, { x: 272, y: 142 }, { x: 376, y: 60 }, { x: 484, y: 142 },
      { x: 696, y: 432 }, { x: 908, y: 432 }, { x: 938, y: 455 }, { x: 938, y: 705 },
      { x: 908, y: 726 }, { x: 908, y: 928 }, { x: 60, y: 928 }
    ],
    regions: [
      {
        id: 'A',
        colorName: 'Verde',
        colorHex: '#1FA149',
        shapeAndLocation: 'Polígono superior em cúpula/trapézio cobrindo telhado frontal e abas diagonais com furos',
        pageAndFace: 'Página 1 · Topo Inclinado / Telhado da Caixa Canudo',
        repetitions: 'Único (1 polígono superior composto)',
        overlaps: 'Contém 4 furos circulares técnicos e linhas tracejadas de dobra diagonal',
        pageIndex: 0,
        polygon: [
          { x: 64, y: 432 }, { x: 272, y: 142 }, { x: 378, y: 62 }, { x: 484, y: 142 }, { x: 696, y: 432 }
        ],
        bbox: { x: 64, y: 62, w: 632, h: 370 },
        assignedFunction: 'barrado',
        assignedContent: 'Papel Secundário / Telhado Decorado com Tag Superior',
        positionAndOrientation: 'Horizontal superior (0°)',
        overlapRule: 'Preservar os 4 furos de laço/canudo nas abas diagonais'
      },
      {
        id: 'B',
        colorName: 'Azul (Lateral Esquerda)',
        colorHex: '#1877BC',
        shapeAndLocation: 'Retângulo inferior na Coluna 1 (esquerda)',
        pageAndFace: 'Página 1 · Painel Lateral Esquerdo (Coluna 1)',
        repetitions: 'Repete em 3 painéis (Colunas 1, 3 e 4)',
        overlaps: 'Nenhuma sobreposição interna',
        pageIndex: 0,
        polygon: [
          { x: 62, y: 442 }, { x: 268, y: 442 }, { x: 268, y: 722 }, { x: 62, y: 722 }
        ],
        bbox: { x: 62, y: 442, w: 206, h: 280 },
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário',
        positionAndOrientation: 'Horizontal/Quadrado (0°)',
        overlapRule: 'Mesma composição nas 3 faces azuis'
      },
      {
        id: 'C',
        colorName: 'Vermelho-Laranja (Frente)',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Quadrado/Retângulo central na Coluna 2 (abaixo do telhado principal)',
        pageAndFace: 'Página 1 · Painel Frontal Principal (Coluna 2)',
        repetitions: 'Único (1 ocorrência)',
        overlaps: 'Recebe Personagem Principal + Nome + Idade',
        pageIndex: 0,
        polygon: [
          { x: 275, y: 442 }, { x: 478, y: 442 }, { x: 478, y: 722 }, { x: 275, y: 722 }
        ],
        bbox: { x: 275, y: 442, w: 203, h: 280 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Principal + Personagem + Nome + Idade',
        positionAndOrientation: 'Centralizado na face frontal (Coluna 2)',
        overlapRule: 'Destaque principal da caixa'
      },
      {
        id: 'D',
        colorName: 'Azul (Colunas 3 e 4 + Aba)',
        colorHex: '#1877BC',
        shapeAndLocation: ' Bloco retangular cobrindo Coluna 3 (Lateral Direita), Coluna 4 (Verso) e Aba de Colagem',
        pageAndFace: 'Página 1 · Lateral Direita + Verso + Aba',
        repetitions: 'Continuação da cor Azul (Área B)',
        overlaps: 'Dividido pelas linhas tracejadas verticais entre Coluna 3, Coluna 4 e Aba',
        pageIndex: 0,
        polygon: [
          { x: 486, y: 442 }, { x: 928, y: 442 }, { x: 928, y: 722 }, { x: 486, y: 722 }
        ],
        bbox: { x: 486, y: 442, w: 442, h: 280 },
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário Contínuo + Elemento no Verso',
        positionAndOrientation: 'Horizontal contínuo (0°)',
        overlapRule: 'Estampa contínua entre lateral direita e verso'
      }
    ],
    technicalLines: [
      {
        type: 'cut',
        color: '#1E293B',
        strokeWidth: 1.8,
        pathSvg: 'M 60 432 L 272 142 L 272 95 Q 378 35 484 95 L 484 142 L 696 432 L 908 432 L 938 455 L 938 705 L 908 726 L 908 930 L 852 930 L 852 868 L 752 868 L 752 930 L 696 930 L 696 726 L 545 842 L 545 925 L 484 925 L 484 726 L 426 868 L 426 925 L 328 925 L 328 868 L 272 726 L 272 925 L 212 925 L 212 842 L 60 726 Z'
      },
      {
        type: 'fold_dashed',
        color: '#334155',
        strokeWidth: 1.5,
        pathSvg: 'M 60 432 L 908 432 M 60 726 L 908 726 M 272 142 L 272 726 M 484 142 L 484 726 M 696 432 L 696 726 M 908 432 L 908 726 M 272 142 L 484 142 M 166 286 L 272 432 M 590 286 L 484 432'
      },
      { type: 'hole', color: '#1E293B', strokeWidth: 1.8, circle: { cx: 165, cy: 332, r: 10 } },
      { type: 'hole', color: '#1E293B', strokeWidth: 1.8, circle: { cx: 198, cy: 282, r: 10 } },
      { type: 'hole', color: '#1E293B', strokeWidth: 1.8, circle: { cx: 556, cy: 282, r: 10 } },
      { type: 'hole', color: '#1E293B', strokeWidth: 1.8, circle: { cx: 590, cy: 332, r: 10 } }
    ],
    technicalElements: [
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
      }
    ]
  },

  // 5. SACOLINHA CORAÇÃO / ALÇA ESCALOPADA (Page 3 of PDF 1, Page 5 of PDF 2)
  {
    id: 'sacolinha-coracao-color',
    name: 'Sacolinha Coração / Alça (Com Mapa Geométrico)',
    category: 'Sacolinha Surpresa com Alça Vazada',
    mode: 'colored_map',
    pageCount: 1,
    widthMm: 297,
    heightMm: 210,
    orientation: 'Paisagem',
    description: 'Molde oficial da Sacolinha Coração com 2 alças superiores escalopadas em Verde (com vazado ergonômico de mão), 2 triângulos centrais invertidos em Vermelho-Laranja (Frente e Verso) e 4 triângulos laterais em Azul.',
    outerCutPolygon: [
      { x: 68, y: 380 }, { x: 105, y: 224 }, { x: 308, y: 25 }, { x: 512, y: 224 },
      { x: 715, y: 25 }, { x: 916, y: 224 }, { x: 932, y: 942 }, { x: 196, y: 970 },
      { x: 68, y: 705 }
    ],
    regions: [
      {
        id: 'A',
        colorName: 'Verde',
        colorHex: '#1FA149',
        shapeAndLocation: 'Faixa superior cobrindo as 2 alças escalopadas (frente e verso)',
        pageAndFace: 'Página 1 · Alças Superiores Escalopadas (Frente e Verso)',
        repetitions: 'Faixa contínua para as 2 alças superiores',
        overlaps: 'Contém 2 grandes vazados internos para passagem da mão',
        pageIndex: 0,
        polygon: [
          { x: 108, y: 18 }, { x: 928, y: 18 }, { x: 928, y: 226 }, { x: 108, y: 226 }
        ],
        bbox: { x: 108, y: 18, w: 820, h: 208 },
        assignedFunction: 'barrado',
        assignedContent: 'Papel Digital de Alça / Barrado Superior',
        positionAndOrientation: 'Horizontal superior (0°)',
        overlapRule: 'Manter vazado interno das alças livre de elementos importantes'
      },
      {
        id: 'B',
        colorName: 'Vermelho-Laranja (Triângulos Centrais)',
        colorHex: '#EE3E1E',
        shapeAndLocation: '2 Grandes triângulos invertidos centrais (Frente à esquerda, Verso à direita)',
        pageAndFace: 'Página 1 · Faces Principais Frontal e Traseira (Em V)',
        repetitions: 'Repete em 2 faces (Frente e Verso)',
        overlaps: 'Recebe Personagem + Nome + Idade na parte média/superior do triângulo',
        pageIndex: 0,
        polygon: [
          { x: 120, y: 238 }, { x: 498, y: 238 }, { x: 308, y: 752 }
        ],
        bbox: { x: 120, y: 238, w: 378, h: 514 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Principal + Personagem + Nome e Idade',
        positionAndOrientation: 'Centralizado no terço superior do triângulo frontal',
        overlapRule: 'Posicionar nome e personagem na metade superior (mais larga) do V'
      },
      {
        id: 'C',
        colorName: 'Azul (Triângulos Laterais)',
        colorHex: '#1877BC',
        shapeAndLocation: '4 Triângulos laterais de vinco (flancos inferiores esquerdo/direito de cada face)',
        pageAndFace: 'Página 1 · Sanfonas Triangulares Laterais (4 áreas azuis)',
        repetitions: 'Repete em 4 triângulos laterais',
        overlaps: 'Área esquerda inclui aba lateral de colagem',
        pageIndex: 0,
        polygon: [
          { x: 76, y: 382 }, { x: 108, y: 256 }, { x: 294, y: 780 }, { x: 108, y: 745 }, { x: 76, y: 702 }
        ],
        bbox: { x: 76, y: 256, w: 836, h: 528 },
        assignedFunction: 'papel_secundario',
        assignedContent: 'Papel Digital Secundário Coordenado nas 4 Abas Triangulares',
        positionAndOrientation: 'Vertical (0°) preenchendo os 4 triângulos azuis',
        overlapRule: 'Aplicar a mesma estampa secundária nos 4 triângulos azuis'
      },
      {
        id: 'D',
        colorName: 'Vermelho-Laranja (2º Triângulo Central - Verso)',
        colorHex: '#EE3E1E',
        shapeAndLocation: 'Triângulo invertido central direito (Verso)',
        pageAndFace: 'Página 1 · Face Traseira em V',
        repetitions: '2ª ocorrência Vermelho-Laranja (par da Área B)',
        overlaps: 'Recebe Papel Principal + Tag/Elemento de Verso',
        pageIndex: 0,
        polygon: [
          { x: 526, y: 238 }, { x: 904, y: 238 }, { x: 714, y: 752 }
        ],
        bbox: { x: 526, y: 238, w: 378, h: 514 },
        assignedFunction: 'papel_principal',
        assignedContent: 'Papel Digital Principal (Verso)',
        positionAndOrientation: 'Centralizado no triângulo direito',
        overlapRule: 'Mesma função de B'
      }
    ],
    technicalLines: [
      {
        type: 'cut',
        color: '#1E293B',
        strokeWidth: 1.8,
        pathSvg: 'M 105 224 C 105 140 165 115 186 115 C 195 65 245 48 265 62 C 285 20 335 20 355 62 C 375 48 425 65 434 115 C 455 115 512 140 512 224 C 512 140 570 115 592 115 C 602 65 650 48 670 62 C 690 20 740 20 760 62 C 780 48 828 65 838 115 C 860 115 916 140 916 224 L 916 752 L 932 940 L 872 948 L 866 902 L 786 912 L 792 958 L 730 968 L 714 784 L 600 865 L 594 958 L 502 948 L 512 752 L 456 958 L 392 965 L 386 918 L 306 784 L 290 968 L 196 956 L 204 865 L 105 752 L 68 702 L 68 386 Z'
      },
      {
        type: 'fold_dashed',
        color: '#E11D48',
        strokeWidth: 1.5,
        pathSvg: 'M 105 224 L 916 224 M 105 224 L 105 752 M 512 224 L 512 752 M 105 224 L 306 784 L 512 224 M 512 224 L 714 784 L 916 224 M 105 752 L 306 784 L 512 752 L 714 784 L 916 752'
      }
    ],
    technicalElements: [
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
      }
    ]
  }
];

export function cloneTemplateAsLinesOnly(template: OfficialTemplateSpec): OfficialTemplateSpec {
  return {
    ...template,
    id: `${template.id}-lines`,
    name: template.name.replace('(Com Mapa Geométrico)', '(Somente Linhas do Molde - Opção 1)'),
    mode: 'lines_only',
    regions: template.regions.map((r): DetectedRegion => ({
      ...r,
      colorName: 'Sem cor (Apenas Linhas)',
      colorHex: '#64748B',
      overlaps: `${r.overlaps} · Face detectada pela geometria das linhas de corte/dobra`
    }))
  };
}
