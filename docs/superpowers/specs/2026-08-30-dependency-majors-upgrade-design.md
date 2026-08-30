# Atualização de dependências major (NestJS 11, react-router 7, vite 6, vitest 4)

Status: Spec aprovada, aguardando plano de implementação
Data: 2026-08-30
Origem: PR #13 do dependabot (`dependabot/npm_and_yarn/npm_and_yarn-413be113e0`), aberto em
2026-08-20, com CI vermelho em todos os jobs (`lint`, `typecheck`, `unit`, `e2e`,
`npm-audit`, `dast`) desde a criação.
Branch de trabalho: `deps/nestjs11-vite6-vitest4-react-router7` (a partir de `main`)
Débito técnico relacionado: `docs/adr/0004-security-hardening.md` já registrava o
upgrade NestJS 10→11 e a correção completa do advisory do `react-router` como follow-up
não feito naquela hardening pass, exatamente pelo motivo que este documento resolve agora.

## 1. Contexto

O PR #13 do dependabot agrupa 4 atualizações, todas major, em um único PR "grouped update":

| Pacote | De | Para (PR) | Tipo |
|---|---|---|---|
| `@nestjs/core` | 10.4.22 | 11.1.18 | major |
| `react-router` / `react-router-dom` | 6.30.6 | 7.18.2 | major |
| `vite` | 5.4.21 | 6.4.3 | major |
| `vitest` | 2.1.9 | 4.1.11 | dois majors |

O PR quebra `npm ci` antes de qualquer teste rodar:

```
npm error ERESOLVE unable to resolve dependency tree
npm error Found: @nestjs/common@10.4.22
npm error peer @nestjs/common@"^11.0.0" from @nestjs/core@11.2.1
```

Causa raiz: o dependabot bumpou **só** `@nestjs/core` para a linha 11.x, mas não os demais
pacotes `@nestjs/*` do workspace `apps/api` (`@nestjs/common`, `@nestjs/platform-express`,
`@nestjs/jwt`, `@nestjs/passport`, `@nestjs/testing`, `@nestjs/cli`), que ficaram presos em
10.x. `@nestjs/core@11` exige `@nestjs/common@^11.0.0` como peer dependency — conflito
imediato. Isso não é uma limitação do dependabot em si; é o grouped update não cobrindo
pacotes que só aparecem como peer dependency e não estão listados individualmente no
`package.json` do grupo.

`npm audit --omit=dev --audit-level=moderate` no `main` atual confirma as CVEs moderadas
que essa atualização fecha:

```
@nestjs/common          moderate  10.4.16 - 10.4.22 || 11.0.16 - 11.1.16 || 12.0.0-alpha.*
@nestjs/core            moderate  <=11.1.17
@nestjs/platform-express moderate <=11.0.12
body-parser             moderate  <=1.20.5 || 2.0.0-beta.1 - 2.0.2
express                 moderate  4.21.0 - 4.22.1 || 5.0.0-alpha.1 - 5.0.1
file-type               moderate  13.0.0 - 21.3.1
qs                      moderate  6.11.1 - 6.15.1
react-router            moderate  6.0.0 - 7.17.0
react-router-dom        moderate  6.0.0-alpha.0 - 7.17.0
```

Ponto que não estava óbvio quando a ADR 0004 foi escrita: naquele momento a única versão
patcheada conhecida do advisory do `react-router` era a `8.3.0` (que exige React 19.2.7+,
fora de cogitação). O range vulnerável real é `6.0.0 - 7.17.0` — ou seja, **7.18.0 já
resolve o advisory**, sem precisar do salto para a v8/React 19. A versão que o dependabot
propõe (7.18.2) já fecha essa CVE.

## 2. Escopo

**Dentro do escopo** (as 4 atualizações do PR #13, feitas de forma que `npm ci` e todos os
gates de CI passem):

1. `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/testing` →
   `11.2.3` (última da linha 11.x na data desta spec — acima de todas as faixas
   vulneráveis listadas acima).
2. `@nestjs/jwt` → `11.0.2`, `@nestjs/passport` → `11.0.5` (exigido por peer dependency de
   `@nestjs/common@11`; `@nestjs/passport@11` também exige `passport@^0.7.0`, já atendido).
3. `@nestjs/cli` → `11.0.24` (dev dependency, sem peer dependency direta em `@nestjs/core`,
   mas deve acompanhar a major para manter o toolchain do Nest consistente).
4. `@nestjs/throttler` **permanece em `^6.5.0`** — seu peer dependency já aceita
   `@nestjs/core@^11.0.0` (`"@nestjs/core": "^7.0.0 || ... || ^11.0.0"`), não precisa mudar.
5. `react-router` / `react-router-dom` → `^7.18.2` em `apps/web`.
6. `vite` → `^6.4.3` em `apps/web`.
7. `vitest` → `^4.1.11` em `apps/web` e `packages/owasp-content`. Peer dependency de
   `vitest@4.1.11` exige `vite@^6.0.0 || ^7.0.0 || ^8.0.0` — já atendido pelo item 6.
8. `@vitejs/plugin-react` → `^5.2.0` em `apps/web`. Não fazia parte do PR #13, mas é o
   mesmo tipo de lacuna que quebrou o `@nestjs/core`: a versão atual (`^4.3.0`) declara
   peer dependency só até `vite@^5.0.0`; sem subir esse pacote junto, o `npm ci` quebraria
   de novo por `ERESOLVE`, agora no `vite@6`. Confirmado via `npm view
   @vitejs/plugin-react@5.2.0 peerDependencies` → `"vite": "^4.2.0 || ^5.0.0 || ^6.0.0 ||
   ^7.0.0"`.
9. Ajustar o `npm-audit` do CI de volta a `--audit-level=high` → já está assim; ao final
   desta atualização o audit deve passar limpo em `--audit-level=moderate` também (não é
   obrigatório apertar o gate agora, mas serve de critério de aceite: se o audit não
   estiver limpo em moderate ao final, a spec não cumpriu o objetivo).
10. Fechar o PR #13 do dependabot após o merge do PR manual desta spec (o dependabot cria
    PRs individuais menores na próxima varredura se ainda houver algo pendente).

**Fora do escopo** (explícito):

- `@nestjs/*` → v12 (já existe, `12.0.1`/`12.0.0`). Não avaliado aqui; a ADR 0004 e o PR
  do dependabot só cobriam o salto 10→11. Subir para v12 sem avaliação própria seria scope
  creep.
- `react-router` → v8 / React 18 → 19. Como visto acima, não é mais necessário para fechar
  o advisory de segurança (7.18.2 já resolve). Fica como debt separado se algum dia quiser
  as features do v8.
- Baixar o gate de `npm-audit` do CI para `--audit-level=moderate` de forma permanente —
  fora de escopo a menos que o audit não feche limpo em `high` ao final (não esperado,
  dado que todas as faixas vulneráveis listadas acima são fechadas pelas versões alvo).
- Qualquer mudança de UI/UX em `apps/web` além do necessário para os testes continuarem
  passando após a migração do react-router/vitest.
- Migrar `apps/web` para o modo "data router" do react-router (`createBrowserRouter` +
  loaders/actions). O código já usa exclusivamente a API declarativa
  (`BrowserRouter`/`Routes`/`Route`/`Link`/`Navigate`/`Outlet`/hooks), que segue suportada
  em v7 sem mudanças — não há motivo para migrar de modo agora.

## 3. Levantamento de risco por biblioteca

### 3.1 NestJS 10 → 11 (risco médio-alto, é o item mais delicado)

- **Uso de `@Res()` no código**: só em `apps/api/src/auth/auth.controller.ts` (`login` e
  `logout`), ambos com `{ passthrough: true }` — ou seja, o Nest ainda controla a
  serialização da resposta; o handler só usa `res.cookie()`/`res.clearCookie()`, que
  continuam disponíveis e com a mesma assinatura no Express 5. Risco baixo aqui
  especificamente, mas é o único ponto do código que toca o objeto `Response` do Express
  diretamente, então deve ser reexecutado manualmente (login/logout) na verificação em
  browser.
- **`@nestjs/platform-express@11.2.3` traz Express 5 por padrão** (`express@5.2.1` como
  dependency direta, confirmado via `npm view`). Breaking changes do Express 5 relevantes
  para checar:
  - Sintaxe de wildcard de rota mudou de `'*'` para `'{*splat}'` — `grep -rn "'\*'"` em
    `apps/api/src` não encontrou nenhuma rota wildcard. Sem impacto.
  - Parser de query string default mudou de `extended` (`qs`, suporta `?a[b]=c`) para
    `simple` (`querystring`, só chave=valor plano). Único DTO de query no projeto é
    `ChecklistItemsQueryDto` (`principleId?: string`, `phase?: "recruitment" |
    "development_retention"`) — nenhum campo array/aninhado. Sem impacto.
  - Assinaturas antigas de `res.send(status, body)` / `res.json(status, body)` foram
    removidas — `grep` não encontrou nenhum uso desse padrão no código. Sem impacto.
  - `app.param(callback)` (assinatura antiga) removido — não usado no projeto.
- **`@nestjs/jwt`, `@nestjs/passport`** precisam subir junto (ver tabela do escopo) por
  peer dependency; sem isso o `npm ci` quebra do mesmo jeito que quebrou no PR #13.
- **Estratégia de teste**: a suíte de `unit` (Jest, não afetada pelo bump do vitest) e
  `e2e` (Supertest + `@nestjs/testing`) do `apps/api` são o principal sinal de regressão
  aqui. Rodar localmente antes de confiar no CI.

### 3.2 react-router 6 → 7 (risco baixo)

- Uso no código é 100% API declarativa via `react-router-dom`: `BrowserRouter`, `Routes`,
  `Route`, `Link`, `Navigate`, `Outlet`, `MemoryRouter` (em testes), `useNavigate`,
  `useParams`, `useLocation`. Nenhum uso de `createBrowserRouter`, loaders, actions ou
  `<Switch>` (API do v5, já não usada). Essa é exatamente a superfície que o v7 manteve
  compatível para quem não adotou o "data mode" ainda.
- `react-router-dom` continua existindo como pacote em v7 (não foi removido), então os
  imports atuais (`from "react-router-dom"`) não precisam mudar de módulo.
- Arquivos que importam `react-router-dom` (para checar depois do bump, com foco em types
  e comportamento de `Navigate`/`Outlet` em rotas protegidas):
  `apps/web/src/App.tsx`, `apps/web/src/pages/Login.tsx`,
  `apps/web/src/pages/NotFound.tsx`, `apps/web/src/pages/ExecutiveReport.tsx`,
  `apps/web/src/pages/ExecutiveReportPrint.tsx`, `apps/web/src/pages/TrainingTrack.tsx`,
  `apps/web/src/pages/TrainingTrackPrint.tsx`, `apps/web/src/pages/AssessmentForm.tsx`,
  `apps/web/src/auth/ProtectedRoute.tsx`, `apps/web/src/auth/AdminRoute.tsx`,
  `apps/web/src/components/EmptyState.tsx`, e os `.test.tsx` correspondentes.

### 3.3 vite 5 → 6 (risco baixo)

- `apps/web/vite.config.ts` é um `defineConfig` ESM simples (plugin `@vitejs/plugin-react`
  + bloco `test` do vitest inline, via `/// <reference types="vitest/config" />`). Node
  engine do projeto já é `>=20` (`package.json` raiz) e o CI já roda `node-version: "20"`
  em todos os jobs — o requisito mínimo do vite 6 (Node 18+) já está coberto.
- Nenhum uso de API CJS do vite (`require("vite")`) encontrado — o projeto é ESM.

### 3.4 vitest 2 → 4 (risco médio — é o maior salto de versão da lista, 2 majors)

- Nenhum uso de `vi.mock` no projeto (`apps/web/src`, `packages/owasp-content/src`) — a
  mudança de hoisting de mocks entre v2/v3/v4 (um dos breaking changes mais comuns dessa
  faixa) não afeta este código.
- Configuração atual é simples: `test: { environment: "jsdom", globals: true, setupFiles:
  "./src/setupTests.ts" }` dentro do `vite.config.ts` do `apps/web`; `packages/owasp-content`
  não tem `vitest.config.*` próprio (usa o default do CLI `vitest run`).
- Ainda assim, é o bump mais arriscado da lista por ser dois majors de uma vez — a
  verificação de aceite aqui é "toda a suíte de testes do `apps/web` e do
  `packages/owasp-content` continua passando", sem assumir que a ausência de `vi.mock`
  cobre todos os breaking changes possíveis.

## 4. Critério de aceite

1. `npm ci` na raiz do monorepo completa sem erro de `ERESOLVE`.
2. Todos os jobs do CI (`lint`, `typecheck`, `unit`, `e2e`, `npm-audit`, `semgrep`,
   `secrets-scan`, `codeql`, `dast`) passam na branch de trabalho.
3. `npm audit --omit=dev --audit-level=moderate` não reporta nenhuma das 9 entradas
   listadas na seção 1 (todas devem cair fora das faixas vulneráveis com as versões alvo).
4. Verificação manual em browser (login, logout, navegação entre as rotas protegidas e
   públicas, geração/visualização de relatório executivo e trilha de treinamento — as
   páginas que usam `react-router-dom` mais diretamente) sem regressão visível.
5. PR aberto a partir da branch `deps/nestjs11-vite6-vitest4-react-router7` para `main`.
6. PR #13 do dependabot fechado após o merge deste PR manual.
