-- Garantia de primeira compra pro profissional: se o primeiro (e único)
-- lead comprado já tiver sido fechado por outro profissional antes dele
-- conseguir resposta, ele pode solicitar devolução das moedas gastas.
-- Elegibilidade real é verificada no backend (nunca confiar só no
-- frontend) — esta tabela só registra a solicitação e seu status.

CREATE TABLE professional_guarantee_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references profiles(id),
  lead_purchase_id uuid not null references lead_purchases(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  coins_amount integer not null,
  admin_note text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz
);

-- professional_id guarda o auth user_id (profiles.id) — mesmo padrão já
-- usado em professional_coins.professional_id, não o professionals.id
-- interno (que é o que lead_purchases.professional_id usa). Confirmado
-- via introspecção do schema antes de escrever isto.
ALTER TABLE professional_guarantee_requests ENABLE ROW LEVEL SECURITY;

-- Mesma lição aprendida nesta sessão (system_health_checks,
-- whatsapp_conversations): policy explícita pro service_role, não confiar
-- só no bypassrls do catálogo.
CREATE POLICY "professional_guarantee_requests_service_role_full_access"
ON professional_guarantee_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "professional_guarantee_requests_own_select"
ON professional_guarantee_requests FOR SELECT TO authenticated
USING (professional_id = auth.uid());

CREATE POLICY "professional_guarantee_requests_admin_all"
ON professional_guarantee_requests FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::text))
WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- Crédito de moedas por garantia — separado de credit_professional_coins
-- (que é específico de compra via Stripe: exige stripe_session_id e
-- stripe_event_id, e registra kind='credit_purchase', o que seria
-- enganoso pra um estorno de garantia). Segue o mesmo estilo de
-- credit_client_coins: idempotente via reference, kind próprio.
CREATE OR REPLACE FUNCTION credit_professional_guarantee(
  p_user_id uuid,
  p_amount integer,
  p_reference text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance integer;
  v_new_balance integer;
  v_professional_id uuid;
  v_wallet_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE reference = p_reference) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_credited');
  END IF;

  INSERT INTO professional_coins (professional_id, balance, total_earned, total_spent)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (professional_id) DO NOTHING;

  SELECT balance INTO v_current_balance FROM professional_coins WHERE professional_id = p_user_id FOR UPDATE;
  IF v_current_balance IS NULL THEN
    RAISE EXCEPTION 'professional_coins row not found for user %', p_user_id;
  END IF;

  UPDATE professional_coins
  SET balance = balance + p_amount, total_earned = total_earned + p_amount, updated_at = now()
  WHERE professional_id = p_user_id;

  v_new_balance := v_current_balance + p_amount;

  SELECT id INTO v_professional_id FROM professionals WHERE user_id = p_user_id LIMIT 1;
  IF v_professional_id IS NOT NULL THEN
    SELECT id INTO v_wallet_id FROM wallets WHERE professional_id = v_professional_id LIMIT 1;
  END IF;

  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO wallet_transactions (wallet_id, kind, amount, balance_after, reference, professional_id, user_id, created_at)
    VALUES (v_wallet_id, 'guarantee_refund', p_amount, v_new_balance, p_reference, v_professional_id, p_user_id, now());
  END IF;

  RETURN jsonb_build_object('success', true, 'balance_after', v_new_balance);
END;
$function$;

REVOKE EXECUTE ON FUNCTION credit_professional_guarantee(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_professional_guarantee(uuid, integer, text) TO service_role;
