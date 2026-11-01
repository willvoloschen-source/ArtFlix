# ArtFlix · Método MAP Studio Pro v2.0

Software avançado para **Montagem de Artes Personalizadas (Método MAP)** construído a partir da engenharia reversa e decodificação integral do arquivo inicializador `MAP-CHATBOT-OBF-GZIP-B64-SYMBOLS-v2` (`metodo-map.chatbot.initializer.v2`), do Guia de Uso Oficial (10 páginas) e dos PDFs de Moldes e Mapas Geométricos.

---

## 1. Análise Técnica do Prompt JSON (`MAP-CHATBOT-OBF-GZIP-B64-SYMBOLS-v2`)

O arquivo JSON anexado utiliza uma camada de ofuscação em 4 níveis no campo `payload`:
1. **Remoção de Ruído Unicode (`symbol_interval: 4`)**: Foram injetados **1.421 símbolos Unicode** (`§, ¤, ¶, •, ※, ◆, ◈, ✦, ☰, ∞, ∆, Ω, ◊, ★, ☆, ▲, △, ■, □, ±, ×, ÷, ¦, ¬, °`) a cada 4 caracteres do alfabeto Base64 ASCII.
2. **Decodificação Base64**: Os **5.684 caracteres** Base64 limpos resultam em **4.261 bytes** binários.
3. **Descompactação GZIP**: Os 4.261 bytes descompactam para **11.026 bytes** em UTF-8.
4. **Validação Criptográfica SHA-256**: O hash do JSON UTF-8 resultante corresponde exatamente a:
   `bc35b7c4bfa0cd46e5c21110207417406d1d449a952aa36e9b87446257bd9a71`

O código decodificado completo encontra-se salvo em [`docs/Metodo-MAP.decodificado.v2.json`](./docs/Metodo-MAP.decodificado.v2.json).

---

## 2. Máquina de Estados e Comandos Oficiais Implementados

### Comandos de Ativação (`activation.accepted_commands`)
- `Iniciar Método MAP`
- `INICIAR MÉTODO MAP`
- `Iniciar MAP`
- `Começar Método MAP`

### Comandos Visíveis de Operação (`visible_commands`)
- `CONFIRMAR MAPA` — Confirma o mapa de composição (`área → função → conteúdo → posição e orientação → sobreposição`) e libera a criação e exportação dos 2 PDFs.
- `CORRIGIR ÁREA [ID]` — Corrige a identificação ou a função de uma região específica (`A`, `B`, `C`, `D`, `E`...).
- `NOVA ARTE COM O MESMO MAPA` — Inicia outra arte preservando o molde oficial e o mapa geométrico já confirmados naquela branch.
- `TROCAR MOLDE OFICIAL` — Descarta o mapa atual e retorna ao estado `WAITING_PDF`.

### Fluxo da Máquina de Estados (`state_machine`)
1. `WAITING_ACTIVATION` → Aguarda comando de ativação.
2. `WAITING_PDF` → Solicita exclusivamente o PDF oficial (somente linhas ou com mapa geométrico colorido).
3. `ANALYZING_PDF` → Analisa dimensões físicas (`mm`), orientação (`Paisagem`/`Retrato`), contornos, linhas de corte/dobra, furos, QR Codes, marcas de registro e regiões coloridas.
4. `WAITING_REGION_MEANINGS` → Apresenta a tabela oficial de 6 colunas (`ID | Cor identificada | Forma e localização | Página e face ou região | Repetições | Sobreposições`) e faz a pergunta única consolidada sem presumir o significado das cores.
5. `BUILDING_MAP` → Converte as respostas do usuário em resumo estruturado e solicita `CONFIRMAR MAPA`.
6. `CREATING_ART` → Encaixa papéis digitais, barrados, personagens, nome e idade com sangria externa sem deformar o molde e protegendo as zonas de leitura de QR Code e marcas de registro.
7. `VERIFYING_OUTPUTS` / `READY` → Executa o checklist de controle de qualidade (`quality_control`) e entrega sincronizadamente:
   - **PDF para Impressão (`print_pdf`)**: Arte final + sangria + marcas técnicas preservadas, **sem** linhas de corte/dobra e **sem** cores-guia.
   - **PDF de Conferência (`proof_pdf`)**: Exatamente a mesma arte e coordenadas, com as **linhas do molde sobrepostas**.

---

## 3. Como Executar Localmente

```bash
npm install
npm run dev
```
