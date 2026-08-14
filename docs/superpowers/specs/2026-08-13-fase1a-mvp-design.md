# Fase 1a — MVP sem IA (ChampionForge / Security Champions Assistant)

Status: Spec aprovada, aguardando plano de implementação
Data: 2026-08-13
PRD de origem: `PRD-security-champions-assistant.md` (F1, F2 simplificado, F4)
ADR de origem: `docs/adr/0001-fase0-fundacao.md` (Decisão 2, Decisão 6)
Fase anterior: `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`
Roadmap geral do projeto: `ROADMAP.md`

## 1. Contexto

A Fase 0 entregou a fundação técnica (monorepo, conteúdo OWASP curado, schema Prisma
completo, auth JWT local, Docker Compose, CI) sem nenhuma tela ou fluxo de produto. A
Fase 1a é a primeira fase a entregar produto utilizável, **sem** exigir chave de IA
configurada.

O log de execução da Fase 0
(`docs/superpowers/plans/2026-08-10-fase0-fundacao-execution-log.md`) deixou registradas
decisões explícitas que esta spec precisa fechar antes de implementar:
storage do JWT no frontend, se `Champion` precisa de FK direta para `Organization`, e se
os 2 mapeamentos `principleId` levemente frouxos nos checklists afetam o cálculo de
score. As três são resolvidas nas seções 3 e 6 abaixo.

**Esclarecimento de escopo importante** (levantado durante o brainstorming desta spec):
este produto **não** avalia a maturidade de segurança do SDLC/código de um time — essa
função já existe em outra ferramenta do mesmo portfólio (SAMMwise-ai, baseada em OWASP
SAMM) e está deliberadamente fora de escopo aqui. Os 10 princípios do Manifesto OWASP
Security Champions Guide (curados na Fase 0) descrevem como uma organização **recruta,
treina e retém** security champions — a `MaturityAssessment` desta fase mede a
maturidade desse **programa de champions**, não a maturidade técnica do código que os
times produzem, e não é uma autoavaliação de skill individual de um champion.

## 2. Escopo da Fase 1a

**Dentro do escopo:**
- **Gestão de Team** (pré-requisito de infraestrutura, não existia endpoint algum):
  admin cria `Team`, cria `Champion` e o atribui a um `Team`.
- **F1 — Avaliação de maturidade do programa**: questionário de 10 perguntas (uma por
  princípio), autoavaliação numa escala 0-4 com descrição textual própria por nível e
  por princípio. Escopo por `Team`, com histórico de snapshots (retake não sobrescreve).
- **F4 — Biblioteca de checklists**: navegação por princípio e fase do ciclo de vida
  (recrutamento / desenvolvimento-retenção), com marcação de progresso por item, por
  `Team`.
- **F2 simplificado — Plano de ação por regras**: gerado a partir do snapshot de
  avaliação mais recente do `Team`, sem IA, com regra determinística de priorização
  (roadmap 3/6/12 meses).

**Fora de escopo (explícito):**
- Qualquer avaliação de maturidade do SDLC/código do time (SAMM — outra ferramenta do
  portfólio).
- Autoavaliação de skill técnico individual de um champion.
- F3 (geração de trilhas por IA) e F5 (relatório executivo por IA) — Fase 1b.
- OIDC/SSO, multi-organização — inalterado desde a Fase 0 (ADR 0001, Decisões 3 e 5).
- Double-submit CSRF token, cookie `Secure` sobre HTTP puro em dev — ver seção 5.

## 3. Decisões desta spec

| Tema | Decisão | Consequência |
|---|---|---|
| Storage do JWT | Cookie `httpOnly` + `Secure` + `SameSite=Strict`, setado por `POST /auth/login` | Fecha a dívida da Fase 0. Exige `cookie-parser`, CORS com `credentials: true` e origem explícita (fecha também o CORS permissivo da Fase 0 como efeito colateral). Frontend não lê mais o token via JS. |
| FK `Champion` → `Organization` | Não adicionada | Uma única `Organization` por instância (ADR 0001, Decisão 3) torna o escopo sempre implícito. Autorização é 100% baseada em `role` (admin = acesso global) + `teamId` (champion = escopo do próprio time). |
| `Champion.teamId` obrigatório | Obrigatório para `role = champion` (validação de aplicação, não constraint de schema); `null` permitido só para `role = admin` | Necessário porque toda feature de produto desta fase é escopada por `Team`. |
| Nível de avaliação | Por `Team` (não por `Organization`) | `MaturityAssessment` já era modelada assim na Fase 0 — mantido. Cada time tem seu próprio radar; admin vê todos. |
| Histórico de avaliação | Múltiplos snapshots (`MaturityAssessment` nova a cada retake) | Preserva evolução ao longo do tempo, relevante já para F5 na Fase 1b. |
| Escopo do `ActionPlan` | Migra de `organizationId` (Fase 0) para `teamId` | Consistência com avaliação por Team: cada time prioriza seus próprios princípios fracos. |
| Formato do questionário | 1 pergunta de autoavaliação direta por princípio (não derivada de checklist items) | Simples, rápido, sem IA. Também torna os 2 mapeamentos `principleId` frouxos da Fase 0 irrelevantes para o cálculo de score (só afetam quais itens aparecem no plano de ação). |
| Descrições de nível de maturidade | Específicas por princípio (10 princípios × 5 níveis = 50 textos), conteúdo **autoral do projeto**, não derivado da OWASP | Exige tarefa de curadoria de conteúdo nova (autoria, não tradução) — ver seção 6. Não leva `license: "CC BY-SA 4.0"`, para não sugerir proveniência OWASP. |
| Regra de priorização do plano de ação | Ranking por score ascendente, buckets fixos 3/3/4 | Determinística e testável sem IA. |
| Progresso de checklist vs. plano de ação | Desacoplados (`ChecklistProgress` como fonte única de verdade) | Regenerar um `ActionPlan` nunca reseta progresso já marcado. |
| Permissão de escrita (assessment, checklist progress) | Qualquer `Champion` do time (não só admin) | Reflete o caráter colaborativo do programa. |
| Gestão de Team/Champion | CRUD básico incluído nesta fase, admin-only | Pré-requisito: sem isso, `teamId` obrigatório não seria alcançável sem editar o banco manualmente. |

## 4. Novas dependências

- `apps/api`: `cookie-parser` (+ `@types/cookie-parser` em dev).
- `apps/web`: `react-router-dom` (rotas), `recharts` (radar chart).

## 5. Autenticação (mudanças)

- `main.ts`: `app.use(cookieParser())`; `app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true })` — substitui o `app.enableCors()` sem opções da Fase 0 (achado de hardening adiado, fechado aqui como consequência necessária de cookies com `credentials`).
- `POST /auth/login`: em vez de devolver `{ accessToken }` no corpo, seta
  `Set-Cookie: accessToken=...; HttpOnly; Secure; SameSite=Strict; Path=/`.
  `SameSite=Strict` é a mitigação de CSRF adotada — suficiente para um app self-hosted de
  origem única sem necessidade de embutir em outro site. Um token CSRF de double-submit
  fica documentado aqui como hardening futuro, caso o app precise um dia de uso
  cross-origin. Em dev sem TLS, a flag `Secure` é condicionada a `NODE_ENV=production`
  (documentar em `.env.example`).
- Novo `POST /auth/logout`: limpa o cookie (`Set-Cookie` com `Max-Age=0`).
- Novo `GET /auth/me`: retorna `{ id, email, role, teamId }` do champion autenticado.
  Necessário porque o frontend não pode mais decodificar o payload do JWT via JS (cookie
  é `httpOnly`) — é a única forma do React saber quem está logado ao carregar a página.
- `JwtStrategy`: extractor customizado lendo `req.cookies?.accessToken` em vez de
  `ExtractJwt.fromAuthHeaderAsBearerToken()`.
- Guards novos (nenhuma rota tinha guard até agora):
  - `JwtAuthGuard` — wrapper padrão do Passport, aplicado a todo controller de produto.
  - `RolesGuard` + decorator `@Roles('admin')` — rotas admin-only (Team/Champion).
  - `TeamScopeGuard` — para rotas `/teams/:teamId/...`, permite se
    `req.user.role === 'admin'` OU `req.user.teamId === params.teamId`.

## 6. Novo conteúdo curado — níveis de maturidade

`packages/owasp-content/maturity-levels/<principleId>.json`, 5 descrições (níveis 0-4)
por princípio, **autoria do projeto** (não transcrição da OWASP — o guia oficial não
define uma escala numérica de maturidade por princípio). Novo tipo em
`packages/owasp-content/src/types.ts`:

```ts
export interface MaturityLevelDescription {
  principleId: string; // referencia principles[].id
  level: 0 | 1 | 2 | 3 | 4;
  description: string;
}
```

Sem campo `license` (evita sugerir proveniência CC BY-SA/OWASP que não existe para esse
conteúdo). `ATTRIBUTION.md` ganha uma nota explícita: a escala de maturidade é autoral do
projeto, não derivada do guia OWASP.

## 7. Modelo de dados (mudanças no Prisma schema)

Novo model, seed a partir do conteúdo da seção 6:

```prisma
model PrincipleMaturityLevel {
  id          String    @id @default(uuid())
  principleId String
  principle   Principle @relation(fields: [principleId], references: [id])
  level       Int       // 0-4
  description String

  @@unique([principleId, level])
  @@index([principleId])
}
```

`ActionPlan` migra de `organizationId` para `teamId`, e passa a referenciar de qual
`MaturityAssessment` foi gerado (rastreabilidade do snapshot de origem):

```prisma
model ActionPlan {
  id           String             @id @default(uuid())
  teamId       String
  team         Team               @relation(fields: [teamId], references: [id])
  assessmentId String
  assessment   MaturityAssessment @relation(fields: [assessmentId], references: [id])
  createdAt    DateTime           @default(now())

  actionItems ActionItem[]

  @@index([teamId])
  @@index([assessmentId])
}
```

`ActionItem` perde o campo `status` (passa a ser só a associação "este checklist item
está neste plano, neste bucket"; ganha `bucket`):

```prisma
enum ActionBucket {
  three_months
  six_months
  twelve_months
}

model ActionItem {
  id              String        @id @default(uuid())
  actionPlanId    String
  actionPlan      ActionPlan    @relation(fields: [actionPlanId], references: [id])
  checklistItemId String
  checklistItem   ChecklistItem @relation(fields: [checklistItemId], references: [id])
  bucket          ActionBucket

  @@unique([actionPlanId, checklistItemId])
  @@index([actionPlanId])
  @@index([checklistItemId])
}
```

Novo model `ChecklistProgress` — fonte única de verdade do progresso, desacoplada do
ciclo de vida do `ActionPlan` (serve tanto F4 quanto F2; regenerar um plano nunca reseta
progresso já marcado):

```prisma
model ChecklistProgress {
  id              String            @id @default(uuid())
  teamId          String
  team            Team              @relation(fields: [teamId], references: [id])
  checklistItemId String
  checklistItem   ChecklistItem     @relation(fields: [checklistItemId], references: [id])
  status          ActionItemStatus  @default(pending)
  updatedAt       DateTime          @updatedAt

  @@unique([teamId, checklistItemId])
  @@index([teamId])
  @@index([checklistItemId])
}
```

Ajustes adicionais no mesmo conjunto de migrations (fecham dívidas registradas no log de
execução da Fase 0):
- Índice dedicado em `PrincipleScore.principleId` (hoje só coberto como 2ª coluna do
  índice composto `[assessmentId, principleId]` — busca isolada por `principleId` não
  usa esse índice por causa de leftmost-prefix).
- `Organization.actionPlans` é removida (a relação passa a existir só em `Team`).

As migrations continuam sendo geradas via `npm run db:migrate --workspace=apps/api`
(Prisma Migrate) e commitadas em `apps/api/prisma/migrations/`, que já é a pasta
versionada em git desde a Fase 0 (`20260811023959_init`,
`20260811025843_add_fk_indexes`) — funciona como histórico/backup permanente do schema,
sem necessidade de infraestrutura adicional.

`Champion.teamId` permanece `String?` no schema Prisma (sem constraint condicional no
banco); a obrigatoriedade para `role = champion` é validada na camada de serviço
(`ChampionsService`), não no schema.

## 8. API — endpoints novos

| Rota | Método | Guard | Descrição |
|---|---|---|---|
| `/teams` | POST | admin | cria `Team` |
| `/teams` | GET | admin | lista `Team`s |
| `/teams/:teamId` | GET | admin | detalhe de um `Team`, incluindo seus `Champion`s (necessário pra página `/teams` do admin mostrar quem já está atribuído) |
| `/champions` | POST | admin | cria `Champion` (email/senha/role/teamId; valida `teamId` obrigatório se `role=champion`) |
| `/principles` | GET | autenticado | lista os 10 princípios + `PrincipleMaturityLevel` (monta o questionário) |
| `/checklist-items` | GET | autenticado | biblioteca completa, filtrável por `principleId`/`phase` |
| `/teams/:teamId/assessments` | POST | team-scope | submete novo snapshot (10 scores, 0-4, um por princípio) |
| `/teams/:teamId/assessments` | GET | team-scope | histórico de snapshots |
| `/teams/:teamId/assessments/latest` | GET | team-scope | snapshot mais recente (radar chart) |
| `/teams/:teamId/checklist-progress` | GET | team-scope | progresso atual de todos os itens |
| `/teams/:teamId/checklist-progress/:checklistItemId` | PATCH | team-scope | atualiza status de um item |
| `/teams/:teamId/action-plans` | POST | team-scope | gera novo plano a partir do assessment mais recente |
| `/teams/:teamId/action-plans/latest` | GET | team-scope | plano vigente, status de cada item resolvido via `ChecklistProgress` |
| `/auth/logout` | POST | autenticado | limpa o cookie |
| `/auth/me` | GET | autenticado | identidade do usuário logado |

`POST /teams/:teamId/assessments` rejeita submissões com menos de 10 scores ou
`principleId` fora dos 10 princípios seedados (400).

## 9. Regra de geração do plano de ação (determinística)

Função pura, testável isoladamente sem tocar banco:

1. Pega os 10 `PrincipleScore` do `MaturityAssessment` mais recente do time.
2. Ordena por `score` ascendente; empate desempatado pela ordem fixa dos princípios
   (`Principle.order`) — garante resultado determinístico e reproduzível em teste.
3. Os 3 primeiros (mais fracos) → `three_months`; próximos 3 → `six_months`; últimos 4
   (mais fortes) → `twelve_months`.
4. Todo `ChecklistItem` cujo `principleId` caiu em um desses grupos vira um `ActionItem`
   no bucket correspondente.
5. Um novo `ActionPlan` é sempre uma linha nova (histórico preservado, referenciando o
   `assessmentId` de origem); `ChecklistProgress` nunca é escrito por esse processo.

## 10. Frontend

Rotas novas (`react-router-dom`), todas atrás de um `ProtectedRoute` que depende de
`AuthContext` (que carrega `GET /auth/me` uma vez ao montar o app; 401 → redireciona
para `/login`):

- `/login` — ajustada: fetch com `credentials: 'include'`, não grava mais nada em
  `localStorage` (o cookie é setado pela própria resposta HTTP).
- `/dashboard` — radar chart (`recharts`) do assessment mais recente do time do usuário;
  admin tem um seletor de time.
- `/assessment/new` — formulário com as 10 perguntas; envio atômico (todas as 10
  respostas de uma vez, sem rascunho parcial).
- `/checklist` — biblioteca navegável por princípio/fase, checkbox por item refletindo
  `ChecklistProgress`.
- `/action-plan` — buckets de 3/6/12 meses com status resolvido via `ChecklistProgress`;
  botão "gerar novo plano".
- `/teams` (admin only) — criar `Team`, criar `Champion` e atribuí-lo a um `Team`.

## 11. Testes

Mesmo padrão de cobertura da Fase 0:
- **Jest (unit)**: services novos, com destaque para a função pura de geração do plano
  de ação (cobrindo empate de score e o corte 3/3/4) e a validação "teamId obrigatório
  se role=champion".
- **Jest e2e (supertest)**: cada controller novo, cobrindo caminho feliz + 401 (sem
  cookie) + 403 (champion tentando acessar `teamId` de outro time).
- **Vitest + Testing Library**: páginas novas do `apps/web`, com fetch mockado
  (`credentials: 'include'` incluso na asserção das chamadas).

## 12. Critérios de aceite da Fase 1a

- [ ] Admin consegue: criar Team, criar Champion e atribuí-lo a um Team, tudo via API
      (UI mínima aceitável).
- [ ] Champion consegue logar (cookie httpOnly setado), responder o questionário de
      avaliação do seu time e ver o radar chart do resultado.
- [ ] Retake da avaliação cria um novo snapshot sem apagar o anterior (histórico
      consultável).
- [ ] Champion consegue navegar a biblioteca de checklists por princípio/fase e marcar
      progresso por item.
- [ ] Sistema gera um plano de ação (3/6/12 meses) a partir do assessment mais recente,
      priorizando os 3 princípios de menor score no bucket de 3 meses.
- [ ] Regenerar o plano de ação preserva o status de progresso já marcado nos checklist
      items.
- [ ] Champion de um time não consegue ler/escrever dados de outro time (403).
- [ ] CI (lint + typecheck + test + e2e) passa com as mudanças.
- [ ] `ATTRIBUTION.md` atualizado com a nota sobre a escala de maturidade ser conteúdo
      autoral do projeto.

## 13. Itens adiados (não bloqueantes, candidatos a fase futura)

| Área | Item | Quando revisitar |
|---|---|---|
| Auth | Double-submit CSRF token (hoje: só `SameSite=Strict`) | Se o app precisar de uso cross-origin/embutido |
| Dados | 2 mapeamentos `principleId` levemente frouxos nos checklists (Fase 0) | Só afeta quais itens aparecem no plano de ação daquele princípio — não bloqueia esta fase |
| Auth | Canal lateral de timing por enumeração de e-mail, sem `@MaxLength(72)` na senha (Fase 0) | Continuam adiados, sem relação com o escopo desta fase |
| Docker | Credenciais padrão de dev, containers como root (Fase 0) | Antes de qualquer deployment além de dev local |
