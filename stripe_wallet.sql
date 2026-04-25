-- Exporte este arquivo e rode no SQL Editor do seu projeto Supabase --

-- 1. Cria a tabela de log ledger (wallet_transactions)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    stripe_session_id TEXT UNIQUE NOT NULL,
    stripe_event_id TEXT UNIQUE NOT NULL,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Professionals can view their own transactions"
ON public.wallet_transactions FOR SELECT
USING (auth.uid() = professional_id);

-- 2. Cria a função segura credit_wallet
CREATE OR REPLACE FUNCTION public.credit_wallet(
    p_user_id UUID,
    p_amount INTEGER,
    p_stripe_session_id TEXT,
    p_stripe_event_id TEXT
) RETURNS void AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Configuração local para identificar essa operação internamente
    SET LOCAL app.wallet_update_allowed = 'true';

    -- Garante que o usuário possua uma carteira
    INSERT INTO public.professional_coins (professional_id, balance, total_earned, total_spent)
    VALUES (p_user_id, 0, 0, 0)
    ON CONFLICT (id) DO NOTHING; -- O ideal é que professional_id seja UNIQUE, mas ajustaremos via SELECT

    -- Bloqueia a linha para evitar condição de corrida (Race Condition)
    SELECT balance INTO v_current_balance
    FROM public.professional_coins
    WHERE professional_id = p_user_id
    FOR UPDATE;

    -- Se não encontrar por algum motivo, inicializa explícitamente e recupera a linha travada
    IF v_current_balance IS NULL THEN
        -- Insert real
        INSERT INTO public.professional_coins (id, professional_id, balance, total_earned, total_spent)
        -- Usando id aleatório
        VALUES (gen_random_uuid(), p_user_id, 0, 0, 0);
        
        v_current_balance := 0;
    END IF;

    v_new_balance := v_current_balance + p_amount;

    -- Atualiza no banco de moedas
    UPDATE public.professional_coins
    SET 
        balance = v_new_balance,
        total_earned = total_earned + p_amount,
        updated_at = timezone('utc'::text, now())
    WHERE professional_id = p_user_id;

    -- Registra na wallet_transactions (este insert já garante idempotência pelos campos UNIQUE)
    INSERT INTO public.wallet_transactions (
        professional_id,
        amount,
        stripe_session_id,
        stripe_event_id,
        balance_after
    ) VALUES (
        p_user_id,
        p_amount,
        p_stripe_session_id,
        p_stripe_event_id,
        v_new_balance
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Apenas Service Role (backend autenticado) pode chamar essa função (nunca o Frontend/Usuário)
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.credit_wallet FROM anon;
GRANT EXECUTE ON FUNCTION public.credit_wallet TO service_role;
