-- O RPC credit_wallet (definido originalmente em stripe_wallet.sql) inseria em
-- wallet_transactions usando as colunas do schema antigo (professional_id, balance_after),
-- sem user_id, kind nem reference. O webhook do backend (server.ts) também inseria o
-- mesmo evento usando o schema novo (user_id, kind, reference). O resultado era:
--   1. RPC insere com professional_id (invisível ao frontend que filtra por user_id)
--   2. Backend tenta inserir com user_id → unique conflict em stripe_session_id → 23505
--   3. 23505 é capturado e tratado como sucesso
--   4. Histórico de transações do usuário fica vazio
--
-- Correção: o RPC fica responsável apenas por creditar professional_coins (com lock).
-- O webhook do backend é a única fonte de inserção em wallet_transactions, usando o
-- schema correto. O catch de 23505 no backend passa a ser proteção pura contra
-- reentrada de webhook Stripe.
CREATE OR REPLACE FUNCTION public.credit_wallet(
    p_user_id         UUID,
    p_amount          INTEGER,
    p_stripe_session_id TEXT,
    p_stripe_event_id   TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
BEGIN
    -- Garante que o usuário possua uma linha em professional_coins
    INSERT INTO public.professional_coins (professional_id, balance, total_earned, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    ON CONFLICT (professional_id) DO NOTHING;

    -- Bloqueia a linha para evitar race condition em créditos simultâneos
    SELECT balance INTO v_current_balance
    FROM public.professional_coins
    WHERE professional_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'professional_coins row not found for user %', p_user_id;
    END IF;

    UPDATE public.professional_coins
    SET balance      = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at   = now()
    WHERE professional_id = p_user_id;

    -- wallet_transactions é inserida exclusivamente pelo webhook do backend (server.ts),
    -- que usa o schema correto: user_id, kind, reference, stripe_session_id, stripe_event_id.
    -- Não inserimos aqui para evitar conflito de schema e duplicidade.
END;
$$;

-- Mantém as permissões originais: apenas service_role pode executar
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, INTEGER, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet(UUID, INTEGER, TEXT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.credit_wallet(UUID, INTEGER, TEXT, TEXT) TO service_role;
