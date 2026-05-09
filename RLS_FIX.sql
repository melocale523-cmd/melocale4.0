-- Exporte este arquivo e rode no SQL Editor do seu projeto Supabase --

-- 1. Criação das tabelas base caso não existam (com estruturas seguras e simplificadas)
CREATE TABLE IF NOT EXISTS public.lead_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Aberto'::text,
    price NUMERIC,
    coins_price INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_id UUID,
    amount INTEGER NOT NULL,
    type TEXT,
    stripe_session_id TEXT UNIQUE,
    stripe_event_id TEXT UNIQUE,
    balance_after INTEGER,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.coin_packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    coins INTEGER NOT NULL,
    price_brl NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0
);

-- 2. Ativar RLS nas tabelas Problemáticas
ALTER TABLE public.lead_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_packages ENABLE ROW LEVEL SECURITY;

-- 3. Criar Políticas de Teste (Allow All) para LEITURA (SELECT) para evitar erro 400 em queries de select
-- Em produção, refine essas políticas posteriormente. A prioridade agora é desbloquear o Frontend.

-- lead_purchases
DROP POLICY IF EXISTS "allow all select lead_purchases" ON public.lead_purchases;
CREATE POLICY "allow all select lead_purchases" 
ON public.lead_purchases 
FOR SELECT 
USING (true);

-- wallet_transactions
DROP POLICY IF EXISTS "allow all select wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "allow all select wallet_transactions" 
ON public.wallet_transactions 
FOR SELECT 
USING (true);

-- coin_packages
DROP POLICY IF EXISTS "allow all select coin_packages" ON public.coin_packages;
CREATE POLICY "allow all select coin_packages" 
ON public.coin_packages 
FOR SELECT 
USING (true);
