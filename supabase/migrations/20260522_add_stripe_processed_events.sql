-- Tabela de idempotência para eventos Stripe que não têm outro mecanismo
-- (ex: featured_spotlight que não insere em wallet_transactions).
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id   TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas service_role (backend) pode inserir/consultar; nenhum usuário acessa diretamente.
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- Sem políticas RLS → bloqueia acesso de anon/authenticated; service_role bypassa RLS.
