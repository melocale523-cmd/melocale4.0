ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_status TEXT DEFAULT 'not_connected';
