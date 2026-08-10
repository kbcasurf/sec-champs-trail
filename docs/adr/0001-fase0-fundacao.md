# ADR 0001: Decisões de arquitetura da Fase 0 (Fundação)

- Status: Aceito
- Data: 2026-08-10
- PRD de origem: `PRD-security-champions-assistant.md`
- Spec derivada: `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`

## Contexto

Este ADR registra as decisões tomadas em sessão de brainstorming (assistida) sobre o
PRD original do ChampionForge / Security Champions Assistant, antes de detalhar a spec
técnica da Fase 0. A sessão original em que essas decisões foram discutidas foi perdida
por uma pane no ambiente antes que um ADR fosse salvo; este documento foi reconstruído a
partir do histórico de transcript da sessão e confere com o conteúdo já registrado na
spec da Fase 0 (nenhuma decisão nova é introduzida aqui — este é o registro formal do
que já estava implícito na spec).

Cada decisão abaixo ajusta ou detalha a seção 5 ("Arquitetura Técnica") ou 7
("Roadmap") do PRD original.

---

## Decisão 1 — Ingestão de conteúdo OWASP: curadoria manual, não scraping

**Problema:** o PRD (seção 5.1) sugeria ingestão do conteúdo OWASP via
scraping/parsing em runtime, mas a seção 8 (riscos) já reconhecia essa abordagem como
frágil e propunha sincronização manual periódica — as duas seções se contradiziam.

**Opções consideradas:**
- Curadoria manual, versionada como JSON no repo, com atualização periódica manual documentada.
- Manter pipeline de scraping/parsing automatizado (runtime ou build-time) com cache local.

**Decisão:** curadoria manual. Conteúdo do Manifesto e dos checklists é transcrito uma
vez para `packages/owasp-content`, versionado em git. Sem scraping automático.

**Consequências:** mais simples e robusto, elimina dependência de disponibilidade/
layout do site fonte em runtime. Custo: atualizações de conteúdo exigem processo manual
recorrente (não há sincronização automática).

---

## Decisão 2 — Divisão do MVP em Fase 1a (sem IA) e Fase 1b (com IA)

**Problema:** o PRD tratava F1-F5 como uma entrega única de MVP em 4-6 semanas,
estimativa considerada otimista dado que F3 (trilhas por IA) e F5 (relatório executivo
por IA) são, cada uma, projetos de prompt-engineering e validação de schema por si só.

**Opções consideradas:**
- Dividir em Fase 1a (F1 avaliação de maturidade, F4 checklists, F2 plano de ação por
  regras simples — sem IA) e Fase 1b (F3 + F5 — camada de IA sobre a base da 1a).
- Manter F1-F5 como uma única entrega de MVP.

**Decisão:** dividir em 1a e 1b.

**Consequências:** o produto fica utilizável (avaliação + checklists + plano de ação)
antes de a camada de IA existir, reduzindo risco de atraso por causa da complexidade de
F3/F5 e permitindo validar a base do produto antes de investir em prompt engineering.

---

## Decisão 3 — Multi-tenancy: uma Organization por instância

**Problema:** o modelo de dados do PRD já implicava suporte a múltiplas organizações,
mas F8 (multi-tenant) só estava planejada para a Fase 3 — ambiguidade sobre se o MVP já
precisaria suportar múltiplas orgs isoladas na mesma instância.

**Opções consideradas:**
- Uma única `Organization` por instância self-hosted desde a Fase 0 (mas múltiplos
  `Team`s dentro dela, conforme modelo `Organization → Team` já previsto).
- Multi-org desde o MVP, pensando em um possível modelo SaaS hospedado no futuro.

**Decisão:** uma `Organization` por instância. F8 original é reavaliado na Fase 3 (pode
deixar de fazer sentido como feature separada).

**Consequências:** simplifica auth, permissões e onboarding do MVP. Uma futura oferta
multi-org exigiria trabalho de migração de modelo, não apenas de feature.

---

## Decisão 4 — Backend: NestJS (não FastAPI)

**Problema:** o PRD deixava em aberto NestJS (Node/TS) ou FastAPI (Python) para o
backend.

**Opções consideradas:**
- Node.js + NestJS — TypeScript full-stack, consistente com o frontend React; SDK
  oficial da Anthropic em TS; estrutura modular do Nest facilita organizar domínio
  (assessments, training, reports).
- Python + FastAPI — bom se houvesse mais familiaridade com Python; pydantic encaixa
  bem com validação de outputs estruturados de LLM.

**Decisão:** NestJS.

**Consequências:** uma única linguagem (TypeScript) em todo o stack de produto,
reduzindo custo de troca de contexto entre frontend e backend.

---

## Decisão 5 — Autenticação do MVP: apenas JWT local

**Problema:** o PRD sugeria "JWT + opção SSO/OIDC" sem definir se OIDC seria necessário
já no MVP.

**Opções consideradas:**
- JWT local simples (usuário/senha), com OIDC/SSO documentado como extensão futura
  (Fase 2/3).
- OIDC desde o MVP, pensando em adoção corporativa que exige SSO desde o primeiro uso.

**Decisão:** apenas JWT local na Fase 0/1. Sem OIDC/SSO implementado agora.

**Consequências:** reduz complexidade inicial de auth. Adoção corporativa que exija SSO
obrigatório não é atendida até uma fase futura.

---

## Decisão 6 — Roadmap aprovado: Fase 0 → 1a → 1b → 2 → 3

**Decisão:** seguir a decomposição abaixo, cada fase com spec e plano de implementação
próprios, escritos e aprovados sequencialmente:

| Fase | Escopo | Entrega |
|---|---|---|
| Fase 0 | Monorepo, curadoria OWASP, `ATTRIBUTION.md`, modelo de dados completo, Docker Compose, auth JWT local | Repo rodando localmente, sem features de produto |
| Fase 1a | F1 (avaliação de maturidade) + F4 (checklists) + F2 simplificado (plano de ação por regras) | Produto utilizável sem chave de IA configurada |
| Fase 1b | F3 (trilhas de treinamento por IA) + F5 (relatório executivo por IA) | MVP completo conforme PRD original |
| Fase 2 | F6 (quiz/gamificação) + F7 (comunidade) | Pós-MVP |
| Fase 3 | F8 (multi-tenant, reavaliado à luz da Decisão 3) + F9 (integração SAMM/Threat Dragon) | Expansão |

---

## Decisão 7 — Estrutura do monorepo: npm workspaces simples

**Problema:** como organizar frontend (React), backend (NestJS) e conteúdo OWASP
curado no mesmo repositório.

**Opções consideradas:**
- npm workspaces simples (`apps/web`, `apps/api`, `packages/owasp-content` sob um
  `package.json` raiz), sem ferramenta extra de build orchestration.
- Turborepo — mesma estrutura de pastas, com orquestração de build/cache.
- Polyrepo — frontend, backend e conteúdo OWASP em repositórios git distintos.

**Decisão:** npm workspaces simples.

**Consequências:** menor barreira de entrada para contribuidores de um projeto
open-source novo; sem overhead de ferramenta adicional. Se o número de pacotes crescer
significativamente, orquestração de build pode precisar ser revisitada.

---

## Decisão 8 — Local do conteúdo OWASP curado: dentro do monorepo

**Opções consideradas:**
- `packages/owasp-content` dentro do monorepo, versionado junto com o código
  consumidor.
- Repositório separado, consumido como dependência externa (submodule ou pacote
  publicado).

**Decisão:** dentro do monorepo, como package próprio.

**Consequências:** mantém schema de conteúdo e código que o consome sempre em
sincronia na mesma revisão/PR. Reuso do conteúdo por outros projetos exigiria extração
posterior.

---

## Decisão 9 — Ferramental de backend: npm + Prisma

**Opções consideradas:**
- npm + Prisma — migrations declarativas, schema tipado, boa ergonomia para o modelo
  `Organization → Team → Champion → Assessment`.
- pnpm + TypeORM — pnpm mais eficiente em disco; TypeORM é a integração mais comum do
  ecossistema NestJS via decorators, porém com migrations manuais mais trabalhosas.

**Decisão:** npm + Prisma.

**Consequências:** ORM com boa documentação para contribuidores open-source; único
gerenciador de pacotes (npm) em todo o monorepo, sem mistura com pnpm.

---

## Decisão 10 — Inicialização do controle de versão

**Decisão:** `git init` + `.gitignore` + primeiro commit ao final da Fase 0, feito em
`f0c78b5` ("Add PRD and Fase 0 (foundation) design spec").

**Consequências:** nenhuma — decisão operacional, já executada.

---

## Notas

- Todas as decisões acima já estavam refletidas na spec aprovada
  `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`; este ADR é o registro
  formal que faltava, não uma revisão de escopo.
- A sessão original também havia criado um backlog de 8 tarefas (specs + planos para
  Fase 0, 1a, 1b, 2 e 3), que não sobreviveu à pane. Deve ser recriado conforme o
  trabalho avançar.
