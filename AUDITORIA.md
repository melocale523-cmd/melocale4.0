# Auditoria MeloCalé 4.0 — Relatório Completo

> Gerado em: 2026-06-22  
> Escopo: frontend (`src/`), backend (`src/`), migrations SQL  
> Status: **somente leitura — nenhuma alteração aplicada**

---

## Sumário de Severidade

| Severidade | Qtd | Categorias |
|---|---|---|
| **P0** | 4 | 2× Bug crítico, 2× Segurança |
| **P1** | 11 | 4× Bug, 3× Segurança, 2× Performance, 2× Qualidade |
| **P2** | 8 | 2× Bug, 1× Segurança, 2× UX, 2× Qualidade, 1× Performance |

**Total: 23 achados**

---

## P0 — Críticos (impactam dinheiro ou dados agora)

---

### [P0] Coin packages completamente fora de sync entre frontend e banco

**Categoria:** Bug  
**Arquivo(s):** `frontend/src/lib/coinPackages.ts:1-45` · `INSERT_COIN_PACKAGES.sql:6-10`

**Descrição:**  
Os valores exibidos na UI são completamente diferentes do que está no seed SQL (e presumivelmente no banco de produção):

| Pacote | Frontend (UI mostra) | SQL seed (DB) |
|---|---|---|
| `pack_starter` | 60 moedas / R$24,90 | 50 moedas / R$19,90 |
| `pack_pro` | 180 moedas / R$59,90 | 150 moedas / R$49,90 |
| `pack_premium` | 480 moedas / R$119,90 | 400 moedas / R$99,90 |

O backend faz o crédito com base no valor em `coin_packages` no Supabase (webhook `stripe.ts:177-179`). O usuário vê "180 moedas" na tela, paga, e recebe 150. Isso é fraude (involuntária, mas real).

**Nota:** Os nomes também divergem — frontend usa "Básico/Popular/Máximo", SQL usa "Starter/Pro/Premium". Precisa verificar no Supabase qual valor está ativo hoje com `SELECT * FROM coin_packages` antes de corrigir.

**Sugestão:** Confirmar o valor correto no DB de produção. Sincronizar `coinPackages.ts` com o DB, ou atualizar o DB para bater com o frontend. A fonte de verdade deve ser um único lugar (idealmente o banco, com o frontend consumindo via API).

---

### [P0] Referral registration sempre silenciosa falha — raw fetch sem token de auth

**Categoria:** Bug  
**Arquivo(s):** `frontend/src/pages/auth/Login.tsx:240-248`

**Descrição:**  
Após o signup, `Login.tsx` chama `/api/referrals/register` usando `fetch` nativo sem incluir o header `Authorization`:

```typescript
// Login.tsx:240
await fetch(`${API_URL}/api/referrals/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },  // ← sem Authorization
  body: JSON.stringify({ code: pendingRef, newUserId: signUpData.user.id }),
});
```

O middleware `requireAuth` (`middleware/auth.ts:10`) rejeita qualquer request sem `Authorization: Bearer <token>` com 401. O catch silencia o erro:

```typescript
} catch {
  // silencioso — não bloquear o cadastro por falha de indicação
}
```

Resultado: **nenhum referral é registrado pelo fluxo de signup**. Referrers não recebem créditos, e o programa de indicação está efetivamente quebrado para novos usuários.

**Sugestão:** Substituir `fetch` por `apiFetch` (que inclui o token automaticamente via `lib/api.ts`). Verificar se há sessão disponível imediatamente após `supabase.auth.signUp()` antes de chamar — se o email ainda não foi confirmado, o token pode não existir. Alternativa: mover o registro de referral para o backend no webhook do Supabase `on_auth_user_created`.

---

### [P0] POST /api/track/registration sem autenticação e sem rate limit

**Categoria:** Segurança  
**Arquivo(s):** `backend/src/routes/track.ts:14-28`

**Descrição:**  
O endpoint que dispara o evento `CompleteRegistration` no Meta Pixel é completamente público — sem `requireAuth` e sem `sensitiveLimiter`:

```typescript
router.post("/track/registration", async (req: Request, res: Response) => {
  // ← sem requireAuth, sem sensitiveLimiter
  const parsed = registrationSchema.safeParse(req.body);
```

Qualquer pessoa pode fazer milhares de requisições com `{ role: "professional", email: "..." }` e injetar eventos falsos no Meta Pixel, inflando artificialmente métricas de cadastro e distorcendo a base de dados de anúncios.

**Sugestão:** Adicionar `sensitiveLimiter` (já disponível em `config.ts`) como primeiro middleware. Avaliar se `requireAuth` faz sentido (o evento é disparado imediatamente após o signup, quando o token pode ainda estar disponível pelo `supabase.auth.signUp()`).

---

### [P0] referrals/register aceita newUserId arbitrário sem validar contra usuário autenticado

**Categoria:** Segurança  
**Arquivo(s):** `backend/src/routes/referrals.ts:190-213`

**Descrição:**  
A rota `POST /api/referrals/register` recebe `newUserId` do body mas **não verifica que ele pertence ao usuário autenticado**:

```typescript
router.post('/register', sensitiveLimiter, requireAuth, async (req: Request, res: Response) => {
  const { code, newUserId } = req.body as { code?: string; newUserId?: string }
  // ← sem: if (newUserId !== authUser.id) return 403
  
  if (referrerProfile.id === newUserId) return res.status(400).json({ error: 'self_referral' })
```

Um usuário autenticado (user A) pode passar o ID de qualquer outro usuário como `newUserId`, vinculando um referral a outra pessoa sem o consentimento dela. Consequências: A pode bloquear a possibilidade de B receber o benefício de outra indicação genuína (o check `alreadyReferred` bloqueia duplicatas).

**Sugestão:** Adicionar ao início da rota:
```typescript
const authUser = (req as AuthRequest).authUser!;
if (newUserId !== authUser.id) return res.status(403).json({ error: 'forbidden' });
```

---

## P1 — Alta prioridade (bugs reais ou riscos relevantes)

---

### [P1] void credit_client_coins no webhook — falha silenciosa de crédito

**Categoria:** Bug  
**Arquivo(s):** `backend/src/routes/stripe.ts:157-163`

**Descrição:**  
No webhook de `checkout.session.completed`, as 200 moedas do referrer de tipo cliente são creditadas com `void` sem await:

```typescript
if (referral.referrer_role === 'client') {
  void supabaseAdmin.rpc('credit_client_coins', {  // ← fire-and-forget
    p_user_id: referral.referrer_id,
    p_amount: 200,
    ...
  })
}
```

Se o RPC falhar, ninguém fica sabendo. O referrer nunca recebe as 200 moedas e não há log de erro.

**Sugestão:** Aguardar e logar:
```typescript
const { error: creditErr } = await supabaseAdmin.rpc('credit_client_coins', { ... });
if (creditErr) console.error('[webhook] falha ao creditar moedas ao referrer cliente:', creditErr.message);
```

---

### [P1] catch vazio engole erros do bloco de referral no webhook

**Categoria:** Bug  
**Arquivo(s):** `backend/src/routes/stripe.ts:166-168`

**Descrição:**  
Todo o bloco de lógica de referral (lookup, `credit_referral_reward`, notificação, `credit_client_coins`) está dentro de um try/catch que silencia completamente qualquer exceção:

```typescript
} catch {
  // silencioso — não deixar falha de indicação quebrar o webhook
}
```

O comentário justifica não quebrar o webhook, mas sem log estruturado não há como saber se referrals estão falhando em produção.

**Sugestão:**
```typescript
} catch (err) {
  console.error('[webhook] referral block error:', {
    userId,
    error: err instanceof Error ? err.message : String(err),
    timestamp: new Date().toISOString(),
  });
  // Continua — não quebra o webhook
}
```

---

### [P1] void sendPushToUser e void withTimeout em leads.ts — falhas silenciosas

**Categoria:** Bug  
**Arquivo(s):** `backend/src/routes/leads.ts:279-295`

**Descrição:**  
Push notification e in-app notification para o profissional são disparadas com `void` sem await ou erro tratado:

```typescript
void sendPushToUser(professionalUserId, { ... });  // linha 279

void withTimeout(                                    // linha 289
  supabaseAdmin.from("notifications").insert({ ... })
);
```

Se o push ou o insert falharem, o profissional não recebe a notificação de novo orçamento e não há log.

**Sugestão:** Aguardar e logar (não requer rethrow — a resposta HTTP já foi enviada ou está em andamento):
```typescript
sendPushToUser(professionalUserId, { ... }).catch(err =>
  console.error('[leads] push error:', err instanceof Error ? err.message : String(err))
);
```

---

### [P1] void credit_cascade_referral e void credit_client_coins em referrals.ts

**Categoria:** Bug  
**Arquivo(s):** `backend/src/routes/referrals.ts:231-240`

**Descrição:**  
Duas operações de crédito de moedas são fire-and-forget com `void` sem tratamento de erro:

```typescript
void supabaseAdmin.rpc('credit_cascade_referral', { p_level1_user_id: newUserId })  // linha 231

void supabaseAdmin.rpc('credit_client_coins', {  // linha 234
  p_user_id: newUserId,
  p_amount: 20,
  ...
})
```

Falhas silenciosas significam que o usuário indicado não recebe os 20 bônus de cadastro.

**Sugestão:** Mesma abordagem — `.catch(err => console.error(...))` para rastrear sem bloquear.

---

### [P1] DELETE /push/unsubscribe sem sensitiveLimiter — inconsistência

**Categoria:** Segurança  
**Arquivo(s):** `backend/src/routes/notifications.ts:243`

**Descrição:**  
Todas as rotas mutáveis de notifications têm `sensitiveLimiter`, exceto esta:

```typescript
router.delete("/push/unsubscribe", requireAuth, async ...)  // ← sem sensitiveLimiter
// vs.
router.post("/push/subscribe", sensitiveLimiter, requireAuth, ...)  // ← tem
```

**Sugestão:** Adicionar `sensitiveLimiter` como primeiro middleware para consistência.

---

### [P1] POST /wallet/withdraw sem sensitiveLimiter

**Categoria:** Segurança  
**Arquivo(s):** `backend/src/routes/wallet.ts:23`

**Descrição:**  
A rota de saque (que aciona a API do Asaas externamente) não tem rate limit:

```typescript
router.post('/withdraw', requireAuth, async ...)  // ← sem sensitiveLimiter
```

Permite múltiplas tentativas de saque em burst, podendo sobrecarregar a API do Asaas ou causar comportamento inesperado.

**Sugestão:** `router.post('/withdraw', sensitiveLimiter, requireAuth, ...)`

---

### [P1] PUT /referrals/config faz DB query manual para checar admin em vez de usar requireAdmin

**Categoria:** Segurança / Qualidade  
**Arquivo(s):** `backend/src/routes/referrals.ts:250-255`

**Descrição:**  
A rota de configuração de referral faz a checagem de admin manualmente via query ao Supabase, em vez de usar o middleware `requireAdmin` já existente:

```typescript
router.put('/config', requireAuth, async (req: Request, res: Response) => {
  const callerId = (req as AuthRequest).authUser!.id
  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', callerId).single()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'forbidden' })
```

Além de ser inconsistente com todas as rotas de `admin.ts` (que usam `requireAdmin`), gasta uma query extra a cada request.

**Sugestão:**
```typescript
router.put('/config', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  // sem query manual de role
```

---

### [P1] ALLOWED_ORIGINS definido 4 vezes identicamente em stripe.ts

**Categoria:** Qualidade / Segurança  
**Arquivo(s):** `backend/src/routes/stripe.ts:290-294, 469-473, 530-534, 704-708`

**Descrição:**  
O array de origens permitidas é copiado e colado 4 vezes com nomes diferentes:

```typescript
const ALLOWED_ORIGINS = [...]       // create-checkout-session  ~linha 290
const ALLOWED_ORIGINS_CONNECT = [...] // create-account-link    ~linha 469
const ALLOWED_ORIGINS_SVC = [...]   // create-service-payment   ~linha 530
const ALLOWED_ORIGINS_FEAT = [...]  // create-featured-checkout ~linha 704
```

Qualquer adição de novo domínio (ex: `app.melocale.com.br`) precisa ser feita em 4 lugares. Uma esquecida cria inconsistência de segurança.

**Sugestão:** Extrair para constante única em `backend/src/config.ts`:
```typescript
export const ALLOWED_CHECKOUT_ORIGINS = [
  "https://www.melocale.com.br",
  "https://melocale.com.br",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];
```

---

### [P1] Assinatura.tsx com 914 linhas — candidato a split

**Categoria:** Performance / Qualidade  
**Arquivo(s):** `frontend/src/pages/professional/Assinatura.tsx`

**Descrição:**  
914 linhas em um único componente que concentra: cards de plano, tabela de comparação, pacotes de moedas, histórico de transações, modal de troca de plano, modal de cancelamento, lógica de subscription status. Qualquer alteração exige entendimento do arquivo inteiro.

**Sugestão:** Split em sub-componentes:
- `ProfessionalAssinatura.tsx` — composição
- `SubscriptionPlanCard.tsx` — card de plano mensal
- `CoinPackageSection.tsx` — pacotes avulsos
- `TransactionHistory.tsx` — histórico

---

### [P1] Indicacoes.tsx com 1168 linhas — maior arquivo do frontend

**Categoria:** Performance / Qualidade  
**Arquivo(s):** `frontend/src/pages/client/Indicacoes.tsx`

**Descrição:**  
1168 linhas misturando: código de indicação, QR code, ranking, histórico de saques, bônus, chamadas de API. Re-renders do ranking afetam toda a página.

**Sugestão:** Split em:
- `ReferralCodeCard.tsx`
- `ReferralRanking.tsx`
- `WithdrawalHistory.tsx`
- `ReferralStats.tsx`

---

## P2 — Melhorias (não bloqueiam produção)

---

### [P2] CheckoutSuccess.tsx usa bg-[#1C1F26] — visual destoante do padrão atual

**Categoria:** UX  
**Arquivo(s):** `frontend/src/pages/checkout/CheckoutSuccess.tsx:35`

**Descrição:**  
O card de sucesso usa o tema antigo `#1C1F26` enquanto o padrão do redesign é `#0a1928`:

```tsx
<div className="bg-[#1C1F26] p-8 rounded-2xl border border-emerald-500/20 ...">
```

Visualmente destoa do `CheckoutCancel.tsx` (já redesenhado) e do resto do app.

**Sugestão:** Redesenhar `CheckoutCancel.tsx` — o padrão visual (borda gradiente, card `#0a1928`, ícone, benefícios) já está documentado e aprovado.

---

### [P2] Vários componentes com bg-[#1C1F26] — tema antigo remanescente

**Categoria:** UX  
**Arquivo(s):** `frontend/src/pages/professional/Compras.tsx` · `frontend/src/pages/professional/Dashboard.tsx` · `frontend/src/pages/client/Dashboard.tsx` · `frontend/src/pages/Landing.tsx` · `frontend/src/components/EarningsCalculator.tsx` · `frontend/src/components/Hero.tsx` · `frontend/src/pages/admin/Categorias.tsx` · `frontend/src/pages/admin/Clientes.tsx` · `frontend/src/pages/admin/Transacoes.tsx` · `frontend/src/components/StickyCtaMobile.tsx` · `frontend/src/components/PWAInstallPrompt.tsx` (11 arquivos)

**Descrição:**  
11 arquivos ainda usam a cor de fundo `#1C1F26` do tema antigo, criando inconsistência visual com as telas que foram redesenhadas para `#0a1928`.

**Sugestão:** Fazer busca e substituição controlada de `bg-[#1C1F26]` → `bg-[#0a1928]` (ou o equivalente inline `background: '#0a1928'`) validando visualmente tela a tela.

---

### [P2] Catch vazio em alerta Telegram no admin

**Categoria:** Bug / Qualidade  
**Arquivo(s):** `backend/src/routes/admin.ts` (bloco de `premiar-profissional`)

**Descrição:**  
Notificação Telegram silencia falhas completamente:

```typescript
fetch(`https://api.telegram.org/bot${token}/sendMessage`, { ... })
  .catch(() => {})
```

Se o bot falhar, o admin não sabe que o alerta não foi enviado.

**Sugestão:**
```typescript
.catch(err => console.error('[telegram] alert failed:', err instanceof Error ? err.message : String(err)))
```

---

### [P2] safeReturnTo em CheckoutCancel não usa URL parsing

**Categoria:** Segurança  
**Arquivo(s):** `frontend/src/pages/checkout/CheckoutCancel.tsx:9-16`

**Descrição:**  
A validação atual usa `startsWith`:

```typescript
if (value && ALLOWED_RETURN_PREFIXES.some((p) => value.startsWith(p))) {
  return value;
}
```

`startsWith('/profissional/')` aceita strings como `/profissional/../../../../` que, embora não sejam um risco real no browser (navegam para paths relativos normais), poderiam causar comportamento inesperado se a string chegar de alguma forma com path traversal.

**Sugestão:** Usar `URL` API para normalizar:
```typescript
try {
  const url = new URL(value, window.location.href);
  if (url.origin !== window.location.origin) return defaultDashboard(role);
  const path = url.pathname;
  if (ALLOWED_RETURN_PREFIXES.some((p) => path.startsWith(p))) return path;
} catch {}
return defaultDashboard(role);
```

---

### [P2] `as any` no tipo de subscription do Stripe — eslint-disable-next-line

**Categoria:** Qualidade  
**Arquivo(s):** `backend/src/routes/stripe.ts:619` · `backend/src/routes/stripe.ts:674`

**Descrição:**  
Dois casts para `any` com comentário explicativo e `// eslint-disable-next-line`:

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripeSub = await stripe.subscriptions.retrieve(...) as any;
```

O comentário é válido (Stripe v22 removeu `current_period_end` dos types mas a API ainda retorna), mas dá pra tipar corretamente.

**Sugestão:**
```typescript
interface StripeSubExtended extends Stripe.Subscription {
  current_period_end?: number;
  current_period_start?: number;
}
const stripeSub = await stripe.subscriptions.retrieve(...) as StripeSubExtended;
```

---

### [P2] Valores de reward de indicação hardcoded espalhados em referrals.ts

**Categoria:** Qualidade  
**Arquivo(s):** `backend/src/routes/referrals.ts:217, 231, 234-236` · `backend/src/routes/stripe.ts:132, 159`

**Descrição:**  
Valores como 60, 6, 200 e 20 moedas aparecem hardcoded em múltiplos pontos:

```typescript
// referrals.ts:217
const rewardHint = referrerProfile.role === 'professional' ? '60 moedas' : 'R$2'

// referrals.ts:236
p_amount: 20,  // bônus de cadastro

// stripe.ts:132
let baseCoins = referral.referrer_role === 'professional' ? 60 : 6
```

Se as regras de recompensa mudarem, há risco de atualizar em um lugar e esquecer outro.

**Sugestão:** Centralizar em `backend/src/config.ts`:
```typescript
export const REFERRAL_REWARDS = {
  professional_purchase: 60,
  client_purchase: 6,
  first_order_client_referrer: 200,
  signup_bonus: 20,
} as const;
```

---

### [P2] getConfig() em referrals.ts sem cache — query ao DB a cada request público

**Categoria:** Performance  
**Arquivo(s):** `backend/src/routes/referrals.ts:17-28, 33-38`

**Descrição:**  
`GET /api/referrals/config` é público (sem auth) e chama `getConfig()` que faz uma query ao Supabase em cada request. Páginas de landing e de convite chamam esse endpoint frequentemente.

**Sugestão:** Adicionar cache em memória com TTL de 5 minutos:
```typescript
let _configCache: ConfigResult | null = null;
let _configCacheExpiry = 0;

async function getConfig(): Promise<ConfigResult> {
  if (_configCache && Date.now() < _configCacheExpiry) return _configCache;
  // ... busca no DB ...
  _configCacheExpiry = Date.now() + 5 * 60 * 1000;
  return (_configCache = result);
}
```

---

## Checklist de Verificação Manual Necessária

Estes itens não podem ser auditados só pelo código:

- [ ] **Valores reais dos pacotes no Supabase de produção:** `SELECT id, name, coins, price FROM coin_packages ORDER BY display_order;` — confrontar com `coinPackages.ts`
- [ ] **Preços no Stripe Dashboard:** confirmar se os `price_id` apontados em `STRIPE_PRICE_IDS` (config.ts) cobram os valores corretos
- [ ] **Referrals em produção:** verificar se há registros em `referrals` com `status = 'registered'` mas sem crédito (evidência do bug do P0 acima)
- [ ] **RLS completa:** rodar no Supabase `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` para confirmar que nenhuma tabela tem `rowsecurity = false`

---

*Fim do relatório. Nenhuma alteração de código foi feita.*
