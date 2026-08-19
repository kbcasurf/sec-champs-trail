# Correções de design encontradas no /hm-designer QA (pós-ADR 0003)

Status: Spec aprovada, aguardando plano de implementação
Data: 2026-08-18
ADR de origem: `docs/adr/0003-application-design-system.md` (inclui uma "Amendment — runtime
QA fixes" de 2026-08-18, anterior a esta spec — ver seção 2 sobre o que ela já cobre)
Branch de trabalho: `fix/ui-design-qa-issues` (criada a partir de `main`, que já contém a
ADR 0003 e sua amendment mesclados via PR #8 e #9)

## 1. Contexto

Depois da ADR 0003 (design system) e da sua amendment (4 bugs de runtime QA já corrigidos:
overflow horizontal do nav mobile, truncamento sem tooltip no painel "Snapshot", checklist/
action-plan em branco para admin sem seletor de time, scrollbar invisível), foi rodado um
novo QA de runtime com a skill `/hm-designer` contra o container Docker já rodando (login
real como admin, navegação por Dashboard, Checklist, Action Plan, Teams, New Assessment, com
e sem time selecionado, e em viewport mobile 390×844).

Esse QA encontrou defeitos que a amendment da ADR 0003 **não** cobre — são problemas novos
ou não descobertos naquela rodada. Todo achado abaixo foi confirmado lendo o código-fonte
atual (não só a captura de tela), porque duas suspeitas iniciais do QA visual se revelaram
falsos positivos ao reler o código e retestar no app rodando:

- **Teams "sem affordance"**: descartado. `TeamsAdmin.tsx:113-123` já renderiza cada time
  como um `<button>` real, com hover e estado ativo (`border-accent-border bg-accent-soft`).
  Confirmado clicando no app: o painel direito (`grid-cols-[340px_1fr]`) mostra roster de
  champions, avatar, badge de role e formulário de adicionar champion — bem executado. O
  problema real é outro (ver item 4 abaixo).
- **Mobile nav "quebra completamente"**: parcialmente descartado. A amendment da ADR 0003 já
  tornou o header `flex-wrap` especificamente para eliminar overflow horizontal (bug
  funcional, já resolvido, com `scrollWidth === clientWidth` verificado a 390px). O que
  restou é puramente estético: sem menu hambúrguer, o header ocupa ~230px de altura antes do
  conteúdo em telas estreitas. Isto é uma melhoria de polish sobre uma decisão já documentada
  e aceita, não a correção de uma regressão — o item 5 abaixo deixa esse contexto explícito
  para não conflitar com a amendment existente.

## 2. Escopo

**Dentro do escopo** (4 bugs confirmados + 1 melhoria de polish):

1. Texto cortado no meio da palavra no radar chart do Dashboard (`AxisTick` em
   `Dashboard.tsx`) — ex.: "Start with a clear vision for your program" veio renderizado
   como "...your prog".
2. Barra de submit do formulário de assessment (`AssessmentForm.tsx:126`) sem separação
   visual do conteúdo que rola por trás dela.
3. Estado "nenhum time selecionado" sem nenhuma UI — tela em branco — em `Dashboard.tsx`,
   `ChecklistLibrary.tsx`, `ActionPlan.tsx` (área principal) e `TeamsAdmin.tsx` (coluna
   direita).
4. Favicon ausente (404 no console em toda navegação).
5. Menu hambúrguer para o header em mobile (melhoria sobre o `flex-wrap` já aceito na ADR
   0003 — não é fix de regressão).

**Fora do escopo** (explícito):

- Qualquer redesign de fluxo de dados (ex.: auto-selecionar o primeiro time de um admin ao
  carregar a página). Os testes existentes documentam deliberadamente "nada carrega até
  selecionar" — mudar isso é decisão de produto, não de design visual, e quebraria
  comportamento hoje coberto por teste.
- `ChecklistLibrary.tsx`'s `max-w-[820px]` centralizado — é escolha deliberada de
  legibilidade para texto longo, não o mesmo problema de espaço vazio do item 3.
- Qualquer mudança em `apps/api` — 100% frontend (`apps/web`).
- Reabrir ou reverter qualquer parte da amendment já mesclada da ADR 0003.

## 3. Decisões desta spec

| Tema | Decisão | Consequência |
|---|---|---|
| Onde documentar | Segunda **Amendment** em `docs/adr/0003-application-design-system.md`, no mesmo formato da existente (não uma ADR nova — é a mesma decisão de design, uma segunda rodada de QA) | Mantém o histórico de decisões de design em um único documento vivo. |
| Empty state | Um componente novo `EmptyState` em `apps/web/src/components/EmptyState.tsx` (primeiro arquivo em `components/`, os outros 6 arquivos hoje são todos `pages/`), reaproveitado nos 4 pontos do item 3 | DRY: um componente testado uma vez, usado 4 vezes, em vez de 4 blocos de JSX ad hoc. Reaproveita o mesmo hexágono da marca (`polygon points="12,2 20,7 20,17 12,22 4,17 4,7"`) já usado no header e no login, reforçando identidade visual em vez de um ícone genérico. |
| Wrap do label do radar | Função pura `wrapLabel(text, maxCharsPerLine = 18)` exportada de `Dashboard.tsx`, testável isoladamente, greedy word-wrap (nunca corta uma palavra no meio) | Alternativa descartada: `truncate` + `title` (como já foi feito no painel "Snapshot" pela amendment da ADR 0003) — rejeitada aqui porque o radar é um SVG, não HTML, então `title` não produz tooltip nativo em todos os navegadores sobre `<text>`/`<tspan>` de forma confiável; wrap multi-linha é a solução correta para rótulos ao redor de um gráfico polar. |
| Causa raiz da barra de submit | `bg-gradient-to-t from-bg from-60%` usa a cor `from-bg` (`#0a0d12`), que é **exatamente** a mesma cor do `body` (token `bg`) — o "gradiente" nunca produziu nenhuma separação visual perceptível, daí o botão parecer flutuando sem scrim. Trocado por `border-t border-line` (costura visível) + `bg-bg/95 backdrop-blur` (painel translúcido com blur real sobre o conteúdo atrás) | Fix mínimo e cirúrgico: 1 linha de className trocada, resto do JSX intocado. Não move nem redesenha o botão. |
| Menu mobile: duplicar nav ou reusar? | Reusar o mesmo `<nav>`/bloco de user-info existente, alternando `hidden`/`flex` via estado local + `md:flex` fixo, em vez de duplicar o JSX num drawer separado | `ProtectedRoute.test.tsx` usa `screen.getByRole("link", { name: /teams/i })` — jsdom não aplica CSS real, então duas cópias do mesmo link no DOM (uma "desktop", uma "mobile") quebrariam esse `getByRole` com "multiple elements found". Uma única instância evita esse risco por construção. |
| Auto-close do menu mobile | Todo `<Link>` de navegação e o botão de logout fecham o menu (`onClick` chama `setMenuOpen(false)`) além de sua ação normal | Sem isso, navegar por um link deixaria o menu mobile aberto por cima da página seguinte. |

## 4. Achados detalhados

### 4.1 Texto cortado no radar chart (`Dashboard.tsx`)

**O quê:** `AxisTick` (linhas 13-19) renderiza `payload?.value` como um único `<text>` sem
wrap. Em `Start with a clear vision for your program` — a legenda do princípio "Start with a
clear vision for your program" —, o SVG estoura a margem do card e o texto é cortado pelo
`overflow` do container em "...your prog".

**Por quê é bug:** nenhum texto do produto deve ser cortado; é uma regra de qualidade visual
sem exceção, e aqui é agravado por cortar no meio da palavra "program".

**Como corrigir:** ver Tarefa 2 do plano — wrap greedy por palavra em até 3 linhas via
`<tspan>`, mais margem/raio do `RadarChart` ajustados para dar espaço físico às 3 linhas.

### 4.2 Barra de submit sem separação visual (`AssessmentForm.tsx:126`)

**O quê:** confirmado em scroll real (não é artefato de captura full-page): o wrapper
`sticky bottom-0 mt-6 bg-gradient-to-t from-bg from-60% pb-1 pt-4` cobre a largura do form
(o `<div>` já é block-level, 100% do form), mas a cor do "gradiente" (`from-bg`) é idêntica à
cor de fundo da própria página — visualmente não existe. O botão "Submit assessment" parece
flutuar sem nenhuma pista visual, encostando no próximo card de pergunta ao rolar, mesmo com
apenas 1/10 perguntas respondidas.

**Por quê é bug:** nenhum elemento fixo deve parecer solto sobre o conteúdo; a barra de ação
precisa de uma costura (borda) ou contraste real para se diferenciar do que rola por trás.

**Como corrigir:** ver Tarefa 3 do plano — trocar a classe de fundo por uma combinação que
produza contraste real (`border-t` + fundo translúcido com blur).

### 4.3 Estado "nenhum time selecionado" sem UI (4 páginas)

**O quê:** `Dashboard.tsx`, `ChecklistLibrary.tsx` e `ActionPlan.tsx` só têm branches de
render para `error` e para os dados carregados (`scores`/`items`/`plan`) — quando `teamId`
é `null` (estado inicial de um admin, antes de escolher no `<select>`), nenhum desses
branches é verdadeiro e a área de conteúdo fica um retângulo vazio. Em `TeamsAdmin.tsx`, a
coluna direita (`grid-cols-[340px_1fr]`) só renderiza algo quando `{selected && (...)}` é
verdadeiro — antes do primeiro clique num time, o segundo track do grid existe (definido
explicitamente, então a largura de 1fr é reservada) mas fica sem nenhum filho.

**Por quê é bug:** todo estado da interface deve ser desenhado deliberadamente — "tela preta
vazia" não é um estado, é a ausência de um.

**Como corrigir:** ver Tarefas 1 e 4-7 do plano — um componente `EmptyState` reutilizável,
usado nos 4 pontos.

### 4.4 Favicon ausente

**O quê:** `apps/web/index.html` não tem `<link rel="icon">` e não existe
`apps/web/public/`. Toda navegação gera um 404 de `/favicon.ico` no console.

**Como corrigir:** ver Tarefa 8 do plano — SVG novo reaproveitando o hexágono da marca.

### 4.5 Menu hambúrguer mobile (melhoria, não regressão)

**O quê:** `ProtectedRoute.tsx` usa `flex flex-wrap` no header (fix da amendment da ADR
0003, que eliminou o overflow horizontal). O resultado visual é aceitável funcionalmente,
mas em 390px de largura o header ainda ocupa ~230px de altura com nav, badge, email e
logout todos empilhados em múltiplas linhas antes do logo se estabilizar.

**Como corrigir:** ver Tarefa 9 do plano — colapsar nav + user-info atrás de um botão
hambúrguer abaixo de `md`, sem duplicar o JSX (ver decisão na seção 3).

## 5. Testes

Cada bug acima ganha cobertura nova ou estendida (detalhado tarefa a tarefa no plano):

- `EmptyState.test.tsx` (novo): renderiza título/descrição/ação.
- `Dashboard.test.tsx`: teste novo de `wrapLabel` (função pura) + teste novo do empty state
  antes da seleção de time.
- `ChecklistLibrary.test.tsx`: estende o teste existente "shows a team selector for admins"
  com uma asserção do empty state.
- `ActionPlan.test.tsx`: estende o teste existente "shows a team selector for admins" com
  uma asserção do empty state.
- `TeamsAdmin.test.tsx`: teste novo do empty state antes de qualquer seleção.
- `ProtectedRoute.test.tsx`: sem mudanças — a estrutura de nav único (ver decisão na seção 3)
  garante que os testes existentes continuam válidos sem alteração.
- `AssessmentForm.test.tsx`: sem mudanças — o teste existente só verifica comportamento
  funcional do submit, não a classe CSS do wrapper.

## 6. Critérios de aceite

- `npm run typecheck -w apps/web` e `npm run lint -w apps/web` limpos.
- `npm run test -w apps/web` — todos os testes existentes continuam passando, mais os novos
  listados na seção 5.
- `docker compose up --build` e checagem visual manual (ou via Playwright MCP) de: Dashboard/
  Checklist/Action Plan/Teams sem time selecionado (empty state visível), radar chart com o
  princípio mais longo sem corte, `AssessmentForm` rolado até o meio sem o botão encostar no
  próximo card, aba do navegador com favicon, header em 390px de largura com hambúrguer
  funcional.
- Segunda amendment adicionada à ADR 0003 documentando os 5 itens.
