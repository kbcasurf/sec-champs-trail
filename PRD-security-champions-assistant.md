# PRD — Security Champions Assistant

## 1. Visão Geral

### 1.1 Nome do Projeto (sugestão)
**ChampionForge** *(alternativas: SecChampAI, ChampionOps, ChampCraft)*

### 1.2 Resumo Executivo
Uma aplicação que auxilia organizações a construir, operar e amadurecer programas de Security Champions, usando como espinha dorsal o **OWASP Security Champions Guide** (Manifesto de 10 princípios + checklists oficiais) e adicionando uma camada de IA para personalizar treinamentos, avaliar maturidade do programa e gerar relatórios executivos.

### 1.3 Problema
Programas de Security Champions frequentemente falham ou se dissolvem por:
- Falta de estrutura e métricas claras de acompanhamento.
- Treinamento genérico, não adaptado à stack técnica de cada champion.
- Dificuldade do "capitão do programa" em reportar valor/ROI para a liderança.
- Ausência de ferramentas que conectem o guia teórico da OWASP à prática do dia a dia.

### 1.4 Objetivo do Produto
Fornecer uma ferramenta open-source que:
1. Avalie a maturidade de um programa de Security Champions com base nos 10 princípios da OWASP.
2. Gere planos de ação e checklists personalizados por fase (recrutamento, desenvolvimento, retenção).
3. Crie trilhas de treinamento e materiais de estudo customizados por stack tecnológica, usando IA.
4. Produza relatórios executivos que justifiquem investimento no programa.

### 1.5 Licenciamento e Atribuição (importante)
O conteúdo do OWASP Security Champions Guide é licenciado em **CC BY-SA 4.0**.
- Qualquer conteúdo derivado (checklists, textos adaptados) distribuído pelo app deve manter licença compatível (share-alike) e créditos visíveis à OWASP e ao projeto original (`securitychampions.owasp.org`).
- O app deve manter uma página `ATTRIBUTION.md` no repositório citando a fonte e a licença.
- Conteúdo **gerado por IA** a partir do guia (ex: trilhas de treinamento) deve ser tratado como derivativo e seguir a mesma lógica de atribuição, deixando claro ao usuário final o que é "OWASP original" vs "gerado/adaptado por IA".

---

## 2. Personas

| Persona | Descrição | Necessidade Principal |
|---|---|---|
| **Capitão do Programa (AppSec Lead)** | Responsável por criar/manter o programa de champions | Estrutura, métricas, relatórios para liderança |
| **Security Champion** | Dev com interesse em segurança, ponto focal no time | Trilha de aprendizado clara, reconhecimento, comunidade |
| **CISO / Liderança** | Aprova orçamento e prioridades | Visibilidade de ROI e maturidade do programa |
| **Novo entrante no programa** | Dev recém-nomeado champion | Onboarding guiado, saber por onde começar |

---

## 3. Funcionalidades (Features)

### 3.1 MVP (Fase 1)

**F1. Avaliação de Maturidade do Programa**
- Questionário estruturado baseado nos 10 princípios do Manifesto OWASP.
- Score de maturidade por princípio (ex: 0-4, escala tipo SAMM).
- Visualização tipo radar chart (semelhante ao SAMM).

**F2. Plano de Ação Personalizado**
- A partir do score, a IA gera um roadmap de 3-6-12 meses.
- Prioriza princípios com menor maturidade.
- Baseado nos checklists oficiais da OWASP (recrutamento, treinamento, retenção etc.).

**F3. Gerador de Trilhas de Treinamento**
- Usuário informa: stack tecnológica do time (ex: Java Spring, Node.js, Python/Django), nível de experiência, tempo disponível/semana.
- IA gera trilha de estudo com: tópicos priorizados (OWASP Top 10, ASVS relevante à stack), sugestões de exercícios práticos (ex: labs do OWASP Juice Shop / WebGoat), formato de quiz de fixação.
- Exporta em Markdown / PDF.

**F4. Biblioteca de Checklists**
- Todos os checklists oficiais da OWASP Security Champions Guide, navegáveis por princípio e fase do ciclo de vida (Atração/Recrutamento → Desenvolvimento/Retenção).
- Marcação de progresso (checkbox) por organização.

**F5. Relatório Executivo**
- IA gera relatório em linguagem executiva (para CISO/liderança) a partir dos dados de maturidade e progresso.
- Inclui: score atual, evolução histórica, riscos de não investir, comparação com benchmarks do setor (quando disponível).

### 3.2 Fase 2 (Pós-MVP)

**F6. Quiz Engine / Gamificação**
- Geração automática de quizzes por tópico (IA), com leaderboard por organização.
- Integração opcional com CTF-style challenges (ex: links para OWASP Juice Shop).

**F7. Comunidade / Knowledge Sharing**
- Espaço para champions compartilharem descobertas, dúvidas, casos reais (fórum simples ou integração com Discord/Slack via webhook).

**F8. Multi-tenant / Multi-time**
- Suporte a múltiplos times/squads dentro da mesma organização, com dashboards agregados e por time.

**F9. Integração com ferramentas AppSec existentes**
- Conectar com o SAMM e o Threat Dragon já publicados no seu portfólio, criando um "painel unificado de maturidade AppSec".

### 3.3 Fora de Escopo (explicitamente)
- Não é uma plataforma de LMS completa (sem vídeo hosting, certificados formais).
- Não substitui SAST/DAST — é sobre pessoas e processo, não sobre código.

---

## 4. Requisitos Não-Funcionais

- **Open-source** (licença sugerida: Apache 2.0 ou MIT para o código; CC BY-SA 4.0 para conteúdo derivado da OWASP).
- **Self-hostable**: deve rodar localmente via Docker Compose para orgs que não querem enviar dados a serviços externos.
- **Privacidade**: dados de avaliação de maturidade são sensíveis (podem expor fraquezas internas) — não devem ser expostos publicamente por padrão.
- **Custo de IA controlável**: usuário deve poder plugar sua própria API key (Anthropic/OpenAI) — sem custo embutido para o mantenedor do projeto.
- **Acessível via navegador**, responsivo (uso também por champions em contexto informal).

---

## 5. Arquitetura Técnica (Sugestão)

### 5.1 Stack

| Camada | Tecnologia sugerida | Justificativa |
|---|---|---|
| Frontend | React + Vite + Tailwind | Consistência com Threat Dragon/SAMM (se usar stack similar) |
| Backend | Node.js (NestJS) ou Python (FastAPI) | APIs simples, fácil integração com IA |
| Banco de dados | PostgreSQL | Dados estruturados (scores, times, progresso) |
| IA | API Anthropic (Claude) via chave própria do usuário | Geração de trilhas, relatórios, quizzes |
| Autenticação | Auth simples (JWT) + opção SSO (OIDC) para uso corporativo | Self-host friendly |
| Deploy | Docker Compose (self-host) + opção de deploy estático (Vercel/Netlify) para versão demo | Facilita adoção |
| Conteúdo OWASP | Ingestão via scraping/parsing controlado do conteúdo público OWASP (com cache local versionado) | Evita dependência de disponibilidade externa em runtime |

### 5.2 Modelo de Dados (alto nível)

```
Organization
 └── Team
      └── Champion (user)
      └── MaturityAssessment
           └── PrincipleScore (10x, um por princípio do manifesto)
      └── TrainingTrack
           └── TrainingModule (gerado por IA)
      └── ActionPlan
           └── ActionItem (checklist item, status)
      └── ExecutiveReport (snapshot gerado)
```

### 5.3 Fluxo de Geração de Trilha de Treinamento (exemplo de prompt design)

1. Input estruturado do usuário (stack, nível, tempo disponível).
2. Contexto injetado no prompt: trecho relevante do checklist oficial + OWASP Top 10 / ASVS mapeado à stack.
3. Prompt para IA gerar JSON estruturado (tópicos, ordem, recursos, exercícios).
4. Validação de schema da resposta antes de renderizar.
5. Cache de trilhas geradas (evitar reprocessar combinações idênticas).

---

## 6. Métricas de Sucesso do Produto

- Nº de organizações usando o self-host (telemetria opcional, opt-in).
- Nº de estrelas/forks no GitHub.
- Taxa de conclusão de trilhas de treinamento geradas.
- Feedback qualitativo de "capitões de programa" sobre utilidade do relatório executivo.

---

## 7. Roadmap Sugerido

| Fase | Entregas | Estimativa |
|---|---|---|
| Fase 0 | Setup do repo, ingestão/estruturação do conteúdo OWASP (manifesto + checklists em JSON/Markdown), ATTRIBUTION.md | 1-2 semanas |
| Fase 1 (MVP) | F1-F5 | 4-6 semanas |
| Fase 2 | F6-F7 | 4 semanas |
| Fase 3 | F8-F9 (integração com SAMM/Threat Dragon do portfólio) | 3-4 semanas |

---

## 8. Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Conteúdo OWASP mudar/versão desatualizada | Mecanismo de "última sincronização" visível + processo de atualização periódica manual |
| Uso indevido do relatório de maturidade (dados sensíveis expostos) | Dados privados por padrão, exportação sob controle do usuário |
| Dependência de custo de API de IA | Suporte a múltiplos provedores + modo "sem IA" (checklists estáticos funcionam sozinhos) |
| Baixa adoção por ser nicho | Divulgar na comunidade OWASP (Slack, capítulos locais), possibilidade de submissão como OWASP Project relacionado |

---

## 9. Referências

- OWASP Security Champions Guide: https://securitychampions.owasp.org/
- Manifesto: https://securitychampions.owasp.org/manifesto/
- OWASP Developer Guide — Security Champions: https://devguide.owasp.org/en/08-culture-process/02-security-champions/
- Licença: CC BY-SA 4.0
