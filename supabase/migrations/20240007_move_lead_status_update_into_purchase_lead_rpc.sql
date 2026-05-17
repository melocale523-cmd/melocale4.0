-- The frontend was calling supabase.from('leads').update({ status: 'orçando' })
-- after purchase_lead returned, but RLS only allows clients (not professionals)
-- to UPDATE leads — so that call was a silent no-op and the status was never set.
-- This migration moves the status transition into the RPC itself, where
-- SECURITY DEFINER gives it the necessary privileges.
CREATE OR REPLACE FUNCTION public.purchase_lead(p_lead_id uuid, p_idempotency_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_professional_id UUID;
  v_price_coins     INTEGER;
  v_balance         INTEGER;
  v_purchase_id     UUID;
  v_client_id       UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- professionals.id (FK de lead_purchases)
  SELECT id INTO v_professional_id
  FROM professionals
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_professional_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'professional_not_found');
  END IF;

  -- Idempotência
  SELECT id INTO v_purchase_id
  FROM lead_purchases
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_purchase_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'lead_purchase_id', v_purchase_id, 'idempotent', true);
  END IF;

  -- Preço + client_id
  SELECT price_coins, client_id INTO v_price_coins, v_client_id
  FROM leads
  WHERE id = p_lead_id AND status = 'open';

  IF v_price_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_unavailable');
  END IF;

  -- Saldo via auth.uid() (professional_coins.professional_id = profiles.id)
  SELECT balance INTO v_balance
  FROM professional_coins
  WHERE professional_id = v_user_id;

  IF v_balance IS NULL OR v_balance < v_price_coins THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  -- Debita usando auth.uid()
  UPDATE professional_coins
  SET balance     = balance - v_price_coins,
      total_spent = total_spent + v_price_coins,
      updated_at  = now()
  WHERE professional_id = v_user_id;

  -- Insere compra com professionals.id
  INSERT INTO lead_purchases (
    id, lead_id, professional_id, user_id,
    client_id, price_coins, idempotency_key,
    status, created_at
  ) VALUES (
    gen_random_uuid(), p_lead_id, v_professional_id, v_user_id,
    v_client_id, v_price_coins, p_idempotency_key,
    'Pendente Proposta', now()
  )
  RETURNING id INTO v_purchase_id;

  UPDATE leads
  SET purchases_count = purchases_count + 1
  WHERE id = p_lead_id;

  -- Move lead to 'orçando' now that it has at least one active purchase.
  -- SECURITY DEFINER allows this update regardless of RLS on leads.
  UPDATE leads
  SET status = 'orçando'
  WHERE id = p_lead_id AND status = 'open';

  RETURN jsonb_build_object('success', true, 'lead_purchase_id', v_purchase_id);
END;
$$;
