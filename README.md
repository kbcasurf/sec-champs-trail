# ChampionForge

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
