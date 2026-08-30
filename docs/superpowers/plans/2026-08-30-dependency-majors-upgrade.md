# Atualização de dependências major Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Subir `@nestjs/*` (10→11), `react-router`/`react-router-dom` (6→7),
`vite` (5→6) e `vitest` (2→4) — as 4 atualizações agrupadas pelo PR #13 do
dependabot, que hoje quebra `npm ci` — mantendo todos os gates de CI verdes e sem
regressão visível na aplicação.

**Architecture:** Sem mudança de arquitetura. É puramente um bump de versões de
dependências mais os ajustes mínimos de peer dependency necessários para o `npm ci`
resolver a árvore (companion bumps não previstos pelo dependabot:
`@nestjs/jwt`, `@nestjs/passport`, `@nestjs/cli`, `@nestjs/testing`, e
`@vitejs/plugin-react`). Cada task fecha um pacote (ou grupo de pacotes com a
mesma major, no caso do NestJS) e termina com a suíte de testes daquele
workspace passando antes de seguir para a próxima.

**Tech Stack:** NestJS 11 + Express 5 (`apps/api`), React 18 + react-router 7 +
vite 6 (`apps/web`), vitest 4 (`apps/web` e `packages/owasp-content`), Jest 29
(inalterado, só usado em `apps/api`).

**Spec:** `docs/superpowers/specs/2026-08-30-dependency-majors-upgrade-design.md`

## Global Constraints

- Branch de trabalho: `deps/nestjs11-vite6-vitest4-react-router7` (já criada a partir de
  `main`).
- Não subir nenhum pacote além do necessário para fechar o PR #13 (nada de NestJS 12,
  react-router 8, React 19 — fora de escopo, ver spec seção 2).
- `npm audit --omit=dev --audit-level=moderate` deve ficar limpo das 9 entradas listadas
  na spec ao final da Task 4.
- Todo `npm install`/`npm ci` deve rodar sem `--force`/`--legacy-peer-deps` — se algum
  pacote pedir isso, é sinal de que falta subir mais um companion package (mesma causa raiz
  do PR #13 quebrado).
- Fazer um commit por task, na ordem das tasks (facilita bisect se algo quebrar mais
  adiante).

---

### Task 1: NestJS 10 → 11 em `apps/api`

**Files:**
- Modify: `apps/api/package.json:26-31` (dependencies) e `apps/api/package.json:46-47`
  (devDependencies)
- Test: `apps/api/src/**/*.spec.ts` (Jest, já existentes — não criar novos testes, só
  confirmar que os existentes continuam passando)
- Test: `apps/api/test/jest-e2e.json` suite (Supertest, já existente)

**Interfaces:**
- Não introduz nem consome nenhuma interface nova — é um bump de versão. O contrato
  público do módulo `apps/api` (rotas HTTP, DTOs) não muda.

- [ ] **Step 1: Atualizar as versões no `package.json`**

Em `apps/api/package.json`, dentro de `dependencies`:

```json
    "@nestjs/common": "^11.2.3",
    "@nestjs/core": "^11.2.3",
    "@nestjs/jwt": "^11.0.2",
    "@nestjs/passport": "^11.0.5",
    "@nestjs/platform-express": "^11.2.3",
    "@nestjs/throttler": "^6.5.0",
```

(`@nestjs/throttler` fica como está — seu peer dependency já aceita `@nestjs/core@^11`.)

E dentro de `devDependencies`:

```json
    "@nestjs/cli": "^11.0.24",
    "@nestjs/testing": "^11.2.3",
```

- [ ] **Step 2: Reinstalar e confirmar que a árvore resolve sem `ERESOLVE`**

Run: `npm ci`
Expected: instala sem nenhum `npm error ERESOLVE`. Se aparecer, o erro vai apontar qual
pacote ainda está pedindo uma versão antiga de `@nestjs/common` — comparar contra a
tabela de peer dependencies da spec (seção "Escopo", itens 1-4) antes de tentar
`--legacy-peer-deps`.

- [ ] **Step 3: Rodar build, typecheck e lint de `apps/api`**

Run: `npm run build -w apps/api && npm run typecheck -w apps/api && npm run lint -w apps/api`
Expected: os três comandos terminam com exit code 0. Erros de typecheck aqui normalmente
vêm de mudança de tipos do Express 5 (ex.: assinatura de `Request`/`Response` do
`@types/express`, já fixado em `^5.0.0` no `package.json` — não deveria precisar mudar).

- [ ] **Step 4: Rodar a suíte unit (Jest)**

Run: `npm run test -w apps/api`
Expected: todos os specs em `apps/api/src/**/*.spec.ts` passam. Prestar atenção especial
em qualquer spec de `auth` (é o único módulo que usa `@Res()` diretamente).

- [ ] **Step 5: Rodar a suíte e2e**

Run: `npm run db:generate -w apps/api && npm run test:e2e -w apps/api`
(Precisa do Postgres do `docker-compose.yml` de dev rodando — subir com
`docker compose up -d db` se ainda não estiver de pé.)
Expected: todos os testes e2e passam, incluindo os fluxos de `POST /api/auth/login` e
`POST /api/auth/logout`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json package-lock.json
git commit -m "chore(api): bump NestJS 10 -> 11 (and jwt/passport/cli/testing peers)"
```

---

### Task 2: react-router 6 → 7 em `apps/web`

**Files:**
- Modify: `apps/web/package.json:17-18` (dependencies)
- Test: os `.test.tsx` que importam `react-router-dom` — ver lista completa na spec,
  seção 3.2 (`App.test.tsx`, `Login.test.tsx` [se existir], `NotFound.test.tsx`,
  `ExecutiveReport.test.tsx`, `TrainingTrack.test.tsx`, `AssessmentForm.test.tsx`,
  `ProtectedRoute.test.tsx`, `AdminRoute.test.tsx`, `EmptyState.test.tsx`)

**Interfaces:**
- Não introduz interface nova. Os componentes/hooks consumidos de
  `react-router-dom` (`BrowserRouter`, `Routes`, `Route`, `Link`, `Navigate`,
  `Outlet`, `MemoryRouter`, `useNavigate`, `useParams`, `useLocation`) mantêm a
  mesma assinatura no v7 — essa task não deveria precisar tocar em nenhum
  arquivo `.tsx` fora do `package.json`, só confirmar isso rodando a suíte.

- [ ] **Step 1: Atualizar as versões no `package.json`**

Em `apps/web/package.json`, dentro de `dependencies`:

```json
    "react-router": "^7.18.2",
    "react-router-dom": "^7.18.2",
```

- [ ] **Step 2: Reinstalar**

Run: `npm ci`
Expected: sem `ERESOLVE`. `react-router-dom@7` depende de `react-router@7` da mesma
versão — como os dois estão sendo bumpados juntos aqui, não deveria conflitar.

- [ ] **Step 3: Typecheck e lint de `apps/web`**

Run: `npm run typecheck -w apps/web && npm run lint -w apps/web`
Expected: exit code 0. Se o typecheck falhar em algum arquivo da lista de "Files" acima,
o erro mais provável é de tipos genéricos em `Navigate`/`Outlet` — comparar a mensagem
com o changelog do `react-router` v7 antes de alterar código (não deveria ser necessário
dado o uso só declarativo confirmado na spec).

- [ ] **Step 4: Rodar a suíte de testes**

Run: `npm run test -w apps/web`
Expected: todos os testes em `apps/web/src/**/*.test.tsx` passam, sem warnings novos de
depreciação do router no console dos testes.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): bump react-router 6 -> 7"
```

---

### Task 3: vite 5 → 6 + `@vitejs/plugin-react` 4 → 5 em `apps/web`

**Files:**
- Modify: `apps/web/package.json:28,35` (devDependencies)
- Modify (se necessário): `apps/web/vite.config.ts` — não deveria precisar mudar, é
  `defineConfig` puro sem opções descontinuadas no v6, mas confirmar no Step 3.

**Interfaces:**
- Nenhuma nova. `vite.config.ts` continua exportando o mesmo shape de config
  (`plugins`, `test`).

- [ ] **Step 1: Atualizar as versões no `package.json`**

Em `apps/web/package.json`, dentro de `devDependencies`:

```json
    "@vitejs/plugin-react": "^5.2.0",
    ...
    "vite": "^6.4.3",
```

(Bumpar os dois juntos nesta task — `@vitejs/plugin-react@^4.3.0` não aceita
`vite@^6`, então instalar só o `vite` sozinho reproduz o mesmo tipo de `ERESOLVE`
que quebrou o PR #13 do dependabot.)

- [ ] **Step 2: Reinstalar**

Run: `npm ci`
Expected: sem `ERESOLVE`.

- [ ] **Step 3: Rodar o dev server e o build de produção**

Run: `npm run dev -w apps/web` (deixar rodando, checar que sobe sem erro no terminal e
sem tela de erro do Vite no browser — a verificação visual completa acontece na Task 5)
depois `Ctrl+C` e:
Run: `npm run build -w apps/web`
Expected: build gera `apps/web/dist` sem warning novo de config depreciada do vite 6.

- [ ] **Step 4: Rodar a suíte de testes (o bloco `test` do vitest ainda vive dentro do**
  **`vite.config.ts`, então isso também exercita a integração vite+vitest)**

Run: `npm run test -w apps/web`
Expected: passa — mas note que `vitest` ainda está na `^2.1.0` neste ponto do plano; a
Task 4 é quem sobe o vitest. Esse passo aqui só confirma que o vite 6 sozinho não quebrou
nada antes de empilhar o bump do vitest.

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json package-lock.json
git commit -m "chore(web): bump vite 5 -> 6 and @vitejs/plugin-react 4 -> 5"
```

---

### Task 4: vitest 2 → 4 em `apps/web` e `packages/owasp-content`

**Files:**
- Modify: `apps/web/package.json:36` (devDependencies)
- Modify: `packages/owasp-content/package.json:16` (devDependencies)
- Test: toda a suíte `*.test.tsx` de `apps/web/src` e `*.spec.ts` de
  `packages/owasp-content/src`

**Interfaces:**
- Nenhuma nova. Nenhum dos dois workspaces usa `vi.mock` (confirmado na spec,
  seção 3.4), então não há hoisting de mock para reescrever.

- [ ] **Step 1: Atualizar as versões**

Em `apps/web/package.json`, dentro de `devDependencies`:

```json
    "vitest": "^4.1.11",
```

Em `packages/owasp-content/package.json`, dentro de `devDependencies`:

```json
    "vitest": "^4.1.11",
```

- [ ] **Step 2: Reinstalar**

Run: `npm ci`
Expected: sem `ERESOLVE` — `vitest@4.1.11` aceita `vite@^6.0.0 || ^7.0.0 || ^8.0.0` como
peer, já satisfeito pela Task 3.

- [ ] **Step 3: Rodar a suíte de `packages/owasp-content` primeiro (mais simples, sem**
  **jsdom nem plugin do vite)**

Run: `npm run build -w packages/owasp-content && npm run typecheck -w packages/owasp-content && npm run test -w packages/owasp-content`
Expected: exit code 0 nos três.

- [ ] **Step 4: Rodar a suíte de `apps/web`**

Run: `npm run test -w apps/web`
Expected: todos os testes passam. Se algo quebrar, o mais provável nessa faixa de versão
(vitest 2→4) é `environment: "jsdom"` do bloco `test` não sendo mais aceito no formato
atual, ou alguma opção de `setupFiles`/`globals` renomeada — checar o changelog oficial
do vitest para a versão específica que aparecer no erro antes de mudar `vite.config.ts`.

- [ ] **Step 5: Rodar o `npm audit` de todo o monorepo e confirmar que fecha as 9 CVEs**
  **da spec**

Run: `npm audit --omit=dev --audit-level=moderate`
Expected: nenhuma das entradas abaixo aparece mais no relatório —
`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `body-parser`,
`express`, `file-type`, `qs`, `react-router`, `react-router-dom`. Se alguma
persistir, anotar a versão exigida pelo audit e comparar com a versão instalada
via `npm ls <pacote>` antes de decidir o próximo passo (não é esperado, dado o
levantamento da spec, mas é o critério de aceite objetivo).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json packages/owasp-content/package.json package-lock.json
git commit -m "chore: bump vitest 2 -> 4 in web and owasp-content"
```

---

### Task 5: Suíte completa local + verificação em browser

**Files:** nenhum arquivo de código — só execução e checagem manual.

**Interfaces:** N/A.

- [ ] **Step 1: Rodar a suíte completa do monorepo de ponta a ponta, replicando os**
  **jobs do CI (`.github/workflows/ci.yml`) localmente**

Run:
```bash
npm ci
npm run build -w packages/owasp-content
npm run db:generate -w apps/api
npm run lint -w apps/api && npm run lint -w apps/web
npm run typecheck -w apps/api && npm run typecheck -w apps/web && npm run typecheck -w packages/owasp-content
npm run test -w apps/api && npm run test -w apps/web && npm run test -w packages/owasp-content
npm run db:migrate:deploy -w apps/api && npm run db:seed -w apps/api && npm run test:e2e -w apps/api
npm audit --omit=dev --audit-level=high
```
Expected: todos os comandos terminam com exit code 0.

- [ ] **Step 2: Subir a aplicação completa localmente**

Run: `docker compose up -d --build` (ou, se preferir sem Docker,
`npm run start:dev -w apps/api` num terminal e `npm run dev -w apps/web` em outro)
Expected: API respondendo em `http://localhost:3000/api` (ou porta configurada) e web em
`http://localhost:5173` (porta default do Vite).

- [ ] **Step 3: Verificação manual em browser — roteiro mínimo (cobre os pontos de**
  **maior risco da spec: `@Res()` no auth e o uso de `react-router-dom`)**

1. Abrir a home / tela de login.
2. Fazer login com um usuário existente → confirmar que o cookie de sessão é
   setado (`COOKIE_NAME`) e que a navegação pós-login (`Navigate`) leva para a
   página correta conforme o `role` do usuário.
3. Navegar por pelo menos uma rota protegida comum (`ProtectedRoute`) e, se o
   usuário de teste for admin, uma rota `AdminRoute`.
4. Abrir uma trilha de treinamento (`TrainingTrack`) e o relatório executivo
   (`ExecutiveReport`), incluindo a versão de impressão
   (`TrainingTrackPrint`/`ExecutiveReportPrint`) — são as páginas com mais lógica
   de rota e de fetch de dados do frontend.
5. Acessar uma URL inexistente e confirmar que a página `NotFound` aparece.
6. Fazer logout e confirmar que o cookie é limpo e a navegação volta para a
   tela de login (nenhuma rota protegida deve continuar acessível).

Expected: nenhum erro no console do browser, nenhuma tela em branco, nenhuma
navegação quebrada — comportamento idêntico ao que a aplicação tinha em `main`
antes desta branch.

- [ ] **Step 4: Registrar o resultado da verificação manual**

Sem commit de código nesta task — o resultado (passou/não passou, com qualquer
observação) vai direto para a descrição do PR na Task 6.

---

### Task 6: Abrir o PR e fechar o PR #13 do dependabot

**Files:** nenhum.

**Interfaces:** N/A.

- [ ] **Step 1: Push da branch**

```bash
git push -u origin deps/nestjs11-vite6-vitest4-react-router7
```

- [ ] **Step 2: Abrir o PR**

```bash
gh pr create --repo kbcasurf/sec-champs-trail \
  --title "chore(deps): bump NestJS 11, react-router 7, vite 6, vitest 4" \
  --body "$(cat <<'EOF'
## Summary
- Substitui o PR #13 do dependabot, que quebrava `npm ci` por bumpar só
  `@nestjs/core` sem os pacotes `@nestjs/*` que dependem dele como peer.
- Sobe `@nestjs/{core,common,platform-express,testing}` para 11.2.3,
  `@nestjs/{jwt,passport}` para as versões compatíveis com Nest 11, e
  `@nestjs/cli` para 11.0.24.
- Sobe `react-router`/`react-router-dom` para 7.18.2 (fecha o advisory
  GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg sem precisar do salto para v8 +
  React 19).
- Sobe `vite` para 6.4.3 e `@vitejs/plugin-react` para 5.2.0 (peer dependency
  do plugin não aceitava vite 6 na versão anterior).
- Sobe `vitest` para 4.1.11 em `apps/web` e `packages/owasp-content`.

Ver `docs/superpowers/specs/2026-08-30-dependency-majors-upgrade-design.md`
para o levantamento completo de risco por biblioteca.

## Test plan
- [ ] `npm ci` sem `ERESOLVE`
- [ ] CI verde (lint, typecheck, unit, e2e, npm-audit, semgrep, secrets-scan, codeql, dast)
- [ ] `npm audit --omit=dev --audit-level=moderate` limpo
- [ ] Verificação manual em browser (login/logout, rotas protegidas/admin,
      trilha de treinamento, relatório executivo, 404) sem regressão
EOF
)"
```

- [ ] **Step 3: Aguardar o CI do PR e confirmar todos os jobs verdes**

Run: `gh pr checks --repo kbcasurf/sec-champs-trail <numero-do-pr> --watch`
Expected: todos os checks passam. Se algum falhar, voltar para a task
correspondente (1-4) em vez de tentar corrigir só no CI.

- [ ] **Step 4: Fechar o PR #13 do dependabot, referenciando o novo PR**

```bash
gh pr close 13 --repo kbcasurf/sec-champs-trail \
  --comment "Fechando em favor do #<numero-do-novo-pr>, que faz o mesmo conjunto de bumps mas inclui os pacotes @nestjs/* companheiros e o @vitejs/plugin-react que este PR não cobria (por isso o npm ci quebrava aqui)."
```
