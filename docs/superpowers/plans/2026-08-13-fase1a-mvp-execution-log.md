# Fase 1a (MVP sem IA) — Log de Execução

Plano executado: `docs/superpowers/plans/2026-08-13-fase1a-mvp.md`
Método: `superpowers:subagent-driven-development` — um subagente implementador por
tarefa, revisão de tarefa (spec + qualidade) após cada uma, revisão final de branch
inteira ao término, tudo em um worktree isolado (`worktree-fase1a-mvp`, via `EnterWorktree`).
Merge em `main`: 2026-08-15 (fast-forward, 26 commits, `6a867a1`).

> Este documento reconstrói o ledger de execução mantido durante o trabalho em
> `<worktree>/.superpowers/sdd/2026-08-13-fase1a-mvp/progress.md` — um arquivo
> propositalmente não versionado (workspace de trabalho da skill de execução), removido
> junto com o worktree ao final. Esta versão é a cópia permanente desse histórico.

## Varredura de pré-voo (antes da Tarefa 1)

Scan do plano contra conflitos internos e contra a spec: nenhum conflito genuíno
encontrado. Duas ressalvas já documentadas no próprio texto do plano (os 5 stubs de
página da Tarefa 14 e a nota explicativa sobre o teste 3 da Tarefa 12) não exigiram
decisão do usuário — prosseguiu sem comentário, conforme a skill.

## Execução tarefa a tarefa

**Task 1 — Prisma schema (novos modelos, reshape de ActionPlan/ActionItem, índice
faltante)**
Critical (fix round 1/5): migration escrita à mão em vez de gerada pela ferramenta
(ambiente não-interativo bloqueava `prisma migrate dev`), introduzindo `DEFAULT ''` /
`DEFAULT 'three_months'` não declarados no `schema.prisma` — risco de drift. Corrigido
regenerando via `prisma migrate diff` contra um shadow database, sem defaults espúrios.
complete (commits `af0ed07..f276724`, review clean após 1 round de fix).

**Task 2 — `packages/owasp-content`: descrições de nível de maturidade (autorais)**
complete (commits `f276724..72a72fe`, review clean — conteúdo verbatim confirmado via
diff estrutural JSON contra o brief; sem campo `license`; nota em `ATTRIBUTION.md`
correta).

**Task 3 — Seed script: popular `PrincipleMaturityLevel`**
complete (commits `72a72fe..32aae90`, review clean).

**Task 4 — Guards de auth: `JwtAuthGuard`, `RolesGuard`, `TeamScopeGuard`**
Ambiguidade de ordenação resolvida no dispatch: os guards referenciavam
`JwtPayload.teamId`, campo que só a Tarefa 5 adicionaria — resolvido adicionando o
campo à interface já nesta tarefa.
Critical (fix round 1/5, disparado por revisão de segurança automática pós-commit):
`RolesGuard` não verificava `user` quando nenhum `@Roles()` era exigido (fail-open);
`TeamScopeGuard` podia falhar aberto se `params.teamId` viesse `undefined` coincidindo
com `user.teamId` também `undefined`. Ambos corrigidos para falhar fechado.
complete (commits `32aae90..8649f24`, review clean após 1 round de fix).

**Task 5 — Auth: cookie httpOnly, `/auth/logout`, `/auth/me`**
complete (commits `8649f24..7628075`, review clean — `GET /auth/me` reshapea `sub`→`id`
para bater exatamente com o formato de `POST /auth/login`, corrigido antes do dispatch).

**Task 6 — `TeamsModule` (CRUD admin-only)**
complete (commits `7628075..cb1010e`, review clean).

**Task 7 — `ChampionsModule` (criação admin-only, validação de teamId)**
Important (fix round 1/5): email duplicado gerava 500 não tratado (faltava capturar
`P2002`); e um achado **plan-mandated** — o teste e2e assumia uma Organization já
existente via `findFirstOrThrow()` em vez de criar a própria (mesmo código do plano),
risco real de race sob workers paralelos do Jest. Usuário consultado explicitamente
(achado plan-mandated) e confirmou a correção. Ambos corrigidos: duplicado → 409
Conflict; e2e agora faz upsert idempotente do mesmo `org-default` que `teams.e2e-spec.ts`
usa — padrão replicado proativamente em todas as tarefas e2e seguintes que precisavam de
uma Organization.
complete (commits `cb1010e..4a304f5`, review clean após 1 round de fix).

**Task 8 — `PrinciplesModule` (leitura, autenticado)**
complete (commits `4a304f5..6091b0a`, review clean).

**Task 9 — `ChecklistItemsModule` (leitura, filtrável)**
complete (commits `6091b0a..b14fb53`, review clean).

**Task 10 — `AssessmentsModule` (submit/list/latest, team-scoped)**
Nota ambiental (não é defeito de código): implementador reportou 3 falhas em
`bootstrap-admin.spec.ts`; verificado independentemente que era acúmulo de estado no
Postgres local persistente entre muitos dispatches manuais desta sessão — em CI real
(container novo por execução, `test` antes de `test:e2e`) nunca ocorre. Confirmado com
banco resetado: 35/35 testes unitários verdes.
complete (commits `b14fb53..e6c7774`, review clean).

**Task 11 — `ChecklistProgressModule` (list/update, team-scoped)**
complete (commits `e6c7774..8eeb566`, review clean).

**Task 12 — Gerador de plano de ação (função pura)**
Implementador encontrou e corrigiu um bug real no próprio código de exemplo do plano:
sem reordenar a saída pelo rank, o próprio teste de desempate do plano falharia.
complete (commits `8eeb566..7f6d80e`, review clean).

**Task 13 — `ActionPlansModule` (generate/latest, team-scoped) — BACKEND COMPLETO**
Implementador encontrou e corrigiu um bug real de ordem de FK no `afterAll` de teste
e2e do próprio plano (`ActionItem` precisa ser deletado antes de `ActionPlan`, sem
cascade no schema). Teste e2e mais importante do plano — "regenerar plano preserva
progresso" — passou de ponta a ponta, confirmado em 3 execuções consecutivas.
complete (commits `7f6d80e..f2a3321`, review clean).

**Task 14 — Infraestrutura de auth do frontend (`AuthContext`, `ProtectedRoute`,
routing, rework do `Login`)**
complete (commits `f2a3321..173217e`, review clean).

**Task 15 — Página `Dashboard` (radar chart)**
Implementador corrigiu um bug de closure em `useState` (`user?.teamId` só lido na
primeira render). Revisor determinou que, na prática, o bug nunca se manifesta em
produção (`Dashboard` só monta depois que `ProtectedRoute` já resolveu `user`), mas o
fix era necessário para o teste unitário standalone — inofensivo, mantido.
complete (commits `173217e..4298be3`, review clean).

**Task 16 — Página `AssessmentForm`**
complete (commits `4298be3..02f63d1`, review clean).

**Task 17 — Página `ChecklistLibrary`**
Important (fix round 1/5): faltava checagem de `res.ok` no GET e no PATCH (mesma classe
de bug já corrigida autonomamente nas Tarefas 12/13/15 — não uma decisão de design,
corrigido sem consultar o usuário). Ambos corrigidos com estado de erro exibido.
complete (commits `02f63d1..ba1fc1e`, review clean após 1 round de fix).

**Task 18 — Página `ActionPlan`**
Important (fix round 1/5): teste "posts and reloads" só verificava que o POST disparava,
nunca que o GET de recarregamento realmente acontecia (assertion tautológica). Corrigido
para contar chamadas ao `/latest` antes/depois do clique; adicionado teste do caminho de
falha do `handleGenerate`.
complete (commits `ba1fc1e..c89cb09`, review clean após 1 round de fix).

**Task 19 — Página `TeamsAdmin` (última tarefa do plano)**
Orientação proativa sobre `res.ok` incluída no dispatch (padrão recorrente das últimas
tarefas) — implementador já entregou os 4 call sites tratados corretamente.
complete (commits `c89cb09..d3df520`, review clean) — **TODAS AS 19 TAREFAS COMPLETAS**.

## Revisão final de branch inteira (após a Tarefa 19)

Dispatch em modelo mais capaz (`opus`), cobrindo todo o range `af0ed07..d3df520` (24
commits). Encontrou **2 Críticos** e **7 Importantes** (2 tratados como Important
adicionais além dos 5 do resumo executivo) — gaps de integração entre tarefas que
nenhuma revisão individual conseguiria pegar isoladamente:

- **C1**: `npm run lint` falhava em `apps/api` (import não usado `ROLES_KEY`, já
  sinalizado no ledger como pendência) — ainda não corrigido.
- **C2**: `npm run lint` falhava em `apps/web` — `ActionPlan.tsx` tinha um
  `eslint-disable-next-line react-hooks/exhaustive-deps` para uma regra nunca
  configurada no projeto, achado novo que nenhum diff isolado revelaria.
- **I1**: `NODE_ENV` nunca é setado em lugar nenhum — o cookie `Secure` nunca engaja em
  nenhum ambiente real do repositório.
- **I2**: `ChecklistLibrary` renderizava lista plana sem navegação por princípio/fase —
  critério de aceite 4 só meio atendido; `GET /checklist-items` (construído e testado na
  Tarefa 9) nunca era chamado pelo frontend.
- **I3**: nenhum teste verificava que reavaliar preserva histórico (decisão central do
  F1) — gap identificado desde a Tarefa 10, nunca fechado.
- **I4**: `res.ok` ainda faltava em `Dashboard.tsx` (`/teams`) e `AssessmentForm.tsx`
  (`/principles`) — dois casos que escaparam do padrão já fixado em 4 outras páginas.
- **I5**: cobertura e2e de caminhos negativos rasa — faltava 403 para não-admin criando
  Champion (escalação de privilégio) e para champion escrevendo em checklist de outro
  time.
- **I6**: linha `org-default` de Organization deixada pelos testes e2e quebra
  `bootstrap-admin.spec.ts` em qualquer banco local persistente (não em CI real) —
  revisor considerou a triagem anterior da Task 10 ("nota ambiental, sem ação") um
  **mis-triage**, já que o problema reaparece de forma determinística em qualquer banco
  de dev de longa duração, não só nesta sessão.

**Fix wave única** (todos os 7 achados Críticos/Importantes endereçados em um único
dispatch, commits `0db5ecf`, `6a867a1`): removido import não usado; removido comentário
eslint-disable órfão; documentado `NODE_ENV=production` em `.env.example` sem alterar o
`docker-compose.yml` de dev; `ChecklistLibrary` reescrita para agrupar por fase/princípio
reaproveitando dados já presentes na resposta de `checklist-progress`; teste e2e de
retomada de histórico adicionado; `res.ok` adicionado às duas páginas restantes; 2 testes
403 adicionados; `bootstrap-admin.spec.ts` ganhou `beforeAll` que limpa todas as tabelas
dependentes em ordem segura de FK antes de suas próprias asserções.

**Re-revisão escopada**: todos os 7 achados marcados ADDRESSED, sem quebra nova
verificada. Lint, typecheck, testes unitários e e2e (24/24) confirmados verdes de forma
independente pelo próprio revisor.

**9 achados Minor** da revisão final não entraram no loop de fix (por processo) e ficam
registrados aqui para referência futura — ver seção "Itens adiados" abaixo.

## Merge para `main`

- Testes verificados verdes no resultado mesclado (lint + typecheck + 45 testes
  unitários da API + 18 do frontend + 5 do owasp-content + 24 e2e).
- Uma execução isolada da suíte e2e falhou de forma intermitente tanto durante a
  verificação final do SDD quanto durante a verificação pós-merge — em ambos os casos,
  uma nova execução imediata voltou a 24/24 verde. Consistente com o risco de
  concorrência entre workers do Jest já documentado (achado adiado "e2e sem
  `maxWorkers: 1`"), não uma regressão.
- `worktree-fase1a-mvp` mesclada em `main` via fast-forward, sem conflitos.
- Worktree e branch de feature removidos após confirmação.

## Resumo de achados adiados (não bloqueantes, candidatos a fase futura)

| Área | Achado | Quando revisitar |
|---|---|---|
| Frontend | Score de pergunta de avaliação não respondida vira 0 silenciosamente, e esse 0 entra de fato no ranking do plano de ação (o mais próximo de load-bearing entre os adiados) | Antes de expor a avaliação a orgs reais — considerar exigir todas as 10 respostas antes de habilitar o submit |
| Auth | `POST /auth/logout` não tem `JwtAuthGuard` (inofensivo — limpar cookie ausente é no-op) | Se o endpoint table da spec precisar bater 100% literalmente |
| API | Sem checagem de existência de time nos serviços team-scoped — teamId inválido de um admin gera 500 em vez de 400/404 | Quando o admin ganhar uma forma de referenciar times por fora da UI própria (ex: API pública) |
| API | `TeamsService.create` usa `findFirstOrThrow()` — 500 não mapeado se `bootstrap:admin` nunca rodou | Adicionar guard/mensagem amigável antes de qualquer uso fora de dev |
| Frontend | Admin vê `/checklist` e `/action-plan` em branco (só `/dashboard` tem seletor de time) | Fase 1b, ao revisar a navegação do admin |
| Testes | Suíte e2e roda em paralelismo padrão do Jest, sem `maxWorkers: 1`, com 9 arquivos fazendo upsert do mesmo `org-default` | Pin `maxWorkers: 1` no `jest-e2e.json` — resolveria a flakiness intermitente observada |
| CI | `.github/workflows/ci.yml` não seta `WEB_ORIGIN` (inofensivo hoje — e2e não passa pelo bootstrap de `main.ts`) | Se algum teste futuro passar a testar o boot real da aplicação |
| Testes | Bounds de score (0-4) do DTO nunca testados ponta a ponta | Antes de expor a API a clientes externos além do próprio frontend |
| Frontend | Inconsistência de limpeza de erro entre páginas (`ActionPlan` limpa em sucesso, `ChecklistLibrary`/`TeamsAdmin` não) | Padronizar quando uma camada de UI compartilhada for extraída |
| Dados (herdado da Fase 0) | Canal lateral de timing por enumeração de e-mail; sem `@MaxLength(72)` na senha | Continuam adiados, sem relação com o escopo desta fase |
| Docker (herdado da Fase 0) | Credenciais padrão de dev, containers como root | Antes de qualquer deployment além de dev local |
