# Relatório de Varredura — MeloCalé 4.0
Data: 2026-05-14

---

## Resumo Executivo

| Categoria | Quantidade |
|---|---|
| 🔴 Erros críticos de segurança | 5 |
| 🟠 Bugs de lógica | 7 |
| 🟡 Problemas de performance | 5 |
| 🔵 Problemas de UX/UI | 5 |
| 🟣 Problemas de arquitetura | 6 |
| ⚫ Problemas no backend | 4 |
| **TOTAL** | **32** |

---

## 🔴 CRÍTICO (resolver imediatamente)

---

### [C-01] Race condition no webhook do Stripe — duplo crédito possível

**Arquivo:** `backend/server.ts` linha ~135–165  
**Problema:** A deduplicação de eventos Stripe usa o padrão check-then-insert em nível de aplicação. Duas requisições simultâneas (retry do Stripe + processamento original) podem ambas passar na verificação `existingTx == null` antes de qualquer inserção ser concluída.  
**Impacto:** Um evento `checkout.session.completed` pode ser processado duas vezes, creditando moedas em dobro ao usuário. Em ambiente de produção com latência variável, essa janela de corrida é real.  
**Fix sugerido:**
```sql
-- Adicionar constraint única no banco:
ALTER TABLE wallet_transactions ADD CONSTRAINT uq_stripe_event_id UNIQUE (stripe_event_id);

-- No insert, usar ON CONFLICT DO NOTHING e verificar rows_affected:
.insert({ ..., stripe_event_id: event.id })
-- Se rows_affected == 0, o evento já foi processado
```

---

### [C-02] Authorization bypass no endpoint de suporte

**Arquivo:** `backend/server.ts` linha ~689–702  
**Problema:** O endpoint `POST /api/support-ticket` aceita `user_id` diretamente do corpo da requisição, sem validar se pertence ao usuário autenticado.  
**Impacto:** Qualquer usuário autenticado pode criar tickets em nome de outro usuário, injetando `user_id` arbitrário no body. Permite abuso do sistema de suporte e possível exposição de conversas alheias.  
**Fix sugerido:**
```typescript
// Ignorar user_id do body; usar sempre o do token:
const { email, conversation } = req.body;
const user_id = (req as AuthRequest).authUser!.id;
```

---

### [C-03] Zero Error Boundaries para 32 rotas lazy-loaded

**Arquivo:** `frontend/src/App.tsx` linhas 18–244  
**Problema:** O projeto tem 32 imports `lazy()` e todos estão envoltos em `<Suspense>`, mas nenhum tem `<ErrorBoundary>`. Qualquer falha de importação (rede ruim, deploy parcial, erro em módulo) causa tela branca silenciosa.  
**Impacto:** O usuário vê um branco total sem mensagem de erro. Não há fallback, não há log de crash no frontend, impossível diagnosticar remotamente.  
**Fix sugerido:**
```tsx
// Criar ErrorBoundary genérico e envolver os grupos de rotas:
<ErrorBoundary fallback={<ErrorPage />}>
  <Suspense fallback={<PageLoader />}>
    <ClientDashboard />
  </Suspense>
</ErrorBoundary>
```

---

### [C-04] Upload de arquivo sem validação de tipo, tamanho ou quantidade

**Arquivo:** `frontend/src/components/RequestWizard.tsx` linhas 135–159  
**Problema:** O handler `handleFileChange` itera sobre `Array.from(files)` e faz upload direto para o Supabase Storage sem checar: tipo MIME, tamanho do arquivo, quantidade máxima de arquivos por pedido.  
**Impacto:** Um usuário pode enviar um arquivo `.exe` renomeado como `.jpg`, ou fazer upload de 10 GB em uma única requisição, ou enviar 500 arquivos num loop. Comprometimento de storage e possível abuso de banda.  
**Fix sugerido:**
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_MB = 5;
const MAX_FILES = 5;
if (Array.from(files).length > MAX_FILES) throw new Error('Máximo 5 arquivos');
for (const file of Array.from(files)) {
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Tipo não permitido');
  if (file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error('Arquivo muito grande');
}
```

---

### [C-05] `useEffect` sem cleanup em requisições assíncronas (memory leaks generalizados)

**Arquivos:** 48 `useEffect` no total; casos graves:
- `frontend/src/pages/professional/Mensagens.tsx` linha ~82
- `frontend/src/components/AiChat/AiChatWidget.tsx` linha ~61
- `frontend/src/components/auth/AuthInitializer.tsx` linha ~12

**Problema:** `useEffect` dispara `async` functions e chama `setState` no callback, sem flag `isMounted` ou `AbortController`. Se o componente desmontar enquanto a chamada está em voo, o React emite warning de memory leak e o estado pode ser sobrescrito por dados de uma sessão anterior.  
**Impacto:** Em navegações rápidas (ex: usuário clica em vários itens do menu), múltiplas requisições concorrentes podem resolver fora de ordem, exibindo dados desatualizados ou da conta errada.  
**Fix sugerido:**
```typescript
useEffect(() => {
  let cancelled = false;
  fetchData().then(data => { if (!cancelled) setState(data); });
  return () => { cancelled = true; };
}, [dependency]);
```

---

## 🟠 IMPORTANTE (resolver em breve)

---

### [L-01] Double-submit em formulários de compra

**Arquivo:** `frontend/src/pages/professional/Leads.tsx` linha ~472–476  
**Observação positiva:** O botão de compra de lead JÁ tem `disabled={purchaseMutation.isPending}`. ✅  
**Problema pendente:** O modal de RequestWizard em `frontend/src/pages/client/Dashboard.tsx` linha ~239 passa `isPending={createRequestMutation.isPending}` para o componente filho, mas não há garantia de que todos os botões de submit dentro do wizard estejam bloqueados durante a mutação. Verificar `RequestWizard.tsx` para confirmar que o submit final fica desativado.  
**Impacto:** Criação duplicada de pedidos, cobrança dupla de moedas.

---

### [L-02] Fire-and-forget em `purchaseLead` sem tratamento de erro

**Arquivo:** `frontend/src/services/dbServices.ts` linhas ~137–155  
**Problema:** Após a compra de um lead, o código dispara `void supabase.from('leads').update(...)` (sem `await`) e encadeia `.then()` para enviar notificações. Nenhum desses passos tem `catch()` adequado.  
**Impacto:** Falhas silenciosas: o lead pode não ser marcado como `orçando`, o cliente pode não receber a notificação, e o profissional não recebe feedback sobre o que deu errado. O `console.error` deixado nessas linhas também vaza informações no console de produção.  
**Fix sugerido:** Usar `await` em todas as etapas dentro de um bloco `try/catch`, ou mover a lógica de notificação para uma Edge Function transacional.

---

### [L-03] Race condition na inicialização de autenticação

**Arquivo:** `frontend/src/components/auth/AuthInitializer.tsx` linhas ~12–50  
**Problema:** O padrão com `currentUserIdRef` e `processingIdRef` tenta evitar processamento duplicado, mas o retorno antecipado `if (processingIdRef.current === userId) return` não checa `isMounted`, e duas mudanças rápidas de sessão (logout + login imediato de outro usuário) podem deixar `processingIdRef` travado no ID antigo.  
**Impacto:** Estado de autenticação pode ficar inconsistente: UI mostra usuário A logado enquanto sessão já é do usuário B.

---

### [L-04] `staleTime` inconsistente entre hooks críticos

**Arquivos:**
- `frontend/src/hooks/useProfile.ts` linha 69: `staleTime: 0`
- `frontend/src/hooks/useClientProfile.ts` linha 45: `staleTime: 0`
- `frontend/src/pages/professional/Dashboard.tsx` linha 25: `staleTime: 1000 * 60 * 5` (5 min)
- `frontend/src/App.tsx` linha 63: `staleTime: 5000` (5 seg, QueryClient default)

**Problema:** O perfil é recarregado a cada micro-interação (`staleTime: 0`), enquanto as stats do dashboard ficam 5 minutos em cache. O saldo de moedas exibido no topo pode ser de 5 minutos atrás enquanto o perfil é sempre fresco.  
**Impacto:** UX confusa: usuário compra lead, saldo atualiza, mas as estatísticas do dashboard ainda mostram o valor antigo por até 5 minutos.

---

### [L-05] Sanitização de input do chat incompleta

**Arquivo:** `backend/server.ts` função `sanitizeUserData` linha ~255  
**Problema:** A função `stripTags` remove tags HTML mas não trata: caracteres de controle Unicode (U+0000–U+001F), sequências inválidas de UTF-8, ou caracteres que podem quebrar logs (ex: `\r` pode fazer log overwrite em terminais).  
**Impacto:** Possível log injection via console, e dados malformados podem chegar à API da Anthropic causando comportamentos inesperados.

---

### [L-06] Resposta de erro 500 vaza mensagem interna do banco

**Arquivo:** `backend/server.ts` linhas ~538–540  
**Problema:**
```typescript
return res.status(500).json({ error: err?.message || "Erro interno..." });
```
Se `err` for um erro do PostgreSQL (via Supabase), a mensagem pode conter nomes de tabelas, colunas, constraints ou fragmentos de query.  
**Impacto:** Information disclosure. Facilita reconhecimento do schema por parte de um atacante.  
**Fix sugerido:** Logar o erro completo no servidor, retornar apenas mensagem genérica ao cliente.

---

### [L-07] Canal de tempo real usa `.removeChannel()` incorretamente

**Arquivo:** `frontend/src/components/RealtimeNotificationHandler.tsx` linha ~45  
**Problema:** O cleanup do `useEffect` chama `supabase.removeChannel(channel)` mas a forma correta de encerrar uma subscription Supabase Realtime é `channel.unsubscribe()` seguido de `supabase.removeChannel(channel)`. Sem o `unsubscribe()`, a conexão WebSocket pode permanecer aberta.  
**Impacto:** Memory leak, WebSocket connections acumuladas, possíveis duplicatas de notificação se o componente remontar.

---

## 🟡 PERFORMANCE (resolver no próximo sprint)

---

### [P-01] 48 `useEffect` — maioria sem cleanup

**Escopo:** Todo o frontend  
**Problema:** De 48 ocorrências de `useEffect`, a grande maioria não retorna função de cleanup. Mesmo onde não há subscriptions, chamadas async sem AbortController se tornam memory leaks em componentes com ciclo de vida curto.  
**Impacto:** Degradação progressiva de performance em sessões longas.

---

### [P-02] `staleTime: 0` no perfil causa re-fetch excessivo

**Arquivos:** `useProfile.ts`, `useClientProfile.ts`  
**Problema:** Com `staleTime: 0`, toda vez que o componente que usa esse hook recebe foco ou remonta, uma nova query ao Supabase é disparada. Em páginas com vários componentes que consomem `useProfile`, isso pode gerar dezenas de requisições por sessão.  
**Fix sugerido:** `staleTime: 1000 * 60 * 2` (2 minutos) é suficiente para dados de perfil que mudam raramente.

---

### [P-03] Ausência de `useMemo`/`useCallback` em componentes pesados

**Arquivo:** `frontend/src/components/AiChat/AiChatWidget.tsx` linhas 61–117  
**Problema:** A função `fetchUserData` é redefinida a cada render e disparada via `useEffect`. Sem `useCallback`, cada re-render desnecessário do pai causa re-execução.  
**Impacto:** Re-fetches de dados de contexto do usuário em toda re-renderização do widget de chat.

---

### [P-04] Nenhuma query no backend tem timeout explícito

**Arquivo:** `backend/server.ts` (todas as queries via `supabaseAdmin`)  
**Problema:** Nenhuma chamada ao Supabase usa timeout. Se o banco ficar lento ou indisponível, as rotas do Express ficam penduradas indefinidamente.  
**Impacto:** Em cenário de degradação de DB, o servidor Node acumula handles abertos até esgotar memória.  
**Fix sugerido:** Usar `Promise.race` com timeout ou configurar `statement_timeout` via RPC.

---

### [P-05] Áudio externo sem controle de lifecycle

**Arquivo:** `frontend/src/components/RealtimeNotificationHandler.tsx` linha ~37  
**Problema:** `new Audio('https://assets.mixkit.co/...')` cria um novo elemento HTMLAudioElement a cada notificação recebida, sem reutilizar, sem pausar instâncias anteriores, sem cleanup.  
**Impacto:** Em rajadas de notificações (ex: mensagens em grupo), múltiplos áudios tocam simultaneamente e os elementos ficam na memória.

---

## 🔵 UX/UI (melhorar experiência do usuário)

---

### [U-01] Nenhum Error Boundary = tela branca sem explicação

**(Ver C-03 acima)** — impacto direto na experiência do usuário final.

---

### [U-02] Mensagens de erro genéricas em fluxos críticos

**Arquivos:** `frontend/src/components/auth/AuthModal.tsx` linha ~191, múltiplas páginas  
**Problema:** Muitos `catch` apenas disparam `toast.error('Erro inesperado.')` sem categorizar o tipo de erro (rede, autenticação, saldo insuficiente, etc.).  
**Impacto:** Usuário não sabe o que fazer. "Erro inesperado" é inútil como orientação.  
**Fix sugerido:** Mapear códigos de erro comuns para mensagens acionáveis:
```typescript
if (error.message.includes('insufficient_funds')) toast.error('Saldo insuficiente. Compre mais moedas.');
if (error.message.includes('network')) toast.error('Sem conexão. Verifique sua internet.');
```

---

### [U-03] Rotas "Em breve" sem empty state consistente

**Arquivo:** `frontend/src/App.tsx` linhas 234–239  
**Problema:** Rotas como `financeiro-auditoria`, `auditoria-logs`, `equipe`, `simulador` e `configuracoes` (admin) renderizam apenas `<div className="p-8 text-[#94A3B8]">X (Em breve)</div>` inline no router config — sem página dedicada, sem voltar ao dashboard, sem indicação de prazo.  
**Impacto:** Admin que navega para essas rotas fica preso numa tela vazia sem contexto.

---

### [U-04] Formulários sem validação frontend antes de chamar o backend

**Arquivos:** Múltiplos formulários no `RequestWizard.tsx` e modais de auth  
**Problema:** Validações existem em alguns campos mas são inconsistentes. Alguns campos obrigatórios só falham após round-trip ao backend.  
**Impacto:** Latência desnecessária para erros triviais (campo vazio, email inválido). Degradação de UX especialmente em conexões lentas.

---

### [U-05] Loading state do AiChatWidget pode exibir dados da sessão anterior

**Arquivo:** `frontend/src/components/AiChat/AiChatWidget.tsx`  
**Problema:** O estado do chat (mensagens, contexto do usuário) não é limpo quando o widget fecha e reabre. Se o usuário abre o chat, navega para outra página, e reabre, vê mensagens antigas.  
**Impacto:** Confusão com dados desatualizados, especialmente se o contexto de rota muda (ex: chat aberto na página de leads vs. na de assinaturas).

---

## 🟣 ARQUITETURA (refactor planejado)

---

### [A-01] `dbServices.ts` com 1.108 linhas — responsabilidade dupla

**Arquivo:** `frontend/src/services/dbServices.ts`  
**Problema:** Um único arquivo contém queries para leads, perfis, mensagens, notificações, wallet, pedidos, estatísticas e mais. É simultaneamente service layer, data transformer e contém lógica de negócio inline.  
**Impacto:** Dificuldade de manutenção, testes impossíveis por acoplamento, qualquer mudança afeta partes não relacionadas.  
**Fix sugerido:** Dividir em módulos por domínio: `leadService.ts`, `walletService.ts`, `messageService.ts`, etc.

---

### [A-02] 8 componentes/páginas acima de 500 linhas

| Arquivo | Linhas |
|---|---|
| `dbServices.ts` | 1.108 |
| `Mensagens.tsx` (profissional) | 841 |
| `Assinatura.tsx` | 785 |
| `Agenda.tsx` (profissional) | 760 |
| `server.ts` | 714 |
| `Mensagens.tsx` (cliente) | 696 |
| `Pedidos.tsx` | 635 |
| `RequestWizard.tsx` | 573 |
| `Leads.tsx` | 549 |

**Problema:** Todos os candidatos a refactor estão acima do limiar de 500 linhas. Componentes grandes são difíceis de testar, revisar e manter.

---

### [A-03] 34 ocorrências de `: any` — TypeScript subaproveitado

**Escopo:** Todo o projeto  
**Casos representativos:**
- `authStore.ts` linha ~27: `(localStorage.getItem('auth_mode') as any)`
- `lib/stripe.ts` linha ~57: `(stripe as any).redirectToCheckout(...)`
- `services/dbServices.ts` linha ~194: `(row: any) => ({`
- `components/auth/AuthModal.tsx` linha ~116: `catch (err: any)`

**Impacto:** Cada `any` é um buraco na segurança de tipos. Bugs que o compilador poderia capturar chegam em produção.

---

### [A-04] 28 `console.log`/`console.error` fora de guards de dev

**Escopo:** 13 no frontend, 15 no backend  
**Problema:** Statements de debug sem `if (import.meta.env.DEV)` ou equivalente. No backend, `console.log` em rotas de webhook loga dados de transações em produção.  
**Impacto:** Vazamento de dados sensíveis em logs de produção (Vercel, servidor), redução de performance em hot paths.

---

### [A-05] Dados de negócio hardcoded no backend

**Arquivo:** `backend/server.ts` linhas ~146–160  
**Problema:**
```typescript
const COIN_PACKAGES = {
  'pack_starter': { coins: 60,  name: 'Básico' },
  'pack_pro':     { coins: 200, name: 'Popular' },
  'pack_premium': { coins: 560, name: 'Máximo' },
};
const PLAN_WELCOME_COINS = {
  plan_basic: 30, plan_pro: 80, plan_business: 200,
};
```
Qualquer mudança de valor exige redeploy do backend. A tabela `coin_packages` já existe no banco mas não é consultada para esses valores.  
**Fix sugerido:** Consultar o banco na inicialização ou na rota, tornando os valores configuráveis pelo admin sem deploy.

---

### [A-06] Lógica de perfil duplicada em `useProfile.ts` e `useClientProfile.ts`

**Arquivos:** `frontend/src/hooks/useProfile.ts`, `frontend/src/hooks/useClientProfile.ts`  
**Problema:** Dois hooks com queries muito similares para dados de perfil, com `staleTime` diferentes e sem composição. Mudança de schema de perfil precisa ser feita em dois lugares.

---

## ⚫ BACKEND (problemas específicos do servidor)

---

### [B-01] Endpoint `GET /api/health` sem autenticação expõe versão e estado

**Arquivo:** `backend/server.ts` linha ~247  
**Problema:** O endpoint de health check é público e pode retornar informações sobre o estado do servidor que facilitam reconhecimento.  
**Fix sugerido:** Ou remover do endpoint público informações além de `{ status: "ok" }`, ou proteger com token de infraestrutura.

---

### [B-02] CORS permite qualquer preview da Vercel com regex amplo

**Arquivo:** `backend/server.ts` linhas ~100–104  
**Problema:** `const VERCEL_PREVIEW_RE = /^https:\/\/melocale4-0-[^.]+\.vercel\.app$/i;` — qualquer pessoa que faça fork do projeto na Vercel com nome começando com `melocale4-0-` terá CORS permitido.  
**Impacto:** Origem não confiável pode fazer requisições autenticadas ao backend usando cookies/tokens de usuários legítimos.

---

### [B-03] Sem validação de schema no body de endpoints POST

**Arquivo:** `backend/server.ts` (múltiplos endpoints)  
**Problema:** Endpoints como `/api/create-checkout-session` e `/api/support-ticket` desestruturem `req.body` diretamente sem validar presença, tipo ou formato dos campos.  
**Fix sugerido:** Usar `zod` para validação de schema:
```typescript
const checkoutSchema = z.object({
  type: z.enum(['coins', 'plan']),
  package_id: z.string().uuid(),
});
const body = checkoutSchema.parse(req.body); // lança se inválido
```

---

### [B-04] Variáveis de ambiente do frontend sem verificação de formato

**Arquivo:** `frontend/src/lib/stripe.ts`, `frontend/src/lib/supabase.ts`  
**Problema:** `requireEnvVar` verifica apenas se a variável existe (truthy), não se tem o formato esperado. Uma chave Stripe começando com `sk_` em vez de `pk_` passaria pela verificação e só falharia na primeira chamada ao Stripe.  
**Fix sugerido:**
```typescript
const key = requireEnvVar('VITE_STRIPE_PUBLISHABLE_KEY');
if (!key.startsWith('pk_')) throw new Error('Chave Stripe inválida — deve começar com pk_');
```

---

## 📊 Métricas do Projeto

| Métrica | Valor |
|---|---|
| Total de arquivos analisados | 76 |
| Total de linhas de código | 15.971 |
| Maior arquivo | `dbServices.ts` (1.108 linhas) |
| Arquivos acima de 500 linhas | 9 |
| Componentes com `: any` | 34 ocorrências em ~15 arquivos |
| `console.log`/`error`/`warn` sem guard de dev | 28 (13 frontend + 15 backend) |
| `useEffect` total no frontend | 48 |
| Queries Supabase sem try/catch | 61 (em componentes — services têm alguma cobertura) |
| Rotas lazy sem Error Boundary | 32 de 32 |
| Endpoints POST sem validação de schema | ~8 |
| Mutações totais identificadas | 75 |
| `staleTime` definido explicitamente | 4 de ~40+ queries |

---

## Priorização Recomendada

### Esta semana (impacto de segurança/financeiro):
1. **[C-01]** Adicionar `UNIQUE(stripe_event_id)` no banco — previne duplo crédito
2. **[C-02]** Corrigir authorization bypass no endpoint de suporte
3. **[C-04]** Adicionar validação de tipo/tamanho/quantidade em uploads
4. **[L-06]** Remover mensagens de erro internas das respostas 500

### Próximas 2 semanas (estabilidade):
5. **[C-03]** Adicionar Error Boundaries em todas as rotas lazy
6. **[C-05]** Adicionar cleanup nos 10+ useEffect mais críticos
7. **[L-07]** Corrigir cleanup do canal Realtime (unsubscribe + removeChannel)
8. **[B-03]** Adicionar validação de schema (zod) nos endpoints POST

### Próximo sprint (qualidade):
9. **[A-01]** Quebrar `dbServices.ts` em módulos por domínio
10. **[A-03]** Eliminar os 34 `any` com tipos corretos
11. **[A-04]** Remover ou guardar com `DEV` os 28 console statements
12. **[P-02]** Normalizar `staleTime` em todos os hooks para valores consistentes
13. **[L-05]** Melhorar sanitização do input do chat
14. **[B-02]** Tornar regex de CORS mais restrito ou usar denylist

---

*Relatório gerado por varredura estática de código — sem execução do sistema.*  
*Nenhuma alteração foi feita no código.*
