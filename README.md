# ChampionForge

Ferramenta open-source para ajudar organizações a construir, operar e amadurecer
programas de Security Champions, usando o **OWASP Security Champions Guide** (Manifesto
de 10 princípios + checklists oficiais) como espinha dorsal. Ver
`PRD-security-champions-assistant.md` para o produto completo e `ROADMAP.md` para o
status atual de cada fase.

## Status

**Fase 0 (Fundação) e Fase 1a (MVP sem IA): implementadas.** O produto já é utilizável
de ponta a ponta **sem** nenhuma chave de IA configurada — avaliação de maturidade do
programa de champions, biblioteca de checklists e plano de ação gerado por regras, todos
descritos abaixo. A camada de IA (geração de trilhas de treinamento e relatório
executivo) é o escopo da Fase 1b, o próximo item do roadmap. Detalhes:
`ROADMAP.md`, `docs/superpowers/plans/2026-08-10-fase0-fundacao-execution-log.md` e
`docs/superpowers/plans/2026-08-13-fase1a-mvp-execution-log.md`.

## Funcionalidades atuais

Importante: **isto não é uma ferramenta de avaliação de maturidade de SDLC/código**
(isso já é papel de outras ferramentas do portfólio, como o SAMMwise-ai, baseadas em
OWASP SAMM). O ChampionForge mede a maturidade de **como a organização recruta, treina e
retém security champions** — os 10 princípios do Manifesto OWASP Security Champions
Guide — não a postura de segurança do código que os times produzem.

- **Autenticação** — login local por e-mail/senha (JWT em cookie `httpOnly`). Não existe
  cadastro público; o primeiro administrador é criado via script de bootstrap (ver
  Quickstart), e administradores subsequentes/champions são criados pela própria UI.
- **Administração de Times e Champions** *(admin)* — em `/teams`: criar Teams, criar
  Champions e atribuí-los a um Team. Um `Champion` com role `champion` sempre precisa
  estar associado a um Team; administradores podem existir sem Team (supervisionam
  todos).
- **Avaliação de Maturidade do Programa** *(F1, em `/assessment/new` e `/dashboard`)* —
  questionário de 10 perguntas (uma por princípio do Manifesto), cada uma respondida
  numa escala 0-4 com descrição própria por nível. A avaliação é por Team, e cada
  submissão cria um novo snapshot histórico (refazer a avaliação nunca apaga a anterior).
  O dashboard mostra um radar chart do snapshot mais recente do time (admins escolhem
  qual time visualizar).
- **Biblioteca de Checklists** *(F4, em `/checklist`)* — todos os checklists oficiais da
  OWASP, navegáveis por princípio e por fase do ciclo de vida (recrutamento /
  desenvolvimento e retenção), com checkbox de progresso por item, por Team.
- **Plano de Ação por regras** *(F2 simplificado, em `/action-plan`)* — a partir do
  snapshot de avaliação mais recente do time, gera um roadmap em três horizontes (3, 6 e
  12 meses), priorizando os princípios com menor maturidade. É determinístico (sem IA):
  os 3 princípios mais fracos vão para o bucket de 3 meses, os próximos 3 para 6 meses,
  e os 4 mais fortes para 12 meses. Regenerar o plano nunca reseta o progresso já
  marcado na biblioteca de checklists — as duas coisas são independentes.

## Como usar (passo a passo)

1. Depois do bootstrap (Quickstart abaixo), faça login em `http://localhost:5173` com o
   e-mail/senha de admin.
2. Em **Teams**, crie um Team para o time que vai usar o programa.
3. Ainda em **Teams**, crie um Champion (e-mail/senha), atribuído a esse Team. Esse
   champion (ou o próprio admin) poderá logar e responder a avaliação daquele time.
4. Logado como esse champion (ou como admin, que pode ver qualquer time), vá em **New
   assessment** e responda as 10 perguntas.
5. Veja o resultado em **Dashboard** (radar chart).
6. Em **Action plan**, clique em "Generate new plan" para gerar o roadmap priorizado.
7. Em **Checklist**, marque o progresso dos itens conforme forem sendo implementados —
   esse progresso aparece refletido no plano de ação, e sobrevive a uma regeneração do
   plano.

## Quickstart

1. Copie o template de variáveis de ambiente e preencha os segredos obrigatórios:

   ```bash
   cp .env.example .env
   ```

   No mínimo, defina `JWT_SECRET` (16+ caracteres, sem valor padrão) e `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `ORGANIZATION_NAME` (usados para inicializar o primeiro admin no
   passo 3). `WEB_ORIGIN` já vem preenchido para o valor padrão do frontend em dev
   (`http://localhost:5173`) — só precisa mudar se você alterar essa porta.

2. Suba a stack completa (Postgres + API + Web):

   ```bash
   docker compose up --build -d
   ```

   A API roda as migrations do Prisma e o seed do conteúdo OWASP curado
   (`Principle`/`ChecklistItem`/`PrincipleMaturityLevel`) automaticamente no boot.

3. Crie a Organization e o primeiro admin (só precisa rodar uma vez por instância — não
   existe rota pública para isso, de propósito):

   ```bash
   docker compose exec api npm run bootstrap:admin
   ```

   Lê `ADMIN_EMAIL`, `ADMIN_PASSWORD` e `ORGANIZATION_NAME` do ambiente.

4. Verifique que subiu:
   - Health check da API: `GET http://localhost:3000/health`
   - Web app: `http://localhost:5173`

5. Faça login com o e-mail/senha do admin e siga o passo a passo da seção acima.

### Resetar o ambiente local

Para zerar o banco (perde todos os dados) e recomeçar do zero:

```bash
docker compose down -v
docker compose up --build -d
docker compose exec api npm run bootstrap:admin
```

### Rodando sem Docker (desenvolvimento)

Requer Node.js ≥20 e um Postgres acessível via `DATABASE_URL`.

```bash
npm install
npm run db:migrate:deploy -w apps/api
npm run db:generate -w apps/api
npm run db:seed -w apps/api
npm run bootstrap:admin -w apps/api
npm run start:dev -w apps/api   # API em :3000
npm run dev -w apps/web         # Web em :5173 (outro terminal)
```
