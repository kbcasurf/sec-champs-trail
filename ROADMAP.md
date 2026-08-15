# Roadmap — ChampionForge / Security Champions Assistant

Este documento é a fonte de verdade **atual** para o status e a ordem das fases do
projeto. Ele substitui a tabela de roadmap da seção 7 do
`PRD-security-champions-assistant.md` (mantida ali como registro histórico da proposta
original) com a decomposição revisada em `docs/adr/0001-fase0-fundacao.md` (Decisão 6).

Cada fase, quando iniciada, ganha sua própria spec de design em
`docs/superpowers/specs/`, um plano de implementação em `docs/superpowers/plans/`, e — ao
terminar — um log de execução ao lado do plano.

## Status geral

```
Fase 0  ████████████████████ 100%  Implementado (main)
Fase 1a ████████████████████ 100%  Implementado (main)
Fase 1b ░░░░░░░░░░░░░░░░░░░░   0%  Próximo — spec ainda não iniciada
Fase 2  ░░░░░░░░░░░░░░░░░░░░   0%  Aguardando Fase 1b
Fase 3  ░░░░░░░░░░░░░░░░░░░░   0%  Aguardando Fase 2
```

## Fase 0 — Fundação ✅ Implementado

**Objetivo:** repositório funcional, versionado, com dados de referência OWASP curados,
sem nenhuma tela ou fluxo de produto ainda.

**Entregue** (mesclado em `main` em 2026-08-12):
- Monorepo npm workspaces (`apps/api`, `apps/web`, `packages/owasp-content`).
- Manifesto OWASP (10 princípios) e checklists de recruitment/development-retention
  curados manualmente a partir do site oficial, com atribuição CC BY-SA 4.0 por item.
- Schema Prisma completo (todas as entidades de todas as fases, mesmo as sem endpoint
  ainda) + seed automático no boot.
- Auth JWT local (bcrypt) + script de bootstrap do primeiro admin (sem rota pública de
  criação de organização).
- Docker Compose funcional de ponta a ponta (Postgres + API + Web).
- CI (GitHub Actions: lint + typecheck + test + e2e).
- `ATTRIBUTION.md`, `README.md` com quickstart.

**Documentos:**
- ADR: `docs/adr/0001-fase0-fundacao.md`
- Spec: `docs/superpowers/specs/2026-08-10-fase0-fundacao-design.md`
- Plano: `docs/superpowers/plans/2026-08-10-fase0-fundacao.md`
- Log de execução: `docs/superpowers/plans/2026-08-10-fase0-fundacao-execution-log.md`

**Itens adiados para fases futuras** (não bloqueantes, ver o log de execução para a lista
completa): JWT em `localStorage`, CORS permissivo, credenciais padrão de dev no Docker
Compose, `LICENSE` do código ainda não criado, `Champion` sem `organizationId` direto.

## Fase 1a — MVP sem IA ✅ Implementado

**Objetivo:** produto utilizável **sem** chave de IA configurada.

**Entregue** (mesclado em `main` em 2026-08-15):
- **Gestão de Team/Champion**: admin cria Teams, cria Champions e os atribui a um Team
  (pré-requisito de infraestrutura que não existia na Fase 0).
- **F1 — Avaliação de Maturidade**: questionário de 10 perguntas (autoavaliação 0-4 com
  descrição de nível autoral por princípio), por Team, com histórico de snapshots
  (retake não sobrescreve), radar chart no dashboard.
- **F4 — Biblioteca de Checklists**: checklists navegáveis por princípio e fase do ciclo
  de vida, com marcação de progresso por Team.
- **F2 simplificado — Plano de Ação por regras**: roadmap 3/6/12 meses gerado por regra
  determinística (ranking por score + `Principle.order`, buckets 3/3/4), sem IA;
  progresso de checklist preservado ao regenerar o plano.
- Migração do JWT de resposta no corpo para cookie `httpOnly` + `SameSite=Strict`;
  guards `RolesGuard`/`TeamScopeGuard` (nenhuma rota tinha guard até esta fase).

**Documentos:**
- Spec: `docs/superpowers/specs/2026-08-13-fase1a-mvp-design.md`
- Plano: `docs/superpowers/plans/2026-08-13-fase1a-mvp.md`
- Log de execução: `docs/superpowers/plans/2026-08-13-fase1a-mvp-execution-log.md`

**Decisões da Fase 0 fechadas nesta fase**: JWT em cookie httpOnly (não mais
localStorage); `Champion` **não** ganhou FK direta para `Organization` (autorização via
role + teamId, dado uma única Organization por instância); os 2 mapeamentos
`principleId` frouxos da Fase 0 deixaram de ser relevantes para o score (a avaliação
virou autoavaliação direta por princípio, não derivada de checklist items).

**Itens adiados para fases futuras** (não bloqueantes, ver o log de execução para a
lista completa): score de pergunta não respondida vira 0 silenciosamente; sem checagem
de existência de time em alguns serviços (500 em vez de 400/404 num teamId inválido);
admin vê `/checklist` e `/action-plan` em branco (só `/dashboard` tem seletor de time);
suíte e2e com flakiness intermitente por paralelismo do Jest (sem `maxWorkers: 1`).

## Fase 1b — Camada de IA

**Objetivo:** completar o MVP original do PRD com as features que dependem de um
provedor de IA configurado pelo usuário.

**Escopo** (PRD F3 + F5):
- **F3 — Gerador de Trilhas de Treinamento**: a partir de stack tecnológica, nível de
  experiência e tempo disponível do time, gera trilha de estudo (tópicos priorizados,
  exercícios práticos, quiz), exportável em Markdown/PDF.
- **F5 — Relatório Executivo**: relatório em linguagem executiva a partir dos dados de
  maturidade e progresso da Fase 1a, para justificar investimento no programa perante
  liderança.

Requer: design de prompts, validação de schema da resposta do modelo, cache de
resultados gerados. Conteúdo gerado por IA deve ser rotulado como tal, distinguível do
conteúdo OWASP original (ver `ATTRIBUTION.md`).

**Status:** spec ainda não iniciada. Próximo passo do backlog.

## Fase 2 — Pós-MVP

**Objetivo:** gamificação e comunidade.

**Escopo** (PRD F6 + F7):
- **F6 — Quiz Engine / Gamificação**: geração automática de quizzes por tópico,
  leaderboard por organização, possível integração com CTF-style challenges (ex: OWASP
  Juice Shop).
- **F7 — Comunidade / Knowledge Sharing**: espaço para champions compartilharem
  descobertas e dúvidas (fórum simples ou webhook para Discord/Slack).

**Status:** aguardando conclusão da Fase 1b.

## Fase 3 — Expansão

**Objetivo:** integrações e reavaliação de escopo à luz do que já foi decidido.

**Escopo** (PRD F8 + F9, ajustado pela ADR 0001):
- **F8 — Multi-tenant**: a Fase 0 já fixou "uma Organization por instância self-hosted".
  F8 original (multi-org na mesma instância) é **reavaliada** aqui — pode nem fazer mais
  sentido como feature separada; ver ADR 0001, Decisão 3.
- **F9 — Integração com SAMM/Threat Dragon**: painel unificado de maturidade AppSec,
  conectando com os outros projetos do portfólio.

**Status:** aguardando conclusão da Fase 2.

## Fora de escopo (todo o projeto, por enquanto)

Conforme PRD seção 3.3: não é uma plataforma de LMS completa (sem vídeo hosting,
certificados formais); não substitui SAST/DAST — é sobre pessoas e processo, não sobre
código.

## Convenções

- Cada fase = 1 spec de design (brainstorming) + 1 plano de implementação (TDD,
  tarefa a tarefa) + 1 log de execução ao final.
- Decisões que ajustam o PRD original ganham um ADR em `docs/adr/`.
- Este arquivo é atualizado ao final de cada fase (status, itens adiados, próxima fase).
