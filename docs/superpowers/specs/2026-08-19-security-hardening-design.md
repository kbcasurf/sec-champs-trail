# Correções da revisão de segurança de 2026-08-19

Status: Spec aprovada, aguardando plano de implementação
Data: 2026-08-19
Relatório de origem: `docs/security-review-2026-08-19.md` (revisão manual completa da
aplicação — não um diff pendente — cruzada com os gates já existentes de CI: Semgrep,
CodeQL, TruffleHog, ZAP baseline e `npm audit --audit-level=high`)
Branch de trabalho: `security/harden-auth-and-headers` (a partir de `main`)

## 1. Contexto

A revisão encontrou 5 findings confirmados por leitura de código (1 alta, 3 médias, 1
baixa) mais 2 notas informativas. Nenhum é "a aplicação está trivialmente comprometida",
mas para uma ferramenta cujo propósito é ensinar boas práticas de segurança, são do tipo
que um revisor externo — ou um auditor do próprio programa de Security Champions — notaria
de cara. Os 5 findings acionáveis:

1. **Alta** — sem rate limiting em `POST /auth/login` (brute force / credential stuffing
   sem barreira alguma).
2. **Média** — sem headers HTTP de segurança (nenhum `helmet`, sem CSP/HSTS/
   X-Content-Type-Options/frame-ancestors).
3. **Média** — timing side-channel no login (`auth.service.ts`) permite enumerar contas
   por latência de resposta, mesmo com mensagem de erro genérica.
4. **Média** — 9 CVEs moderadas em dependências de produção não pegas pelo gate de CI
   (`--audit-level=high`), incluindo um open-redirect→XSS no `react-router-dom`.
5. **Baixa** — `JWT_SECRET` aceita mínimo de 16 caracteres, fraco para uma chave HMAC-SHA256.

Adicionalmente, o usuário pediu para avaliar se o setup de HTTPS local via Caddy do
projeto `~/Documentos/repos/threat-dragon-ai` (não o `sammwise-ai`, mencionado por engano
inicialmente) serve de modelo para este projeto. Essa investigação está registrada na
seção 3.6 abaixo — a conclusão foi que sim, vale a pena, principalmente porque a correção
do finding 2 (headers) inclui HSTS e o flag `Secure` do cookie, e nenhum dos dois pode ser
verificado de verdade em `docker-compose.yml` hoje, que só serve a aplicação em HTTP puro
(`NODE_ENV` fica sem valor em dev, então `Secure` nunca liga — ver comentário em
`.env.example:8-10`).

## 2. Escopo

**Dentro do escopo** (todos os 5 findings acionáveis, mais a infraestrutura de HTTPS
local que permite testá-los de verdade):

1. Comparação bcrypt de custo constante no login, fechando o timing side-channel
   (finding 3).
2. Limite de mínimo do `JWT_SECRET` elevado de 16 para 32 caracteres (finding 5).
3. Rate limiting via `@nestjs/throttler`, global + override mais restrito em
   `POST /auth/login` (finding 1).
4. Headers de segurança via `helmet`, partindo dos defaults do próprio pacote e
   restringindo apenas `frame-ancestors` (finding 2).
5. `react-router`/`react-router-dom` atualizados para `^6.30.6` (resolve o
   open-redirect→XSS); gate de `npm audit` do CI rebaixado de `--audit-level=high` para
   `--audit-level=moderate` no job que já roda só contra produção (fecha a lacuna do
   finding 4); upgrade major do NestJS 10→11 (que resolveria o resto das CVEs moderadas)
   registrado como débito técnico rastreado, não implementado aqui.
6. HTTPS local opcional via Caddy (`docker-compose.https.yml` + `Caddyfile`), modelado no
   setup do `threat-dragon-ai`, para permitir verificar visualmente e via teste que o
   flag `Secure` do cookie e o header HSTS realmente entram em vigor.
7. Registro de tudo isso como ADR 0004, seguindo a convenção já usada em 0001-0003.

**Fora do escopo** (explícito):

- Upgrade major do NestJS 10 → 11. É a única correção completa para as CVEs moderadas em
  `@nestjs/core`, `@nestjs/platform-express`, `express`, `body-parser`, `qs` e
  `file-type`, mas é um breaking change amplo demais para empacotar junto de correções de
  auth/headers — vira um item de backlog rastreado na ADR 0004.
- Revogação de token/sessão no logout (nota informativa 6 do relatório) — mudança
  arquitetural maior (short-lived token + refresh, ou blacklist), fora do escopo de
  "fechar findings confirmados".
- Política de complexidade de senha para champions criados por admin (nota informativa
  7) — melhoria de UX/produto, não uma vulnerabilidade.
- Qualquer mudança de UI/fluxo em `apps/web` além do necessário para os headers de
  segurança não quebrarem nada (nenhuma mudança de design é necessária — ver decisão de
  CSP na seção 3.4).
- TLS real (Let's Encrypt/cert público) em produção — fora do controle deste repositório;
  a instância publicada já roda atrás de HTTPS gerenciado pelo operador. O Caddy local é
  só para desenvolvimento/QA, documentado como tal.
- Editar os planos históricos já executados (`docs/superpowers/plans/2026-08-10-*` e
  `2026-08-13-*`) que também mencionam "16 characters" — são registros imutáveis do que
  foi decidido/feito naquela data, não a fonte de verdade atual (que é o código).

## 3. Decisões desta spec

| Tema | Decisão | Consequência |
|---|---|---|
| Timing side-channel | Comparar sempre contra um hash bcrypt (de uma senha aleatória não usada, pré-computado uma vez no carregamento do módulo), mesmo quando o email não existe, em vez de retornar cedo | Elimina a diferença de latência mensurável entre "conta não existe" e "senha errada" sem mudar a resposta HTTP (que já era genérica). Testado por invariante (bcrypt.compare é sempre chamado), não por medição real de tempo — medir tempo em teste automatizado é inerentemente instável em CI. |
| `JWT_SECRET` mínimo | 32 caracteres (era 16) | Breaking change deliberado: qualquer instância já rodando com um secret de 16-31 caracteres vai falhar ao subir depois desse deploy, com uma mensagem de erro clara (`validateEnv` já lança antes do `app.listen`). Isso é o comportamento desejado — forçar a rotação de um secret fraco é melhor que deixá-lo passar silenciosamente. Documentado no `.env.example`, no `README.md` e na ADR 0004. |
| Rate limiting: biblioteca | `@nestjs/throttler@^6.5.0` (compatível com o NestJS 10.4.x já usado — ver `peerDependencies`), guard global (`APP_GUARD`) + `@Throttle(...)` mais restrito só em `POST /auth/login` | Alternativa descartada: um rate limiter genérico (`express-rate-limit`) por fora do DI do Nest — rejeitada porque `@nestjs/throttler` já se integra com guards/decorators existentes (`RolesGuard`, `TeamScopeGuard`) sem middleware paralelo, e é o pacote oficial do próprio framework. |
| Rate limiting: limites | Global: 100 req/min por IP (rede de segurança genérica, não deve interferir em uso normal nem nos testes e2e existentes — o maior arquivo de teste, `auth.e2e-spec.ts`, faz ~5 requisições no total). Login: 10 tentativas/min por IP | 10/min é generoso o suficiente para um usuário real errar a senha algumas vezes sem se autobloquear, e restritivo o suficiente para tornar brute force impraticável (bcrypt já adiciona ~60-100ms por tentativa; 10/min via rede é a barreira real). |
| Teste de rate limiting | Em vez de assumir um número exato de tentativas até o 429 (frágil — depende de quantos logins os testes *anteriores* no mesmo arquivo já consumiram do mesmo bucket, já que `auth.e2e-spec.ts` reusa uma única instância de app/throttler-storage entre todos os `it`s), o teste novo faz até 20 tentativas em loop e para na primeira `429`, então afirma que ela ocorreu | Evita acoplar a correção deste teste ao número exato de chamadas de login em testes não relacionados mais acima no mesmo arquivo — um teste futuro adicionado entre os já existentes e este não quebra por coincidência aritmética. |
| Headers de segurança: biblioteca e config | `helmet@^8.3.0`, chamado com `contentSecurityPolicy.directives` = os defaults do próprio pacote (`helmet.contentSecurityPolicy.getDefaultDirectives()`) sobrescrevendo só `frame-ancestors` para `'none'` (default do helmet é `'self'`) | Os defaults do helmet 8 já cobrem exatamente o que a aplicação precisa sem nenhum ajuste: `style-src 'self' https: 'unsafe-inline'` (cobre o CSS externo do Google Fonts e os 5 usos de `style={{width: ...}}` em `ChecklistLibrary.tsx`/`AssessmentForm.tsx`/`Dashboard.tsx`/`Login.tsx` — barras de progresso com largura calculada em runtime, que só podem ser expressas como `style` inline), `font-src 'self' https: data:` (cobre `fonts.gstatic.com`), `script-src 'self'` (build do Vite não usa scripts inline nem CDN), e `connect-src` implícito via `default-src 'self'` (todo fetch já é same-origin, `VITE_API_URL=/api`). Verificado lendo `apps/web/index.html`, o `dist/index.html` gerado pelo build, e todo uso de `style={{` no código-fonte antes de decidir isso — não assumido. |
| `style-src 'unsafe-inline'` é uma concessão, não ignorada | Documentado explicitamente na ADR 0004 como trade-off aceito (CSS-only injection via `style` tem uma superfície de ataque muito mais estreita que script injection, e os 5 usos são todos valores numéricos calculados, não texto de usuário) em vez de deixar como um detalhe implícito do default do helmet | Se no futuro os 5 usos forem migrados para CSS custom properties setadas via `style.setProperty` teria o mesmo problema (CSP `style-src` também rege isso) — a única forma de remover essa exceção de verdade seria nonce por request, o que exigiria deixar de servir `index.html` como asset estático puro. Registrado como possível trabalho futuro, não bloqueante. |
| Dependência: `react-router`/`react-router-dom` | Bump explícito para `^6.30.6` em `apps/web/package.json` (não só deixar o lockfile resolver implicitamente) | Confirmado via `npm audit fix --dry-run` que `6.30.6` (ainda dentro do range `^6.26.0` já declarado) resolve as 3 advisories moderadas sem exigir o major bump para `7.x`. Tornar o floor explícito no `package.json` documenta a intenção em vez de depender de uma resolução implícita do lockfile que uma limpeza futura de `node_modules` poderia reverter. |
| Gate de `npm audit` no CI | `--audit-level=high` → `--audit-level=moderate`, só no job `npm-audit` (que já roda `--omit=dev`, então as CVEs high/critical de devDependencies — `@nestjs/cli`, `vite`, `vitest`, `glob`, `picomatch`, `tmp` — continuam fora do escopo desse job, como já é hoje) | Fecha a lacuna real do finding 4 (CVEs moderadas em deps de produção passando batido) sem mexer nos outros gates (Semgrep/CodeQL/ZAP continuam em high, como já documentado nos scripts de severidade). |
| Upgrade do NestJS 10→11 | Não implementado nesta spec — só registrado como item rastreado na ADR 0004, com link para as advisories específicas que ele resolve | Major bump que toca `@nestjs/core`, `@nestjs/platform-express` e transitivamente `express`/`body-parser`/`qs`/`file-type` é trabalho substancial (breaking changes documentados no changelog do Nest 11) que merece sua própria spec/plano, não uma tarefa dentro de um pacote de hardening que já mexe em auth e bootstrap. |
| HTTPS local: fonte do modelo | `~/Documentos/repos/threat-dragon-ai/Caddyfile` + o serviço `caddy` do `docker-compose.yml` daquele projeto — inspecionados diretamente (não de memória) antes de decidir | Padrão mínimo: `Caddyfile` de 3 linhas (`localhost { reverse_proxy app:3000 }`), Caddy 2 servindo 80/443 na frente do app, com autoridade de certificado interna própria (`caddy_data`/`caddy_config` como volumes). Simples o suficiente para replicar sem trazer nada além do necessário. |
| HTTPS local: como integrar | Arquivo novo e autocontido `docker-compose.https.yml` na raiz (não um override merge do `docker-compose.yml` existente) — duplica os serviços `postgres`/`app` e adiciona `caddy` | Compose merge de listas (como `ports`) não tem uma forma limpa de *remover* a publicação direta da porta 3000 do serviço `app` a partir de um arquivo de override sem usar tags `!reset` (suporte recente e não vale a complexidade aqui). Um arquivo autocontido, no mesmo estilo do `docker-compose.yml` já existente, é mais simples de ler, rodar (`docker compose -f docker-compose.https.yml up --build`) e manter do que uma composição de dois arquivos. |
| HTTPS local: `trust proxy` | Nova env var opcional `TRUST_PROXY_HOPS` (default `0`/desligado), usada só quando > 0 para chamar `app.set("trust proxy", N)` com um número exato de hops — nunca `true` | O próprio README do `threat-dragon-ai` documenta um bug real de segurança da própria dependência-modelo: `app.set('trust proxy', true)` confia na cadeia inteira de `X-Forwarded-For`, permitindo que um cliente malicioso falsifique seu IP e escape do rate limiting por IP (`ERR_ERL_PERMISSIVE_TRUST_PROXY` do próprio `express-rate-limit`). Este projeto evita esse erro por construção: sem Caddy na frente, `TRUST_PROXY_HOPS` fica em 0 e o Express usa o IP real do socket (comportamento correto hoje); com Caddy (`docker-compose.https.yml`), a env var sobe para `1` — exatamente um hop confiável, não a cadeia inteira. |
| HTTPS local: certificado não confiável no navegador | Documentado no README como esperado, com o comando para extrair a CA raiz interna do Caddy (`docker compose -f docker-compose.https.yml exec caddy cat /data/caddy/pki/authorities/local/root.crt`) para quem quiser importá-la e eliminar o aviso do navegador | Rodando em Docker, o Caddy não consegue instalar sua CA interna na trust store do host (isso só acontece quando o Caddy roda nativamente) — o mesmo comportamento que o `threat-dragon-ai` tem, não uma lacuna nova introduzida aqui. Clicar para prosseguir no aviso do navegador é aceitável para uso local/QA. |

## 4. Achados detalhados

Ver `docs/security-review-2026-08-19.md` — cada finding lá (com trecho de código,
localização exata `arquivo:linha` e verificação) mapeia 1:1 para uma tarefa do plano:

- Finding 1 (rate limiting) → Tarefa 3 do plano.
- Finding 2 (headers) → Tarefa 4 do plano.
- Finding 3 (timing) → Tarefa 1 do plano.
- Finding 4 (dependências) → Tarefa 5 do plano.
- Finding 5 (`JWT_SECRET`) → Tarefa 2 do plano.
- HTTPS local (não é um finding, é infraestrutura de verificação) → Tarefa 6 do plano.

## 5. Testes

- `auth.service.spec.ts`: novo teste garantindo que `bcrypt.compare` é sempre chamado,
  mesmo quando o champion não existe (finding 3).
- `env.validation.spec.ts`: teste de fronteira reescrito para 32 caracteres, usando
  `"a".repeat(N)` em vez de strings escritas à mão (evita erro de contagem manual).
- `auth.e2e-spec.ts`: novo teste de rate limiting (ver decisão acima sobre por que é um
  loop com corte na primeira `429`, não uma contagem fixa).
- `app.e2e-spec.ts`: novo teste afirmando a presença dos headers de `helmet`
  (`x-content-type-options`, `x-frame-options`, `strict-transport-security`,
  `content-security-policy` contendo `frame-ancestors 'none'`).
- `apps/web`: nenhum teste novo — o bump de `react-router-dom` não muda comportamento
  (é a mesma major version), a suíte existente já cobre roteamento/proteção de rotas e
  deve continuar passando sem alteração.
- Manual: `docker compose -f docker-compose.https.yml up --build`, abrir
  `https://localhost`, confirmar no DevTools que o cookie `accessToken` tem o flag
  `Secure` marcado e que a resposta inclui `Strict-Transport-Security`.

## 6. Critérios de aceite

- `npm run typecheck`, `npm run lint` e `npm run test` (todos os workspaces) limpos.
- `npm run test:e2e -w apps/api` limpo, incluindo os 2 testes novos.
- `npm audit --omit=dev --audit-level=high` continua limpo (nenhuma regressão); rodar
  também `npm audit --omit=dev --audit-level=moderate` manualmente e confirmar que caiu
  de 9 para 6 advisories (as 6 restantes ficam rastreadas para o upgrade do NestJS 11 na
  ADR 0004).
- `docker compose up --build` (fluxo HTTP normal, inalterado) continua subindo e
  respondendo em `http://localhost:3000`.
- `docker compose -f docker-compose.https.yml up --build` sobe, `https://localhost`
  responde (com aviso de certificado esperado), cookie de login sai com `Secure`, header
  `Strict-Transport-Security` presente.
- Tentar subir a aplicação com um `JWT_SECRET` de 20 caracteres falha rápido com uma
  mensagem de erro clara, antes de `app.listen`.
- 11ª tentativa consecutiva de login com senha errada para a mesma conta recebe `429`.
- ADR 0004 criada, documentando todas as decisões acima e linkando de volta para
  `docs/security-review-2026-08-19.md`.
