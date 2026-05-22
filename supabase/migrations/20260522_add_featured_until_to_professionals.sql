ALTER TABLE public.professionals
ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_professionals_featured_until
ON public.professionals(featured_until)
WHERE featured_until IS NOT NULL;
