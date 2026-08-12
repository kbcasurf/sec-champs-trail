# ChampionForge

Ferramenta open-source para ajudar organizações a construir, operar e amadurecer
programas de Security Champions, usando o **OWASP Security Champions Guide** (Manifesto
de 10 princípios + checklists oficiais) como espinha dorsal. Ver
`PRD-security-champions-assistant.md` para o produto completo e `ROADMAP.md` para o
status atual de cada fase.

## Status

**Fase 0 (Fundação): implementada.** O repositório roda localmente via Docker Compose
com o schema de dados completo, conteúdo OWASP curado e verificado contra o site oficial,
autenticação JWT e CI configurados. Nenhuma tela ou fluxo de produto (avaliação,
checklist interativo, trilhas, relatórios) existe ainda — isso é o escopo da Fase 1a, o
próximo item do roadmap. Detalhes: `ROADMAP.md` e
`docs/superpowers/plans/2026-08-10-fase0-fundacao-execution-log.md`.

## Quickstart

1. Copy the environment template and fill in the required secrets:

   ```bash
   cp .env.example .env
   ```

   At minimum, set `JWT_SECRET` (16+ characters, no default provided) and
   `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ORGANIZATION_NAME` (used to bootstrap the
   first admin below).

2. Build and start the stack:

   ```bash
   docker compose up --build -d
   ```

3. Create the first organization and admin user:

   ```bash
   docker compose exec api npm run bootstrap:admin
   ```

   This reads `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ORGANIZATION_NAME` from
   the environment and only needs to be run once.

4. Verify it's up:
   - API health check: `GET http://localhost:3000/health`
   - Web app: `http://localhost:5173`
