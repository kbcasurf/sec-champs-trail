# Security hardening (2026-08-19) — Log de Execução

Plano executado: `docs/superpowers/plans/2026-08-19-security-hardening.md`
Spec: `docs/superpowers/specs/2026-08-19-security-hardening-design.md`
Relatório de origem: `docs/security-review-2026-08-19.md`
ADR: `docs/adr/0004-security-hardening.md`
Método: implementação direta na branch `security-hardening-2026-08-19` (a partir de
`main`), tarefa a tarefa conforme o plano, sem worktree isolado. Merge em `main`:
2026-08-20 (PR #12, squash não usado — merge commit `967452f`).

Nota sobre este documento não ser bilíngue com o restante da série: os logs de Fase 0 e
Fase 1a foram escritos em português; este segue a mesma convenção por consistência com
eles, embora a spec, o plano e o relatório de origem desta rodada de hardening estejam em
inglês.

## Execução tarefa a tarefa

**Task 1 — Login com custo constante (fecha o timing side-channel)**
complete (`1fc3c96`, `114d3c1`). `validateCredentials` passou a comparar sempre contra um
hash bcrypt — o de um champion real quando o e-mail existe, um hash dummy pré-computado
quando não existe — em vez de retornar cedo no caminho "conta não existe". Teste trocado
de medição de tempo real (instável em CI) para uma invariante: `bcrypt.compare` é sempre
chamado exatamente uma vez, mesmo com `champion === null`.

**Task 2 — `JWT_SECRET` mínimo de 32 caracteres**
complete (`d0abc5e`). Threshold elevado de 16 para 32 em `env.validation.ts`, testes de
fronteira reescritos com `"a".repeat(N)`, `.env.example` e `README.md` atualizados. Breaking
change deliberado, conforme decidido na spec — qualquer ambiente com um secret mais curto
falha ao subir com mensagem de erro clara.

**Task 3 — Rate limiting via `@nestjs/throttler`**
complete (`a3f0aea`). Guard global (`APP_GUARD`, 100 req/min/IP) mais um override de 10
req/min/IP em `POST /auth/login` via `@Throttle`. Teste e2e novo faz até 20 tentativas em
loop até ver um 429, em vez de assumir um número exato — decisão da spec para não acoplar
o teste à ordem/contagem de outros `it`s no mesmo arquivo.

**Task 4 — Headers de segurança via `helmet`**
complete (`d4ceb3a`). `helmet()` adicionado em `main.ts` logo após `cookieParser()`,
usando os defaults do próprio pacote com apenas `frame-ancestors` restrito para `'none'`
(era `'self'`). Teste e2e novo em `app.e2e-spec.ts` afirma a presença dos headers
(`x-content-type-options`, `x-frame-options`, `strict-transport-security`,
`content-security-policy` contendo `frame-ancestors 'none'`).

**Task 5 — Higiene de dependências (`react-router`, gate do CI)**
complete com correção em relação ao plano original (`b52f352`, `6ffde05`). O bump de
`react-router`/`react-router-dom` para `^6.30.6` foi aplicado conforme planejado, mas ao
rodar `npm audit` após o bump ficou claro que a advisory (GHSA-wrjc-x8rr-h8h6 /
GHSA-337j-9hxr-rhxg) continua ativa — a faixa vulnerável é `6.0.0 - 7.17.0`, e a correção
real exige `react-router@8.3.0`, que por sua vez exige React 19.2.7+ (a app está em React
18.3.0). Diferente do assumido na spec/plano, o bump `^6.30.6` é higiene geral, não
fechamento da advisory. Decisão tomada na hora: reverter o rebaixamento do gate de CI
(`6ffde05` desfaz a mudança de `--audit-level=high` para `--audit-level=moderate` feita no
mesmo commit `b52f352`) — baixar o gate teria deixado o CI permanentemente vermelho sem
fechar o gap de verdade. O upgrade major para `react-router@8` (e o bump de React que ele
exige) passou a ser rastreado como débito técnico na ADR 0004, junto do upgrade do
NestJS 10→11.

**Task 6 — HTTPS local via Caddy**
complete (`2d26dbd`). `Caddyfile` + `docker-compose.https.yml` autocontidos, modelados no
setup do `threat-dragon-ai`; `TRUST_PROXY_HOPS` (opcional, default `0`) lido em `main.ts`
para configurar `trust proxy` com um número exato de hops, nunca `true`.

**Task 7 — ADR 0004**
complete (`890efe5`), corrigida logo em seguida (`4d9461f`) — ver "Revisão pós-implementação"
abaixo.

## Revisão pós-implementação (antes do merge)

Depois das 7 tarefas, uma revisão da própria branch (não pedida pelo plano, mas motivada
pela descoberta da Task 5) encontrou 3 problemas adicionais, todos corrigidos antes do
merge:

- **Cabeçalho da ADR 0004 desalinhado com a Task 5 real** (`4d9461f`): a ADR ainda dizia
  "close all 5 findings" depois de a Task 5 ter sido corrigida para reconhecer que a
  advisory do react-router não fecha de verdade. Cabeçalho da seção "Decision" corrigido
  para "close 4 of 5 findings, mitigate and track the 5th", e o item 5 reescrito para
  descrever com precisão o que o bump `^6.30.6` faz e não faz.

- **Crítico — `TRUST_PROXY_HOPS=1` ativo por padrão em `.env.example`** (`3073cca`): o
  `.env.example` produzido pela Task 6 deixou a linha `TRUST_PROXY_HOPS=1`
  descomentada, logo depois de um comentário explicando que ela deveria ficar sem valor
  para o `docker-compose.yml` padrão. Como `docker-compose.yml` carrega `env_file: .env` e
  o Quickstart do README manda `cp .env.example .env`, seguir a documentação ao pé da
  letra subia a aplicação com `trust proxy=1` sem nenhum proxy real na frente — permitindo
  que qualquer cliente falsificasse `X-Forwarded-For` para reescrever `req.ip`, exatamente
  o campo que `@nestjs/throttler` usa como chave dos buckets de rate limit, contornando
  tanto o limite de login quanto o global. Corrigido comentando a linha (documenta a
  variável sem ativá-la) e adicionado um teste de regressão
  (`trust-proxy-rate-limit.e2e-spec.ts`) confirmando que, com `TRUST_PROXY_HOPS` sem valor
  (o default), um `X-Forwarded-For` falsificado e diferente a cada requisição não escapa
  do rate limiter de login. Esse mesmo commit também corrigiu o placeholder de
  `JWT_SECRET` no `.env.example`, que tinha ficado com 23 caracteres — abaixo do novo
  mínimo de 32 da Task 2 — o que faria `cp .env.example .env` sem edição falhar já no
  boot.

- **Afirmação incorreta sobre HTTPS local no README** (`e5aa3b9`): a seção "Local HTTPS"
  afirmava que o `docker-compose.yml` padrão nunca liga o flag `Secure` do cookie nem o
  HSTS porque `NODE_ENV` ficaria sem valor. Verificado como falso: o `Dockerfile` fixa
  `ENV NODE_ENV=production` incondicionalmente na imagem de runtime, e nenhum dos dois
  compose files sobrescreve isso — confirmado direto contra uma resposta de login real via
  `docker compose up --build`. Texto corrigido para descrever o que o HTTPS local
  realmente contribui (uma conexão TLS real, para que o navegador *honre* headers que já
  estão sendo enviados — em HTTP puro, cookies `Secure` só funcionam de todo modo por uma
  exceção que os navegadores fazem para `localhost`). Aproveitado para documentar
  `TRUST_PROXY_HOPS` para deployments reais atrás de um proxy (contagem exata de hops,
  nunca chutar alto, nunca setar sem um proxy real presente).

- **Nota de trade-off adicionada à ADR** (`4e34659`, não uma correção de erro): registrado
  que o job `dast` do CI (ZAP baseline contra `127.0.0.1:3000`) agora roda contra uma app
  protegida pelo rate limiter global de 100 req/min/IP, o que pode reduzir a cobertura do
  scan silenciosamente (o job só falha em achados high/critical do ZAP, não em taxa
  elevada de 429). Aceito como trade-off conhecido, não corrigido nesta rodada — fica como
  candidato a follow-up (bypass do throttle escopado ao job `dast`, se a cobertura se
  provar insuficiente).

## Verificação final

- CI da PR #12 (run `32301830133`): sucesso, ~2 min — lint, typecheck, testes unitários,
  e2e (incluindo os 3 testes novos: rate limiting em `auth.e2e-spec.ts`, headers em
  `app.e2e-spec.ts`, regressão de trust-proxy em `trust-proxy-rate-limit.e2e-spec.ts`),
  build Docker, e os gates de segurança (Semgrep, CodeQL, TruffleHog, ZAP baseline,
  `npm audit --omit=dev --audit-level=high`).
- `git log --oneline` na branch mostrou 15 commits (7 das tarefas do plano + 1 commit de
  teste separado na Task 1 + 3 de correção pós-implementação + 3 de documentação/infra —
  mais que os "7 commits, um por tarefa" originalmente previstos no plano, por causa das
  correções acima), todos íntegros.
- PR #12 mesclada em `main` (`967452f`), branch remota `security-hardening-2026-08-19`
  removida. `main` local sincronizada, working tree limpa.

## Diferenças em relação ao plano original

| Item do plano | Previsto | Executado |
|---|---|---|
| Task 5 — gate de `npm audit` | Rebaixar `--audit-level=high` → `moderate` | Rebaixado e revertido no mesmo dia — a advisory do react-router não fecha com o bump `^6.30.6`, então baixar o gate deixaria CI vermelho sem motivo real. Gate permanece em `high`. |
| Task 7 — ADR 0004 | "close all 5 findings" | Corrigida para "close 4 of 5 findings, mitigate and track the 5th" — só depois de descoberto que a Task 5 não fecha a advisory de verdade. |
| `.env.example` (Task 6) | `TRUST_PROXY_HOPS=1` documentado como opcional | Descoberto pós-implementação que a primeira versão deixava a linha **ativa**, criando um bypass real de rate limiting em qualquer ambiente que seguisse o Quickstart ao pé da letra. Corrigido, com teste de regressão novo. |
| README "Local HTTPS" (Task 6) | Descrição do que o HTTPS local habilita | Afirmação factual errada sobre `NODE_ENV`/`Secure`/HSTS no compose padrão, corrigida após verificação direta contra o Dockerfile e uma resposta HTTP real. |

## Itens não fechados nesta rodada (rastreados na ADR 0004, não bloqueantes)

| Item | Motivo de não fechar agora | Quando revisitar |
|---|---|---|
| `react-router` 6→8 (advisory GHSA-wrjc-x8rr-h8h6 / GHSA-337j-9hxr-rhxg ainda ativa) | Exige `react-router@8.3.0`, que exige React 19.2.7+ — upgrade major fora do escopo desta rodada de auth/headers | Merece spec/plano próprios, possivelmente junto do upgrade do NestJS |
| NestJS 10 → 11 (CVEs moderadas restantes em `@nestjs/core`, `@nestjs/platform-express`, `express`, `body-parser`, `qs`, `file-type`) | Breaking change amplo, fora do escopo desta rodada | Spec/plano próprios |
| Revogação de sessão/token no logout | Trade-off aceito de JWT stateless | Ao adicionar uma feature de "desativar champion" |
| Política de complexidade de senha para champions criados por admin | Decisão de produto/UX, não vulnerabilidade | Quando houver demanda de produto |
| Cobertura do job `dast` do CI reduzida pelo rate limiter global | Aceito como trade-off; ZAP só falha em high/critical, não em 429 elevado | Se a cobertura do scan se provar insuficiente na prática |

Nenhum destes bloqueia o início da Fase 1b — nenhum interage com a superfície nova que
essa fase adiciona (endpoints de trilha de treinamento e relatório executivo, ambos atrás
dos mesmos guards e agora também do rate limiter e dos headers do `helmet`).
