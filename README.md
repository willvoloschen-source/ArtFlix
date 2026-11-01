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
npm ci
npm run dev
```

Use `Abrir_ArtFlix_Studio.bat` no Windows. Como a instalação do npm pode travar na pasta sincronizada do Google Drive, o atalho copia a versão atual para `%TEMP%\ArtFlixStudio\run`, instala as dependências ali e abre a aplicação em `http://127.0.0.1:5173/`. Execute o atalho novamente após alterar os arquivos da pasta G:. O antigo HTML independente foi substituído por uma página de entrada para a aplicação autenticada; seu conteúdo anterior permanece recuperável no histórico do Git.

## 4. Contas, projetos privados e IA

O aplicativo Vite usa Supabase Auth, a tabela `artflix_profiles` para aprovações e `artflix_projects` para os documentos. As imagens e prévias de PDF ficam no bucket privado `artflix-assets`. As políticas RLS permitem que cada usuário ativo acesse apenas seus próprios projetos e arquivos. O painel de acessos aparece somente ao perfil `master`.

1. Copie `.env.example` para `.env.local`. A URL e a chave **publicável** do projeto `ArtFlixDB` já estão indicadas no exemplo. Nunca coloque a chave `service_role` ou a chave OpenAI em variáveis `VITE_`.
2. A migração `supabase/migrations/20261101192831_artflix_accounts_projects.sql` já foi aplicada ao projeto `zjvpbzfisamnodfpoujs`, e a função `supabase/functions/artflix-ai` já foi implantada com verificação JWT ativa.
3. Configure `OPENAI_API_KEY` como segredo da Edge Function no Supabase. Por padrão, o planejamento usa `gpt-6.1-terra` e a geração de imagens usa `gpt-image-2.5-flare`. Os modelos podem ser alterados com os segredos `OPENAI_TEXT_MODEL` e `OPENAI_IMAGE_MODEL`.
4. Cadastre `willvoloschen@gmail.com` e confirme o e-mail. Depois execute, uma única vez, o comando abaixo no SQL Editor do projeto para ativar o administrador master. O e-mail sozinho não concede privilégios.

```sql
update public.artflix_profiles set role = 'master', active = true
where email = 'willvoloschen@gmail.com'
  and id in (select id from auth.users where email_confirmed_at is not null);
```

Os novos cadastros ficam pendentes até aprovação no painel master. Se a chamada à OpenAI falhar, o estúdio usa o mecanismo local de composição e informa o resultado no fluxo da criação.
