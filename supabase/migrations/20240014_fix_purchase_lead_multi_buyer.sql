-- O RPC purchase_lead verificava status = 'open' exclusivamente.
-- Após a primeira compra o status transita para 'orçando', bloqueando
-- todas as compras subsequentes mesmo com max_purchases = 5.
-- A view v_leads_available também filtrava apenas 'open' e 'available',
-- ocultando leads 'orçando' ainda com vagas disponíveis.

-- 1. Atualiza a view base para incluir leads 'orçando' com vagas restantes.
CREATE OR REPLACE VIEW public.v_leads_available AS
SELECT id,
       client_id,
       category_id,
       title,
       description,
       city,
       state,
       event_date,
       budget_min,
       budget_max,
       price_coins,
       max_purchases,
       purchases_count,
       status,
       expires_at,
       metadata,
       created_at,
       updated_at,
       category,
       location,
       images
FROM leads l
WHERE status IN ('open', 'available', 'orçando')
  AND purchases_count < max_purchases
  AND NOT EXISTS (
    SELECT 1
    FROM lead_purchases lp
    JOIN professionals p ON p.id = lp.professional_id
    WHERE lp.lead_id = l.id
      AND p.user_id = auth.uid()
  );

-- 2. Recria o RPC purchase_lead aceitando leads com status 'open' ou 'orçando'.
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
  v_purchases_count INTEGER;
  v_max_purchases   INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT id INTO v_professional_id
  FROM professionals
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_professional_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'professional_not_found');
  END IF;

  -- Idempotência: retorna resultado anterior se chave já foi usada
  SELECT id INTO v_purchase_id
  FROM lead_purchases
  WHERE idempotency_key = p_idempotency_key
  LIMIT 1;

  IF v_purchase_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'lead_purchase_id', v_purchase_id, 'idempotent', true);
  END IF;

  -- Verifica disponibilidade: aceita 'open' ou 'orçando', desde que haja vagas
  SELECT price_coins, client_id, purchases_count, max_purchases
  INTO v_price_coins, v_client_id, v_purchases_count, v_max_purchases
  FROM leads
  WHERE id = p_lead_id
    AND status IN ('open', 'orçando')
    AND purchases_count < max_purchases;

  IF v_price_coins IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'lead_unavailable');
  END IF;

  -- Garante que este profissional ainda não comprou este lead
  IF EXISTS (
    SELECT 1 FROM lead_purchases
    WHERE lead_id = p_lead_id AND professional_id = v_professional_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_purchased');
  END IF;

  SELECT balance INTO v_balance
  FROM professional_coins
  WHERE professional_id = v_user_id;

  IF v_balance IS NULL OR v_balance < v_price_coins THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;

  UPDATE professional_coins
  SET balance     = balance - v_price_coins,
      total_spent = total_spent + v_price_coins,
      updated_at  = now()
  WHERE professional_id = v_user_id;

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

  -- Incrementa contador e transita status:
  -- 'open' → 'orçando' na primeira compra
  -- 'orçando' permanece 'orçando' nas compras seguintes
  UPDATE leads
  SET purchases_count = purchases_count + 1,
      status = CASE WHEN status = 'open' THEN 'orçando' ELSE status END
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('success', true, 'lead_purchase_id', v_purchase_id);
END;
$$;
