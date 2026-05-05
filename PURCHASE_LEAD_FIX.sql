-- ============================================================
-- MELOCALE — CORREÇÃO DEFINITIVA: purchase_lead RPC
-- Erro corrigido: "Could not choose the best candidate function
--                  between: public.purchase_lead(...)"
--
-- EXECUTE NO SQL EDITOR DO SUPABASE (uma única vez)
-- ============================================================


-- ── PARTE 1: Garantir colunas necessárias ───────────────────
-- Preço em moedas por lead (padrão conservador de 10 moedas).
-- Se a coluna já existe, a instrução é ignorada silenciosamente.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS price_coins INTEGER NOT NULL DEFAULT 10;

-- Chave de idempotência em lead_purchases:
-- garante que chamadas concorrentes ou retries não criem compras duplicadas.
ALTER TABLE public.lead_purchases
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_purchases_idempotency_key
  ON public.lead_purchases (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Coluna de status com default correto para a UI (Compras.tsx usa 'Pendente Proposta')
ALTER TABLE public.lead_purchases
  ALTER COLUMN status SET DEFAULT 'Pendente Proposta';


-- ── PARTE 2: Remover TODAS as sobrecargas existentes ─────────
-- A ambiguidade ocorre quando há múltiplas funções com o mesmo nome
-- mas assinaturas diferentes. Este bloco as remove todas de forma
-- segura, independentemente de quantas existam.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT oid::regprocedure AS sig
      FROM pg_proc
     WHERE proname = 'purchase_lead'
       AND pronamespace = (
             SELECT oid FROM pg_namespace WHERE nspname = 'public'
           )
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || r.sig || ' CASCADE';
    RAISE NOTICE 'Dropped: %', r.sig;
  END LOOP;
END;
$$;


-- ── PARTE 3: Recriar com assinatura canônica ─────────────────
-- Assinatura idêntica ao que dbServices.ts envia:
--   supabase.rpc('purchase_lead', { p_lead_id: uuid, p_idempotency_key: text })

CREATE FUNCTION public.purchase_lead(
  p_lead_id         UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_price_coins     INTEGER;
  v_current_balance INTEGER;
  v_new_balance     INTEGER;
  v_purchase_id     UUID;
BEGIN

  -- ── 1. Autenticação ────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING HINT = 'User must be logged in to purchase a lead';
  END IF;

  -- ── 2. Idempotência por chave ──────────────────────────────
  -- Se a mesma p_idempotency_key já foi processada, retorna o
  -- resultado anterior sem realizar nenhuma operação financeira.
  SELECT id INTO v_purchase_id
    FROM public.lead_purchases
   WHERE idempotency_key = p_idempotency_key
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchase_id', v_purchase_id,
      'status',      'already_purchased'
    );
  END IF;

  -- ── 3. Idempotência por par (user, lead) ───────────────────
  -- Impede que o mesmo profissional compre o mesmo lead duas vezes.
  SELECT id INTO v_purchase_id
    FROM public.lead_purchases
   WHERE user_id = v_user_id
     AND lead_id = p_lead_id
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchase_id', v_purchase_id,
      'status',      'already_purchased'
    );
  END IF;

  -- ── 4. Preço do lead ───────────────────────────────────────
  SELECT COALESCE(price_coins, 10)
    INTO v_price_coins
    FROM public.leads
   WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_found'
      USING HINT = 'Lead does not exist or has already been removed';
  END IF;

  -- ── 5. Verificar e bloquear saldo (FOR UPDATE = sem race condition) ──
  SELECT balance
    INTO v_current_balance
    FROM public.professional_coins
   WHERE professional_id = v_user_id
   FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found'
      USING HINT = 'Recarregue sua carteira antes de comprar leads';
  END IF;

  IF v_current_balance < v_price_coins THEN
    RAISE EXCEPTION 'insufficient_balance'
      USING HINT = 'Saldo insuficiente — recarregue sua carteira';
  END IF;

  -- ── 6. Debitar moedas ─────────────────────────────────────
  v_new_balance := v_current_balance - v_price_coins;

  UPDATE public.professional_coins
     SET balance     = v_new_balance,
         total_spent = total_spent + v_price_coins,
         updated_at  = now()
   WHERE professional_id = v_user_id;

  -- ── 7. Registrar compra ───────────────────────────────────
  INSERT INTO public.lead_purchases (
    user_id,
    professional_id,
    lead_id,
    status,
    coins_price,
    idempotency_key
  ) VALUES (
    v_user_id,
    v_user_id,
    p_lead_id,
    'Pendente Proposta',
    v_price_coins,
    p_idempotency_key
  )
  RETURNING id INTO v_purchase_id;

  -- ── 8. Log da transação ───────────────────────────────────
  INSERT INTO public.wallet_transactions (
    professional_id,
    user_id,
    amount,
    type,
    description,
    balance_after
  ) VALUES (
    v_user_id,
    v_user_id,
    -v_price_coins,
    'lead_purchase',
    'Compra de lead #' || substr(p_lead_id::text, 1, 8),
    v_new_balance
  );

  -- ── 9. Retornar resultado ─────────────────────────────────
  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'status',      'purchased'
  );

END;
$$;


-- ── PARTE 4: Permissões ──────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.purchase_lead(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purchase_lead(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.purchase_lead(UUID, TEXT) TO authenticated;


-- ── PARTE 5: Validação ───────────────────────────────────────
-- Deve retornar EXATAMENTE UMA linha com args = "p_lead_id uuid, p_idempotency_key text"
SELECT
  proname                                    AS function_name,
  pg_get_function_arguments(oid)             AS signature,
  prosecdef                                  AS security_definer
FROM pg_proc
WHERE proname = 'purchase_lead'
  AND pronamespace = 'public'::regnamespace;
