# Fase 0 — Fundação (ChampionForge / Security Champions Assistant)

Status: Aprovado
Data: 2026-08-10
PRD de origem: `PRD-security-champions-assistant.md`

## 1. Contexto

O PRD original define um roadmap em 4 fases (Fase 0 a 3). Este documento detalha a
**Fase 0**: a fundação técnica sobre a qual todas as features de produto (Fases 1a, 1b,
2, 3) serão construídas. Fase 0 não entrega nenhuma tela ou fluxo de produto — entrega
um repositório funcional, versionado, com dados de referência OWASP curados e pronto
para receber features.

## 2. Decisões que ajustam o PRD original

Estas decisões foram tomadas em brainstorming e têm precedência sobre a seção 5
("Arquitetura Técnica") do PRD onde houver conflito:

| Tema | PRD original | Decisão |
|---|---|---|
| Ingestão de conteúdo OWASP | "scraping/parsing controlado... em runtime" | Curadoria **manual**, versionada como JSON no repo (`packages/owasp-content`). Sem scraping em runtime ou build-time. Atualização é um processo manual periódico, documentado. |
| Escopo do MVP | F1-F5 como uma entrega única | Dividido em **Fase 1a** (F1, F2 simplificado, F4 — sem IA) e **Fase 1b** (F3, F5 — camada de IA). Cada uma com spec e plano próprios. |
| Multi-tenancy | Modelo de dados já implica multi-org desde o MVP; F8 (multi-tenant) fica em Fase 3 | Self-host = **uma Organization por instância** desde a Fase 0. F8 original é reavaliado na Fase 3 (pode nem fazer mais sentido como feature separada). |
| Backend | NestJS **ou** FastAPI (a decidir) | **NestJS** (Node/TypeScript), consistência de linguagem com o frontend React. |
| Auth (MVP) | JWT + opção SSO/OIDC | **Apenas JWT local** (usuário/senha) na Fase 0/1. OIDC documentado como extensão futura, não implementado agora. |

Essas decisões devem ser refletidas de volta no PRD (seção 5 e 7) numa revisão futura,
mas este documento é a referência técnica válida para a implementação da Fase 0 em diante.

## 3. Escopo da Fase 0

Entregar um monorepo rodando localmente via Docker Compose, com:
- Estrutura de pastas e ferramental configurados (lint, typecheck, test, CI).
- Conteúdo OWASP (manifesto de 10 princípios + checklists oficiais) curado manualmente
  e versionado como dado estruturado.
- Modelo de dados completo no Prisma (incluindo tabelas de fases futuras, para evitar
  migrations destrutivas depois), mas sem endpoints/UI de produto.
- Autenticação JWT local funcional (login, bootstrap do primeiro usuário/admin).
- `ATTRIBUTION.md` citando a OWASP e a licença CC BY-SA 4.0.

Explicitamente **fora de escopo**: qualquer tela de avaliação de maturidade, checklist
interativo, geração de trilha, relatório executivo, ou qualquer integração com IA.

## 4. Estrutura de pastas (monorepo, npm workspaces)

```
sec-champs-trail/
├── package.json                 # workspaces raiz
├── docker-compose.yml           # postgres + api + web (dev)
├── .env.example
├── ATTRIBUTION.md
├── apps/
│   ├── web/                     # React + Vite + Tailwind
│   └── api/                     # NestJS + Prisma
├── packages/
│   └── owasp-content/           # JSON curado do manifesto + checklists
└── docs/
    └── superpowers/specs/       # specs de design deste projeto
```

**Justificativa**: npm workspaces (sem Turborepo) — menor barreira de entrada para
contribuidores de um projeto open-source novo; não há ainda número de pacotes que
justifique orquestração de build/cache adicional. `packages/owasp-content` fica no
mesmo monorepo (não em repo separado) para manter schema de conteúdo e código que o
consome sempre em sincronia na mesma revisão.

## 5. `packages/owasp-content` — schema do conteúdo curado

Pacote de dados puro, sem lógica de runtime. Um arquivo por princípio e um arquivo por
fase de checklist:

```
packages/owasp-content/
├── principles/
│   ├── 01-<slug>.json
│   ├── ...
│   └── 10-<slug>.json
└── checklists/
    ├── recruitment.json
    └── development-retention.json
```

Schema de um princípio:
```json
{
  "id": "string (slug estável)",
  "order": "number (1-10)",
  "title": "string",
  "description": "string",
  "sourceUrl": "https://securitychampions.owasp.org/manifesto/",
  "license": "CC BY-SA 4.0"
}
```

Schema de um item de checklist:
```json
{
  "id": "string (slug estável)",
  "principleId": "string (referencia principles[].id)",
  "phase": "recruitment | development-retention",
  "title": "string",
  "description": "string",
  "sourceUrl": "string",
  "license": "CC BY-SA 4.0"
}
```

A curadoria em si (ler o guia oficial da OWASP e transcrever/adaptar o conteúdo para
esse schema, com atribuição correta por item) é uma tarefa de implementação da Fase 0,
não um exercício de automação — é trabalho humano de transcrição cuidadosa, dado o
requisito de atribuição do PRD (seção 1.5).

Este pacote é consumido por `apps/api` via *seed script* rodado no boot/migration, que
popula tabelas de referência (`Principle`, `ChecklistItem`) no Postgres. Essas tabelas
não são editáveis via UI — são somente leitura do ponto de vista do produto.

## 6. Modelo de dados (Prisma)

```
Organization (singleton — uma linha por instância self-hosted)
 └── Team
      └── Champion (User: email, passwordHash, role: admin|champion, teamId)

Principle          (seed a partir de owasp-content; global, não pertence a uma Organization)
ChecklistItem       (seed a partir de owasp-content; referencia Principle + phase)

MaturityAssessment  (schema presente; sem endpoints até Fase 1a)
 └── PrincipleScore

ActionPlan          (schema presente; sem endpoints até Fase 1a)
 └── ActionItem

TrainingTrack        (schema presente; sem endpoints até Fase 1b)
 └── TrainingModule

ExecutiveReport      (schema presente; sem endpoints até Fase 1b)
```

**Justificativa de incluir tabelas de fases futuras já na Fase 0**: evita migrations
destrutivas ou renomeações de schema no meio do projeto; o Prisma schema completo é
definido uma vez, populado incrementalmente por fase.

## 7. Autenticação

- JWT local: NestJS + `@nestjs/passport` + `passport-jwt`, senhas com `bcrypt`.
- Bootstrap: script/CLI de seed cria a única `Organization` da instância e o primeiro
  `Champion` com role admin, a partir de variáveis de ambiente (`.env`) ou prompt
  interativo — não deve haver rota pública de "criar organização" (evita instâncias
  self-hosted acidentalmente multi-org).
- Sem OIDC/SSO nesta fase.

## 8. Infraestrutura e qualidade

- **Docker Compose** (dev): serviços `postgres`, `api`, `web`.
- **`.env.example`** documentando todas as variáveis; validação de env no boot da API
  (fail-fast se `DATABASE_URL`, `JWT_SECRET` etc. estiverem ausentes).
- **Testes**: Jest para `apps/api` (unit + e2e contra Postgres real via docker);
  Vitest para `apps/web`.
- **CI**: GitHub Actions rodando lint, typecheck e testes em cada PR.
- **Package manager**: npm. **ORM/migrations**: Prisma.
- `git init` + `.gitignore` + primeiro commit ao final da Fase 0.

## 9. Critérios de aceite da Fase 0

- [ ] `docker compose up` sobe Postgres + API + Web localmente sem erros.
- [ ] Seed popula `Principle` (10 registros) e `ChecklistItem` a partir de
      `packages/owasp-content`, com conteúdo real transcrito do guia oficial da OWASP
      (não placeholder).
- [ ] `ATTRIBUTION.md` presente, citando OWASP Security Champions Guide e CC BY-SA 4.0.
- [ ] É possível fazer bootstrap do primeiro admin e fazer login via JWT (via API; UI
      de login pode ser mínima).
- [ ] CI roda lint + typecheck + test em PR e passa.
- [ ] Prisma schema contempla todas as entidades da seção 6 (mesmo as sem endpoint).
- [ ] Repositório git inicializado com histórico de commits legível.

## 10. Fora de escopo (explícito)

- Qualquer UI ou endpoint de produto (avaliação, checklist interativo, trilhas,
  relatórios).
- Qualquer integração com provedor de IA.
- OIDC/SSO.
- Multi-organização por instância.
