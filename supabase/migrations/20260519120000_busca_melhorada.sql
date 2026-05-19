-- Add lat/lng to professionals (nullable, for future GPS use)
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision;

-- View with avg rating per professional (used for sorting by rating in search)
CREATE OR REPLACE VIEW public.professionals_with_rating AS
SELECT
  p.*,
  COALESCE(AVG(r.rating), 0)::numeric(3,2) AS rating_avg,
  COUNT(r.id)::integer                      AS review_count
FROM public.professionals p
LEFT JOIN public.reviews r ON r.professional_id = p.id
GROUP BY p.id;

GRANT SELECT ON public.professionals_with_rating TO anon, authenticated;

-- Indexes for search filtering and sorting
CREATE INDEX IF NOT EXISTS idx_professionals_city ON public.professionals(city);
CREATE INDEX IF NOT EXISTS idx_professionals_category ON public.professionals(category);
CREATE INDEX IF NOT EXISTS idx_reviews_professional_id ON public.reviews(professional_id);
