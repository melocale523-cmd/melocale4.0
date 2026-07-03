# Relatório de Auditoria — Varredura Completa do Repositório
Data: 2026-07-03 · Branch: `claude/melocale-repo-audit-gng4o2`

---

## 1. Resumo executivo

| Métrica | Valor |
|---|---|
| Arquivos-fonte varridos (frontend + backend, sem node_modules/dist) | 246 |
| Bugs críticos (padrão `void` query builder sem await) | **10 ocorrências** (7 corrigidas, 3 aguardando decisão) |
| Bugs de schema (query seleciona coluna inexistente no banco) | 4 (todos corrigidos) |
| Risco de crash do backend (rejeição sem catch + `process.exit`) | 1 (corrigido) |
| Achados de segurança | 1 código (média, PR de decisão) + 5 no banco/config Supabase (relatório) |
| Qualidade | ~50 símbolos não usados removidos em 24 arquivos, 10 arquivos mortos deletados, 1 feature incompleta documentada |
| Corrigido automaticamente | PR desta branch (fixes seguros) |
| Aguardando decisão do Samuel | 4 PRs (#381, #382, #383, #384) + 5 itens de banco/config |

Validação: `npm run build` (frontend com `VITE_API_URL`, e backend) verde; 16/16 testes do backend passam; 13 testes do frontend passam (1 arquivo de teste, `ReviewModal.test.tsx`, já falhava no baseline por env var ausente — pré-existente, não relacionado).

Consultas ao banco de produção foram **somente leitura** (schema via `information_schema`, corpo de funções via `pg_proc`, advisors). Nenhuma escrita.

---

## 2. Bugs críticos — padrão `void` query builder sem await (item nº 1 da varredura)

O padrão que causou o bug de produção em `leads.ts` foi encontrado em **mais 10 lugares**. O query builder do supabase-js é um thenable preguiçoso: sem `await`/`.then()`, a requisição **nunca é enviada** — sem erro, sem log.

### Corrigidos nesta branch (baixo risco — notificações/analytics)

| Arquivo:linha | O que nunca acontecia |
|---|---|
| `backend/src/routes/clientCoins.ts:60` | Notificação "Perfil completo! +50 moedas" nunca criada |
| `backend/src/routes/clientCoins.ts:100` | Notificação "Avaliação enviada! +30 moedas" nunca criada |
| `backend/src/routes/clientCoins.ts:138` | Notificação "Primeiro pedido! +100 moedas" nunca criada |
| `backend/src/routes/referrals.ts:238` | Notificação in-app "Nova indicação!" nunca criada (o push funcionava; a in-app não) |
| `backend/src/routes/notifications.ts:166` | Notificação in-app do `send-event` (ex.: nova mensagem) nunca criada |
| `frontend/src/components/RequestWizard.tsx:217` | Eventos de funil (`wizard_funnel_events`) por step nunca gravados |
| `frontend/src/components/RequestWizard.tsx:278` | Evento de funil do submit final nunca gravado — **o funil do wizard no admin sempre esteve vazio/errado** |

### Aguardando decisão (tocam saldo de moedas — NÃO aplicados na main)

| Arquivo:linha | Impacto | PR |
|---|---|---|
| `backend/src/routes/referrals.ts:246` | Cascata nível-2 (`credit_cascade_referral`, 20 moedas) **nunca creditada a ninguém** desde o lançamento | [#381](https://github.com/melocale523-cmd/melocale4.0/pull/381) |
| `backend/src/routes/referrals.ts:249` | Bônus de 20 moedas por cadastro via indicação **nunca creditado** | [#382](https://github.com/melocale523-cmd/melocale4.0/pull/382) |
| `backend/src/routes/stripe.ts:159` | 200 moedas ao referrer quando o indicado paga (webhook Stripe) **nunca creditadas** | [#383](https://github.com/melocale523-cmd/melocale4.0/pull/383) |

### Relacionado: risco de crash do backend (corrigido)

`backend/src/routes/leads.ts:349` — `void withTimeout(...)` sem `.catch()`: se o insert demorasse mais de 8s, a rejeição do `Promise.race` virava `unhandledRejection`, e o handler em `server.ts` faz `process.exit(1)` — **um insert lento derrubaria o backend inteiro**. Adicionado `.catch()` com log.

Casos verificados e **OK** (não são bugs): `void sendPushToUser(...)` e `void sendMetaEvent(...)` (funções async com try/catch interno); `void withTimeout(...)` dispara a query (o `Promise.resolve` assina o thenable); `NotificationBell.tsx:86` e `useChatRealtime.ts:83` têm `.then()` encadeado.

---

## 3. Bugs de schema — queries com colunas que não existem no banco (todos corrigidos)

Verificado contra o schema de produção (somente leitura). Quando o PostgREST recebe uma coluna inexistente, a query inteira retorna erro 400 e o código trata como "sem dados":

| Arquivo | Problema | Efeito em produção |
|---|---|---|
| `frontend/src/pages/admin/Dashboard.tsx:176` | `payments.type` não existe | **Gráfico de faturamento histórico (PR #379) sempre vazio.** Fix: identificar assinatura por `package_id LIKE 'plan_%'` |
| `frontend/src/pages/professional/PerfilPublico.tsx:59` | `reviews.client_name` não existe | **Avaliações nunca carregavam na página pública do profissional** (nota média sempre zerada) |
| `frontend/src/pages/client/pedidos/ProfessionalProfileModal.tsx:45` | idem | Avaliações nunca apareciam no modal do profissional (lado cliente). Fix: resolver nome via `profiles`, padrão já usado em `PerfilProfissionalModal.tsx` |
| `frontend/src/pages/admin/Pacotes.tsx:48` | `coin_packages.is_popular` não existe | Badge "Popular" nunca renderizava (UI morta); removido |

---

## 4. Segurança

| Severidade | Achado | Status |
|---|---|---|
| **Média** | CORS aceita **qualquer** `*.vercel.app` com `credentials: true` (`backend/server.ts:68`) — qualquer pessoa com um deploy no Vercel pode fazer requests credenciadas | **Decisão** — [#384](https://github.com/melocale523-cmd/melocale4.0/pull/384) |
| Média | 9 views `SECURITY DEFINER` no banco (`v_my_purchases`, `v_client_leads`, `v_wallet_balance`, etc.) — advisor do Supabase nível ERROR. As views parecem filtrar por `auth.uid()`, mas convém revisar uma a uma (bypassa RLS) | **Decisão** — mudança de banco, sem PR |
| Média/Baixa | 31 funções `SECURITY DEFINER` executáveis por `anon` via `/rest/v1/rpc/` (ex.: `admin_process_withdrawal`, `purchase_lead`). Verifiquei o corpo das 3 funções `admin_*`: **todas checam `role='admin'` internamente** — não é exploitável hoje, mas é defesa em profundidade; recomendo migration de `REVOKE EXECUTE ... FROM anon` | **Decisão** — mudança de banco, sem PR |
| Baixa | Proteção contra senhas vazadas (HaveIBeenPwned) desativada no Supabase Auth | **Decisão** — 1 clique no dashboard |
| Baixa | Buckets públicos `avatars` e `chat-files` permitem **listar** todos os arquivos (policy SELECT ampla) | **Decisão** — ajuste de policy |
| Baixa/Info | `/api/referrals/ranking` e `/api/client-coins/ranking` públicos expõem nome/avatar/UUID dos top users (parece intencional — gamificação) | Documentado |
| OK | Sem segredos hardcoded (só placeholders de teste); sem `dangerouslySetInnerHTML`; webhook Stripe valida assinatura; endpoints sensíveis todos com `requireAuth`/`requireAdmin` + zod; `support-ticket` usa o id do token (o bypass C-02 do relatório de maio foi corrigido) | — |

---

## 5. Erros de lógica

- Nenhum `==`/`!=` problemático (todos são o idioma `== null`).
- `Transacoes.tsx`, `ChatLayout.tsx`, `Assinatura.tsx`, `leadService.ts:384`: erros de **tipagem** pré-existentes (`tsc --noEmit` falha; o build Vite não roda tsc) — funcionam em runtime, mas mascaram erros novos. Recomendação futura: zerar `tsc --noEmit` e adicioná-lo ao CI.
- `admin/Pacotes.tsx`: botões **"Novo Pacote" e "Editar" não fazem nada** — `setShowModal(true)` é chamado mas nenhum modal existe. Feature incompleta, não código morto: precisa de decisão (implementar o modal ou remover os botões). Deixado como está.

## 6. Qualidade de código (corrigido nesta branch)

- **10 arquivos nunca importados removidos**: `Hero.tsx`, `Features.tsx`, `Testimonials.tsx`, `FlashOffer.tsx`, `FeaturedProperties.tsx`, `SocialComingSoonModal.tsx`, `PushPermissionModal.tsx`, `auth/AuthModal.tsx`, `useAuthGuard.ts`, `useUserRole.ts` + `find-fetch.cjs` (script de debug na raiz). Verificado contra imports estáticos **e** dinâmicos (`lazy(() => import(...))`).
- **~50 imports/variáveis não usados removidos em 24 arquivos** (lista completa no diff), via `tsc --noUnusedLocals`. Inclui casos que eram sinal de lógica removida: máquina ViaCEP desconectada no `AddressForm`, query `currentSubscription` sem consumidor no dashboard do profissional, `coinLabel` calculado e descartado no webhook Stripe.
- `any` explícito quase zerado no código atual (2 `: any` + 6 `as any`) — grande melhora vs. os 34 do relatório de maio.

## 7. O que foi corrigido (link)

- **PR desta branch** (fixes seguros, 3 commits temáticos + este relatório): ver PR da branch `claude/melocale-repo-audit-gng4o2`.

## 8. O que precisa de decisão do Samuel

| # | Item | Recomendação |
|---|---|---|
| [#381](https://github.com/melocale523-cmd/melocale4.0/pull/381) | Cascata nível-2 de moedas nunca creditada | Aprovar (fix de 2 linhas); decidir sobre retroativo à parte |
| [#382](https://github.com/melocale523-cmd/melocale4.0/pull/382) | 20 moedas de cadastro via indicação nunca creditadas | Aprovar; decidir sobre retroativo à parte |
| [#383](https://github.com/melocale523-cmd/melocale4.0/pull/383) | 200 moedas de indicação no webhook Stripe nunca creditadas | Aprovar (RPC idempotente, sem risco de duplo crédito); retroativo à parte |
| [#384](https://github.com/melocale523-cmd/melocale4.0/pull/384) | CORS aberto a qualquer `*.vercel.app` | Aprovar após confirmar o prefixo real dos previews |
| — | REVOKE de `anon` nas funções SECURITY DEFINER + revisão das 9 views | Migration dedicada, com testes de regressão dos fluxos anon (cadastro, SEO) |
| — | Ativar proteção de senhas vazadas no Supabase Auth | 1 clique no dashboard |
| — | Policies de listagem dos buckets `avatars`/`chat-files` | Restringir listagem, manter leitura por URL |
| — | Botões sem função em `admin/Pacotes.tsx` | Implementar modal de criação/edição ou remover botões |
| — | Zerar `tsc --noEmit` e adicionar ao CI | Evita a classe inteira de bugs da seção 3 |

**Nenhum PR foi mergeado.** Todos aguardam revisão.
