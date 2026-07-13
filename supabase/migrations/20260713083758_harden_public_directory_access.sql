-- The search hook only runs for authenticated users. Keep the public SEO
-- endpoint as the anonymous entry point and make this app view obey RLS.
-- Preserve the existing view column order so CREATE OR REPLACE is compatible.
CREATE OR REPLACE VIEW public.professionals_with_rating
WITH (security_invoker = true)
AS
SELECT
  p.id,
  p.user_id,
  p.bio,
  p.category,
  p.city,
  p.is_active,
  p.onboarding_completed,
  p.service_radius,
  p.featured_until,
  p.created_at,
  COALESCE(AVG(r.rating), 0)::numeric(3,2) AS rating_avg,
  COUNT(r.id)::integer AS review_count
FROM public.professionals p
LEFT JOIN public.reviews r ON r.professional_id = p.id
GROUP BY p.id;

REVOKE SELECT ON public.professionals_with_rating FROM anon;
GRANT SELECT ON public.professionals_with_rating TO authenticated;

-- Prevent this SECURITY DEFINER helper from answering role questions about a
-- different user when called directly through the Data API.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND _user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = auth.uid()
        AND role = _role
    );
$function$;
