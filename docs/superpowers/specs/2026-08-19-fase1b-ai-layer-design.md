# Fase 1b — Camada de IA (ChampionForge / Security Champions Assistant)

## 1. Contexto

A Fase 0 e a Fase 1a entregaram o MVP sem IA (ver `ROADMAP.md`): avaliação de maturidade
(F1), biblioteca de checklists (F4) e um plano de ação determinístico baseado em regras
(F2 simplificado). O schema Prisma já reserva, desde a Fase 0, os modelos `TrainingTrack`,
`TrainingModule` e `ExecutiveReport` — sem nenhum endpoint que os use.

Esta fase completa o MVP original do PRD com as duas features que dependem de um provider
de IA configurado pelo usuário:

- **F3 — Training Track Generator**: a partir do stack tecnológico do time, nível de
  experiência e tempo disponível/semana, gera uma trilha de estudo (tópicos priorizados,
  exercícios práticos, quiz de reforço), exportável em Markdown/PDF.
- **F5 — Executive Report**: gera um relatório em linguagem executiva a partir dos dados
  de maturidade e progresso da Fase 1a, para justificar investimento no programa perante a
  liderança.

Antes de desenhar esta spec, por pedido do usuário, foi feita uma pesquisa nos dois
projetos irmãos deste mesmo autor que já têm features de "relatório via IA" em produção —
`~/Documentos/repos/sammwise-ai` (Next.js, gap analysis SAMM) e
`~/Documentos/repos/threat-dragon-ai` (fork do OWASP Threat Dragon com geração de relatório
de ameaças via IA). As decisões desta spec citam explicitamente onde replicam um padrão já
validado nesses projetos e onde divergem.

## 2. Escopo da Fase 1b

**Dentro do escopo:**

1. `AiProviderService` — adaptador HTTP genérico (sem SDK de fornecedor), configurado por
   variáveis de ambiente, compartilhado pelas duas features.
2. `GET /ai/status` — endpoint público-autenticado que informa se a IA está configurada,
   consumido pelo frontend para decidir o que renderizar.
3. F3 completo: geração, persistência com histórico, listagem, detalhe, export
   Markdown/PDF.
4. F5 completo: mesma mecânica, escopado à Organization inteira (não por Team).
5. Migration Prisma: novos campos em `TrainingTrack` (inputs de geração) + enum
   `ExperienceLevel`. `TrainingModule` e `ExecutiveReport` não mudam de forma (o campo
   `content` já existente vira o corpo Markdown completo).
6. Modal de consentimento client-side (F3 e F5) antes do primeiro envio de dados ao
   provider de IA, por sessão de navegador.
7. Rótulo "Conteúdo gerado por IA" visível na tela, no Markdown exportado e na view de
   impressão — cumprindo o texto já reservado em `ATTRIBUTION.md`.
8. `@Throttle` mais restrito nos dois endpoints de geração (5 req/min/IP), além do limite
   global já existente (Task 3 do hardening de 2026-08-19).

**Fora do escopo (explícito):**

- Comparação com benchmarks de mercado no F5. Pesquisado (Katilyst "State of Security
  Champions Report 2025", cruzado com BSIMM15; OWASP SAMM Benchmark Report) — nenhuma
  fonte real encontrada mapeia diretamente para a escala 0-4 por princípio deste app (o
  benchmark do SAMM mede 5 funções de negócio diferentes das 10 do Manifesto daqui, com
  amostra pequena e autodeclarada pouco representativa; o dado do Katilyst/BSIMM15 é só
  adoção percentual de programas, não um score comparável). Decisão: sem seção de
  benchmark nesta fase, para não arriscar a IA inventar números de mercado sem fonte.
- Quiz interativo com pontuação/leaderboard — o conteúdo do quiz gerado é texto estático
  dentro do módulo (pergunta + gabarito em Markdown), sem motor de interação. O motor de
  quiz de verdade é a F6 (Fase 2, Post-MVP), fora do escopo daqui.
- Setting de API key por Organization no banco (com UI de admin) — a key vive só em env
  var, como nos dois projetos irmãos, consistente com o modelo "uma Organization por
  instância self-hosted" já decidido na ADR 0001.
- Geração de PDF no backend (Puppeteer ou lib pura) — o export usa print-to-PDF do
  navegador sobre uma view HTML dedicada, para não adicionar peso nem processo novo à
  imagem Docker.
- SDK oficial de algum provider de IA (`@anthropic-ai/sdk` etc.) — adaptador HTTP próprio,
  igual aos dois projetos irmãos.
- Relatório executivo por Team (além do agregado por Organization) — o schema já reserva
  `ExecutiveReport.organizationId`, sem `teamId`; manter assim.

## 3. Decisões desta spec

| Tema | Decisão | Consequência |
|---|---|---|
| Provider de IA | Adaptador HTTP próprio (sem SDK), formato selecionável por `AI_PROVIDER_API_FORMAT` (`openai` default \| `anthropic`), config 100% via env vars, `AI_PROVIDER_API_URL` deve começar com `https://` | Replica o padrão já validado em produção nos dois projetos irmãos. Suporta Anthropic, OpenAI, ou qualquer endpoint compatível com o formato OpenAI (proxy local, OpenRouter etc.) sem código novo por fornecedor. Atende a NFR do PRD ("suporte a múltiplos providers" como mitigação de risco). |
| "Modo sem IA" | Gate = presença da API key (`AiProviderService.isEnabled()`), não uma flag de config separada | Mesmo padrão dos irmãos. `GET /ai/status` expõe isso ao frontend; nenhum endpoint de geração roda sem key configurada (retorna 403). |
| Cache dos resultados | Persistir por entidade (gera no POST, salva, GET devolve o salvo) — sem chave de hash de dedup entre times/orgs diferentes | Mais simples que a redação literal do ROADMAP ("cache de combinações idênticas"), mas é exatamente o que os dois projetos irmãos fazem em produção, e mapeia direto nos modelos `TrainingTrack`/`ExecutiveReport` já existentes sem campo novo de hash. "Regenerar" é só chamar o POST de novo. |
| Local da API key | Env vars (`AI_PROVIDER_API_KEY` etc.), não uma coluna em `Organization` | Consistente com a ADR 0001 (uma Organization por instância) e com o padrão dos irmãos — sem UI de admin nova, sem criptografia em repouso pra resolver agora. |
| Consentimento antes de enviar dados à IA | Modal client-side com checkbox, gate por sessão de navegador (`sessionStorage`), sem persistência no backend — para F3 **e** F5 | Replica o `AiReportConsent.vue` do `threat-dragon-ai` (que só existe lá, não no sammwise-ai). Estendido a F3 porque a trilha de treinamento também envia dado do time (stack, lacunas de maturidade) a um serviço externo. É uma trava de UX, não uma permissão de servidor — mesma escolha dos irmãos. |
| Grounding do F3 | Além dos inputs explícitos do PRD (stack, nível, horas/semana), o prompt recebe os princípios com menor score do `MaturityAssessment` mais recente do time e os `ChecklistItem`s pendentes, marcados como `<dados_do_time>DADOS NÃO CONFIÁVEIS</dados_do_time>` | Trilha fica direcionada às fraquezas reais do time em vez de genérica, reaproveitando dado que a Fase 1a já coleta. A marcação de dados não confiáveis replica a defesa contra prompt injection do `threat-dragon-ai` (lá aplicada ao conteúdo do diagrama enviado pelo usuário). |
| Escopo do F5 | Agregado por Organization inteira (todos os Teams em um relatório só, com breakdown por time dentro do mesmo documento) | Bate com o schema já existente (`ExecutiveReport.organizationId`, sem `teamId`) e com a ADR 0001. Sem migration de schema para este ponto. |
| Histórico de gerações | Cada geração cria uma linha nova (sem upsert); listagem por Team (F3) ou Organization (F5) ordenada por `createdAt desc` | Consistente com a decisão já tomada na Fase 1a para `MaturityAssessment` ("retomar nunca sobrescreve"). Necessário para a "evolução histórica" que o próprio PRD pede no F5. |
| Export PDF | Print-to-PDF do navegador sobre uma view HTML dedicada (`@media print`), não geração no backend | Zero dependência nova, zero peso na imagem Docker (Puppeteer adicionaria 300MB+; nenhum dos dois irmãos gera PDF, não há padrão pra reaproveitar). Trade-off aceito: qualidade do PDF depende do motor de impressão do navegador do usuário, não é pixel-perfect controlado pelo servidor. |
| Benchmark de mercado no F5 | Fora de escopo (ver seção 2) | Pesquisado ativamente (Katilyst 2025 + OWASP SAMM Benchmark), decisão tomada com base em dados reais, não por omissão. |
| Rate limiting extra | `@Throttle({ default: { limit: 5, ttl: 60_000 } })` em `POST /training-tracks` e `POST /executive-reports`, além do guard global de 100/min já existente | Chamadas de IA custam dinheiro real da key do usuário — barreira própria contra clique repetido ou retry em loop no frontend, mesmo espírito da Task 3 do hardening de 2026-08-19. |
| RBAC do F5 | `RolesGuard("admin")` — só admin gera/lista relatórios executivos | É o relatório pra CISO/liderança sobre o programa inteiro; natural restringir a quem administra o programa, diferente do F3 (champion pode gerar trilha pro próprio time). |
| Rótulo de conteúdo de IA | Badge fixo "Conteúdo gerado por IA" na tela, no cabeçalho do Markdown exportado e na view de impressão | Cumpre o texto já reservado em `ATTRIBUTION.md` desde a Fase 0 ("labeled as such, distinguishable from the original OWASP content"). |
| Tratamento de erro da IA | Sem retry automático; falha de parse ou do provider vira 502 genérico; frontend mostra erro com botão de retry manual | Replica o padrão dos dois irmãos (nenhum faz retry automático). |

## 4. Novas dependências

Nenhuma. Nem SDK de IA, nem lib de geração de PDF, nem lib de parsing/validação nova — o
parse da resposta da IA é feito à mão (extract JSON de dentro de fences/texto solto +
normalização campo a campo), replicando a implementação dos dois projetos irmãos, sem
depender de `zod` ou equivalente (o projeto já usa `class-validator` para DTOs de entrada,
não para saída de IA).

## 5. Provider de IA (`apps/api/src/ai/`)

```
ai/
  ai.module.ts
  ai.controller.ts          # GET /ai/status
  ai-provider.service.ts    # adaptador HTTP + isEnabled()
  ai-provider.service.spec.ts
```

`AiProviderService.generate(systemPrompt: string, userPrompt: string): Promise<string>`:
monta o corpo da requisição conforme `AI_PROVIDER_API_FORMAT` (adapter map `openai` |
`anthropic`, default `openai` — cobre também qualquer endpoint compatível com o formato
OpenAI), chama `fetch` (injetado via construtor para ser testável sem rede real, mesmo
espírito do `deps.fetchDep` do `threat-dragon-ai`), extrai o texto da resposta e devolve
como string crua. Quem chama (`training-track-generator.ts` /
`executive-report-generator.ts`) é responsável por extrair e validar o JSON esperado
dentro dessa string.

Variáveis de ambiente novas (todas opcionais — ausência de `AI_PROVIDER_API_KEY` é o
"modo sem IA"). Exemplo apontando para a Anthropic (o default de `AI_PROVIDER_API_FORMAT`
é `openai`, que também cobre qualquer endpoint compatível com esse formato):

```
AI_PROVIDER_API_URL=https://api.anthropic.com/v1/messages
AI_PROVIDER_API_KEY=
AI_PROVIDER_API_FORMAT=anthropic
AI_PROVIDER_MODEL=claude-sonnet-5
AI_PROVIDER_TIMEOUT_MS=60000
AI_PROVIDER_MAX_TOKENS=4000
```

`AI_PROVIDER_API_URL` que não comece com `https://` faz `validateEnv` lançar no boot,
mesmo padrão de defesa que os irmãos aplicam em runtime (aqui, adiantado pro boot,
consistente com como este projeto já valida `JWT_SECRET`/`WEB_ORIGIN`).

## 6. Modelo de dados (mudanças no Prisma schema)

```prisma
enum ExperienceLevel {
  beginner
  intermediate
  advanced
}

model TrainingTrack {
  id              String          @id @default(uuid())
  teamId          String
  team            Team            @relation(fields: [teamId], references: [id])
  createdAt       DateTime        @default(now())
  techStack       String
  experienceLevel ExperienceLevel
  hoursPerWeek    Int

  modules TrainingModule[]

  @@index([teamId])
}
```

`TrainingModule` e `ExecutiveReport` não mudam de forma — `content: String` já existente
em ambos vira o corpo Markdown completo (título, explicação, exercícios sugeridos e quiz
de reforço no caso do módulo; o relatório inteiro no caso do `ExecutiveReport`). Nenhuma
tabela tem linhas hoje (endpoints nunca existiram), então a migration é puramente aditiva,
sem backfill.

## 7. API — endpoints novos

| Método | Rota | Guard | Descrição |
|---|---|---|---|
| GET | `/ai/status` | `JwtAuthGuard` | `{ enabled: boolean }` |
| POST | `/training-tracks` | `JwtAuthGuard`, `TeamScopeGuard`, `@Throttle(5/min)` | Body `{ teamId, techStack, experienceLevel, hoursPerWeek }`. Gera e persiste. |
| GET | `/training-tracks?teamId=` | `JwtAuthGuard`, `TeamScopeGuard` | Histórico do time, mais recente primeiro. |
| GET | `/training-tracks/:id` | `JwtAuthGuard`, `TeamScopeGuard` | Detalhe (usado pela view de impressão). |
| POST | `/executive-reports` | `JwtAuthGuard`, `RolesGuard("admin")`, `@Throttle(5/min)` | Sem body além do auth — agrega toda a Organization. |
| GET | `/executive-reports` | `JwtAuthGuard`, `RolesGuard("admin")` | Histórico da Organization. |
| GET | `/executive-reports/:id` | `JwtAuthGuard`, `RolesGuard("admin")` | Detalhe. |

## 8. Frontend

Duas páginas novas em `apps/web/src/pages/` (`TrainingTrack.tsx`, `ExecutiveReport.tsx`),
seguindo o padrão de página já usado (`ChecklistLibrary`, `ActionPlan`): nav sempre
visível; cada página consulta `GET /ai/status` no mount e substitui o formulário por um
aviso quando `enabled: false`. Modal de consentimento (`AiConsentModal`, compartilhado
pelas duas páginas) aparece antes do primeiro clique em "Gerar" da sessão. Botão "Exportar
Markdown" gera um `Blob` client-side (metadados + rótulo de IA + conteúdo) sem lib nova.
Botão "Exportar PDF" abre uma rota de impressão (`/training-tracks/:id/print`,
`/executive-reports/:id/print`) com CSS `@media print` escondendo nav/chrome e chama
`window.print()`.

## 9. Testes

- `ai-provider.service.spec.ts`: `fetch` injetado, sem rede real; casos de sucesso, erro
  HTTP, e `isEnabled()` com/sem key.
- `training-track-generator.spec.ts` / `executive-report-generator.spec.ts`: funções
  puras de prompt-building e extract/normalize da resposta, com fixtures de JSON válido,
  malformado, e com campos faltando/inválidos (normalização caindo pra default, não
  rejeitando o item inteiro — mesmo padrão dos irmãos).
- `training-tracks.e2e-spec.ts` / `executive-reports.e2e-spec.ts`: novidade em relação ao
  padrão e2e atual do repo — usam `moduleRef.overrideProvider(AiProviderService)` com uma
  implementação fake determinística, já que não há key de IA real disponível em CI. O
  caminho "sem IA configurada" (403) é testado à parte, direto contra o `AppModule` real
  sem override.
- Frontend: testes de componente para o modal de consentimento e para o banner de "sem
  IA configurada".

## 10. Critérios de aceite da Fase 1b

- `npm run typecheck`, `npm run lint`, `npm run test` (todos os workspaces) limpos.
- `npm run test:e2e -w apps/api` limpo, incluindo os specs novos de `training-tracks` e
  `executive-reports`.
- Com `AI_PROVIDER_API_KEY` ausente: `GET /ai/status` retorna `{ enabled: false }`,
  `POST /training-tracks` e `POST /executive-reports` retornam 403; telas de F3/F5
  mostram o aviso em vez do formulário.
- Com `AI_PROVIDER_API_KEY` configurada (manual, contra um provider real ou um stub
  local): gerar uma trilha de treinamento produz módulos coerentes com o stack informado
  e com as lacunas reais do time; gerar um relatório executivo produz um documento
  cobrindo todos os Teams da Organization.
- Histórico: gerar duas vezes para o mesmo time/Organization produz duas linhas
  distintas, ambas visíveis na listagem.
- Export Markdown baixa um arquivo com o rótulo de IA no topo. Export PDF abre a view de
  impressão sem nav/chrome, com o mesmo rótulo visível.
- Modal de consentimento aparece antes do primeiro "Gerar" de cada sessão de navegador
  (F3 e F5), não reaparece dentro da mesma sessão depois de aceito.
- `AI_PROVIDER_API_URL` sem `https://` falha o boot da API com mensagem de erro clara.
- 6ª tentativa consecutiva de `POST /training-tracks` (ou `/executive-reports`) no mesmo
  minuto recebe 429.

## 11. Itens adiados (não bloqueantes, candidatos a fase futura)

| Área | Item | Quando revisitar |
|---|---|---|
| F5 | Comparação com benchmarks de mercado | Se surgir uma fonte de dados que mapeie de verdade para a escala 0-4 por princípio deste app |
| F3/F6 | Quiz interativo com pontuação | Fase 2 (F6 — Quiz Engine / Gamificação) |
| Infra | API key por Organization no banco, com UI de admin | Se o modelo "uma Organization por instância" for revisto (Fase 3, ADR 0001 Decisão 3) |
| Export | Geração de PDF no backend (Puppeteer/lib pura) | Se print-to-PDF do navegador se provar insuficiente na prática (layout inconsistente entre navegadores, por exemplo) |
| F5 | Relatório por Team, além do agregado por Organization | Se a demanda de produto pedir isso explicitamente |
