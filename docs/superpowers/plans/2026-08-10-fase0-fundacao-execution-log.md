# Fase 0 (Fundação) — Log de Execução

Plano executado: `docs/superpowers/plans/2026-08-10-fase0-fundacao.md`
Método: `superpowers:subagent-driven-development` — um subagente implementador por
tarefa, revisão de tarefa (spec + qualidade) após cada uma, revisão final de branch
inteira ao término, tudo em um worktree isolado (`worktree-fase0-fundacao`).
Merge em `main`: 2026-08-12 (fast-forward, 17 commits, `41927fb`).

> Este documento reconstrói o ledger de execução que foi mantido durante o trabalho em
> `<worktree>/.superpowers/sdd/2026-08-10-fase0-fundacao/progress.md` — um arquivo
> propositalmente não versionado (workspace de trabalho da skill de execução), removido
> junto com o worktree ao final. Esta versão é a cópia permanente e commitada desse
> histórico.

## Varredura de pré-voo (antes da Tarefa 1)

Dois pontos do plano original entravam em conflito com a regra "cada tarefa termina com
testes verdes":

1. A Tarefa 2 original terminava com testes vermelhos (conteúdo real só chegaria nas
   Tarefas 3/4).
2. A Tarefa 6 original tinha um stub vazio de `env.validation.ts`, substituído só na
   Tarefa 7.

Decisão (aprovada pelo usuário antes de despachar a Tarefa 1): reescrever o plano para
que a Tarefa 2 embarque com dados fixture (2 princípios + 1 checklist item) e termine
verde, com as Tarefas 3/4 substituindo os fixtures por conteúdo real e adicionando suas
próprias asserções; e fundir a antiga Tarefa 7 (validação de env) dentro da Tarefa 6, com
implementação real desde o início. Isso removeu uma tarefa do plano (14 → 13) e está
documentado em `docs/superpowers/plans/2026-08-10-fase0-fundacao.md` (seção
"Self-Review Notes").

## Execução tarefa a tarefa

**Task 1 — Root monorepo scaffolding**
minor (deferred): `package-lock.json` ficou não rastreado após `npm install` — o passo de
commit do brief exclui deliberadamente esse arquivo; revisitar se uma tarefa futura
precisar do lockfile commitado.
complete (commits `7c12522..f07c763`, review clean).

**Task 2 — `packages/owasp-content`: types, loader, schema test harness (fixture data)**
complete (commits `f07c763..56aed5c`, review clean).

**Task 3 — Curadoria dos 10 princípios do Manifesto OWASP**
complete (commits `56aed5c..3c21f41`, review clean — precisão de conteúdo verificada de
forma independente ao vivo contra o site real da OWASP para 3 dos 10 princípios,
incluindo reprodução fiel de um typo de origem).
complete (commits `56aed5c..3c21f41`).

**Task 4 — Curadoria dos checklists OWASP (recruitment + development-retention)**
minor (deferred): 2 mapeamentos de `principleId` (`share-security-landscape-and-industry-trends`
→ `create-a-community`; `provide-ongoing-tooling-and-mentor-support` → `invest-in-your-champions`)
são defensáveis mas um encaixe um pouco frouxo segundo o revisor; não bloqueante.
complete (commits `3c21f41..58399fa`, review clean — fonte verificada ao vivo: PDF real de
artefato OWASP + arquivos de princípios checados de forma independente).

**Task 5 — `ATTRIBUTION.md`**
complete (commits `58399fa..9624feb`, review clean).

**Task 6 — Scaffold NestJS com health endpoint e validação de ambiente fail-fast**
minor (deferred): o script `"jest"` do brief não tinha config de transform em lugar
nenhum; o implementador adicionou um bloco `"jest"` padrão ts-jest ao
`apps/api/package.json` (revelado, revisor confirmou necessário/mínimo). Gap do próprio
plano — vale nota para planos futuros que usem esse mesmo padrão NestJS+Jest.
complete (commits `9624feb..7643086`, review clean).

**Task 7 — Prisma schema (modelo de dados completo) e migração inicial**
minor (deferred): `PrincipleScore.principleId` só está coberto como 2ª coluna do índice
único composto (`assessmentId`, `principleId`) — uma busca só por `principleId` não usa
esse índice (leftmost-prefix). Mesma causa raiz do achado Important abaixo, não
bloqueante.
fix round 1/5 (1 endereçado, 0 aberto — índices FK ausentes; commits `f98b439..68e1a75`).
complete (commits `7643086..68e1a75`, review clean após 1 round de fix). Achado
Important real: PostgreSQL não indexa automaticamente o lado referenciador de uma FK
(diferente do MySQL) — 10 colunas FK em 8 modelos ficaram sem índice no schema original
do brief. Corrigido com uma nova migração aditiva (`20260811025843_add_fk_indexes`).

**Task 8 — Seed script populando Principle/ChecklistItem a partir de owasp-content**
minor (deferred): o relatório do implementador atribuiu incorretamente a adição da config
`jest.roots` como pré-existente quando na verdade era nova neste commit — imprecisão
cosmética do relatório, não um defeito de código.
cross-task note: esta tarefa modificou legitimamente `packages/owasp-content/src/index.ts`
(arquivo da Tarefa 2) para corrigir uma incompatibilidade real `import.meta.url`/CommonJS
que só surgiu quando `apps/api` passou a consumir o pacote via ts-jest — verificado de
forma independente pelo revisor como necessário e corretamente isolado (commit
`7523b42`).
complete (commits `68e1a75..7523b42`, review clean).

**Task 9 — Módulo de auth (bcrypt + JWT + endpoint de login)**
minor (deferred): canal lateral de timing por enumeração de e-mail em
`validateCredentials` (`bcrypt.compare` só é chamado para e-mails conhecidos) — presente
no próprio código de referência do plano, nota de hardening para fase futura.
minor (deferred): sem `@MaxLength(72)` na senha do `LoginDto` — bcrypt trunca
silenciosamente além de 72 bytes. Risco baixo no escopo da Fase 0.
complete (commits `7523b42..7657660`, review clean).

**Task 10 — Script bootstrap-admin**
minor (deferred): cast de tipo (`process.env as Pick<...>`) no entrypoint CLI em vez de
reshape explícito por object literal — seguro, sem risco de runtime verificado (a
validação acontece dentro de `bootstrapAdmin` independente de como o argumento foi
tipado); o revisor reproduziu de forma independente o erro de TypeScript em modo strict
para confirmar que era real.
complete (commits `7657660..fb9787b`, review clean).

**Task 11 — Scaffold Vite + React + Tailwind com página de login mínima**
fix round 1/5 (1 endereçado, 0 aberto — commit não revelado do `package-lock.json` na
raiz do repo, fora do escopo `git add apps/web` do brief e revertendo silenciosamente a
convenção que as 7 tarefas anteriores seguiram; cirurgia de git — reset + commit
re-escopado; commits `fb9787b..ebc6d01`).
minor (deferred): scan de segurança automático apontou `accessToken` guardado em
`localStorage` (`Login.tsx`) como padrão de armazenamento de credencial inseguro — casa
exatamente com o brief original do plano (JWT em localStorage); aceitável para o escopo
de fundação da Fase 0, vale um passo de hardening (cookie httpOnly ou sessionStorage) em
fase futura.
complete (commits `fb9787b..ebc6d01`, review clean após 1 round de fix).

**Task 12 — Docker Compose + finalização do `.env.example`**
minor (deferred): scan de segurança automático apontou credenciais padrão de dev no
`docker-compose.yml` (postgres `champion`/`champion`, fallback de `JWT_SECRET`) e
containers rodando como root nos Dockerfiles — tudo casa com o brief original do plano,
padrão comum para tooling de dev local, não deployment de produção. Candidato a
hardening em fase futura, fora do escopo da Fase 0.
fix round 1/5 (1 endereçado, 0 aberto — `package-lock.json` passou a ser commitado para
builds Docker reprodutíveis; commits `be9b179..673da0d`).
complete (commits `ebc6d01..673da0d`, review clean após 1 round de fix). Stack Docker
completa verificada de ponta a ponta (postgres+api+web, health check, checagens curl).
Achado real de bloqueio Alpine/Prisma corrigido com `apk add --no-cache openssl`.

**Task 13 — CI (GitHub Actions: lint, typecheck, test)**
complete (commits `673da0d..9d8c07c`, review clean).

## Revisão final de branch inteira (após a Tarefa 13)

Dispatch em modelo mais capaz (`opus`), cobrindo todo o range `6f95d0c..9d8c07c` (17
commits). Encontrou **2 Críticos** e **7 Importantes** — gaps de integração entre
tarefas que nenhuma revisão individual conseguiria pegar isoladamente:

- **C1**: CI nunca rodava `prisma generate` → typecheck/tests falhariam contra um client
  stub sem tipos de modelo.
- **C2**: `docker compose up` nunca rodava o seed → tabelas `Principle`/`ChecklistItem`
  ficariam vazias no critério de aceite principal.
- **I1**: variáveis de bootstrap (`ADMIN_*`) nunca chegavam ao container `api`.
- **I2**: default de `JWT_SECRET` no compose derrotava a validação fail-fast.
- **I3**: sem CORS na API — o `apps/web` não conseguia chamar a API entre origens
  diferentes na stack composta.
- **I4**: `typecheck` do `apps/web` era um no-op (não seguia project references).
- **I5**: `apps/web` nunca era lintado (config adicionada, script `lint` nunca criado).
- **I6**: testes e2e nunca rodavam no CI.
- **I7**: `bootstrapAdmin` não era atômico — falha entre os dois `create` podia deixar a
  instância permanentemente sem recuperação.

minor (deferred): scan de segurança automático apontou CORS permissivo
(`app.enableCors()` sem opções) em `main.ts` — casa exatamente com a instrução explícita
do fix wave (I3, permissivo por design no escopo de dev). Candidato a hardening
(allowlist de origem) em fase futura.

**Fix wave 1** (9/9 achados endereçados, incluindo um bug de acoplamento não planejado
descoberto durante a verificação do C2 — `ts-node` não conseguia importar
`packages/owasp-content` por causa do `"type": "module"` no `package.json` do pacote;
corrigido removendo esse campo, consistente com a correção da Tarefa 8. Commits
`9d8c07c..8e034eb`).

**Residual pós-fix-wave** (Important, load-bearing): a própria correção do I1
(`env_file: .env` no serviço `api`) quebrava `docker compose up` em um clone limpo, já
que `.env` está no `.gitignore` e nada documentava criá-lo primeiro. Pela disciplina do
processo ("não há segunda fix wave automática para achados da revisão final"), isso foi
levado ao usuário no checkpoint de `finishing-a-development-branch` em vez de corrigido
silenciosamente.

**Decisão do usuário**: corrigir antes de integrar.

**Fix residual**: `env_file` mudado para a forma estendida (`path: .env` /
`required: false`, sintaxe Compose Specification ≥2.24) para degradar graciosamente na
ausência de `.env`, mais criação do `README.md` com quickstart. Verificado nos dois
cenários (sem `.env` presente — não fatal; com `.env` real — stack completa sobe, health
check ok, bootstrap-admin funciona). Commits `8e034eb..41927fb`, review clean.

## Merge para `main`

- Branch principal renomeada de `master` para `main` (repositório local, sem remote
  configurado — operação segura).
- `worktree-fase0-fundacao` mesclada em `main` via fast-forward, sem conflitos.
- Suite completa (17 testes unitários + 3 e2e) reexecutada no resultado do merge: verde.
- Worktree e branch de feature removidos após confirmação.

## Resumo de achados adiados (não bloqueantes, candidatos a fase futura)

| Área | Achado | Quando revisitar |
|---|---|---|
| Auth | Canal lateral de timing por enumeração de e-mail | Quando auto-registro for adicionado (Fase 2) |
| Auth | Sem `@MaxLength(72)` na senha | Quando fluxo de troca/reset de senha existir |
| Auth | JWT em `localStorage` | Decidir explicitamente na spec da Fase 1a, antes de multiplicar fetches autenticados |
| Docker | Credenciais padrão de dev + containers como root | Antes de qualquer deployment além de dev local |
| API | CORS permissivo (sem allowlist) | Antes de qualquer deployment além de dev local |
| Dados | 2 mapeamentos `principleId` um pouco frouxos | Só vira bloqueante se a avaliação de maturidade (Fase 1a) pontuar princípios via checklist items |
| Dados | `PrincipleScore.principleId` sem índice próprio | Dobrar na próxima migração de schema — é a única coluna FK sem índice dedicado hoje |
| Docs | Sem `LICENSE` para o código do projeto (`ATTRIBUTION.md` referencia um que não existe) | Resolver antes de qualquer divulgação pública do repositório |
| Dados | `Champion` sem `organizationId` direto (só via `teamId` opcional) | Decisão explícita necessária na spec da Fase 1a (autorização) |
| Dados | Sem regras `onDelete`, sem `updatedAt` em nenhum modelo | Quando exclusão de Team/Assessment for uma operação real |
| Testes | `seed.spec.ts`/`bootstrap-admin.spec.ts` sem isolamento de banco | Antes de a suíte de testes de integração crescer na Fase 1a |
