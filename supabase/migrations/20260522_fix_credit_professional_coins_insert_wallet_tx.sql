-- Fix: credit_professional_coins agora registra a transação em wallet_transactions.
--
-- Problema anterior: a RPC atualizava professional_coins corretamente mas deixava
-- um comentário dizendo que o backend faria o INSERT — o backend nunca fez.
-- Resultado: saldo correto, histórico completamente vazio.
--
-- Estratégia de idempotência: ON CONFLICT (stripe_event_id) DO NOTHING.
-- O Stripe garante que retries reutilizam o mesmo event.id, portanto uma segunda
-- execução do mesmo webhook não duplica a transação.
--
-- Lookup de wallet_id:
--   p_user_id  →  professionals.id  (WHERE professionals.user_id = p_user_id)
--             →  wallets.id         (WHERE wallets.professional_id = professionals.id)
-- Se o profissional não tiver wallet ainda (edge case), o crédito ocorre normalmente
-- e o INSERT é silenciosamente ignorado (RAISE WARNING para diagnóstico).

CREATE OR REPLACE FUNCTION public.credit_professional_coins(
  p_user_id         uuid,
  p_amount          integer,
  p_stripe_session_id text,
  p_stripe_event_id   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_balance  INTEGER;
  v_new_balance      INTEGER;
  v_professional_id  UUID;
  v_wallet_id        UUID;
BEGIN
  -- 1. Garantir linha em professional_coins
  INSERT INTO public.professional_coins (professional_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (professional_id) DO NOTHING;

  -- 2. Bloquear linha e ler saldo atual
  SELECT balance INTO v_current_balance
  FROM public.professional_coins
  WHERE professional_id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'professional_coins row not found for user %', p_user_id;
  END IF;

  -- 3. Creditar moedas
  UPDATE public.professional_coins
  SET balance      = balance + p_amount,
      total_earned = total_earned + p_amount,
      updated_at   = now()
  WHERE professional_id = p_user_id;

  v_new_balance := v_current_balance + p_amount;

  -- 4. Resolver professional_id (professionals.id) a partir do auth user_id
  SELECT id INTO v_professional_id
  FROM public.professionals
  WHERE user_id = p_user_id
  LIMIT 1;

  -- 5. Resolver wallet_id
  IF v_professional_id IS NOT NULL THEN
    SELECT id INTO v_wallet_id
    FROM public.wallets
    WHERE professional_id = v_professional_id
    LIMIT 1;
  END IF;

  -- 6. Registrar transação — idempotente via stripe_event_id
  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      kind,
      amount,
      balance_after,
      reference,
      stripe_session_id,
      stripe_event_id,
      professional_id,
      user_id,
      created_at
    )
    VALUES (
      v_wallet_id,
      'credit_purchase',
      p_amount,
      v_new_balance,
      'stripe_credit:' || p_stripe_event_id,
      p_stripe_session_id,
      p_stripe_event_id,
      v_professional_id,
      p_user_id,
      now()
    )
    ON CONFLICT (stripe_event_id) DO NOTHING;
  ELSE
    RAISE WARNING 'credit_professional_coins: wallet não encontrada para user_id=%, transação NÃO registrada em wallet_transactions', p_user_id;
  END IF;
END;
$$;
