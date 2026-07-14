-- Track organic SEO traffic through the money funnel.
-- Direct table access stays closed; authenticated users can insert only their own
-- events through track_seo_conversion_event(), and admins read aggregates through
-- admin_get_seo_conversion_dashboard().

CREATE TABLE IF NOT EXISTS public.seo_conversion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL CHECK (event_type IN ('page_view', 'signup', 'lead_created', 'lead_purchased')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  role text CHECK (role IN ('client', 'professional', 'admin')),
  landing_path text,
  service_slug text,
  service_category text,
  service_city text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  lead_purchase_id uuid REFERENCES public.lead_purchases(id) ON DELETE SET NULL,
  price_coins integer,
  revenue_brl numeric(12,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_created_at
  ON public.seo_conversion_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_event_type_created_at
  ON public.seo_conversion_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_landing_path
  ON public.seo_conversion_events(landing_path);
CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_service_category_city
  ON public.seo_conversion_events(service_category, service_city);
CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_user_id
  ON public.seo_conversion_events(user_id);
CREATE INDEX IF NOT EXISTS idx_seo_conversion_events_lead_id
  ON public.seo_conversion_events(lead_id);

ALTER TABLE public.seo_conversion_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.seo_conversion_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.track_seo_conversion_event(
  p_event_type text,
  p_landing_path text DEFAULT NULL,
  p_service_slug text DEFAULT NULL,
  p_service_category text DEFAULT NULL,
  p_service_city text DEFAULT NULL,
  p_utm_source text DEFAULT NULL,
  p_utm_medium text DEFAULT NULL,
  p_utm_campaign text DEFAULT NULL,
  p_utm_content text DEFAULT NULL,
  p_lead_id uuid DEFAULT NULL,
  p_lead_purchase_id uuid DEFAULT NULL,
  p_price_coins integer DEFAULT NULL,
  p_revenue_brl numeric DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_role text;
  v_event_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_event_type NOT IN ('page_view', 'signup', 'lead_created', 'lead_purchased') THEN
    RAISE EXCEPTION 'Evento invalido';
  END IF;

  SELECT pr.role INTO v_role
  FROM public.profiles pr
  WHERE pr.id = v_user_id;

  INSERT INTO public.seo_conversion_events (
    event_type, user_id, role, landing_path, service_slug, service_category,
    service_city, utm_source, utm_medium, utm_campaign, utm_content,
    lead_id, lead_purchase_id, price_coins, revenue_brl, metadata
  ) VALUES (
    p_event_type, v_user_id, v_role, NULLIF(p_landing_path, ''), NULLIF(p_service_slug, ''),
    NULLIF(p_service_category, ''), NULLIF(p_service_city, ''), NULLIF(p_utm_source, ''),
    NULLIF(p_utm_medium, ''), NULLIF(p_utm_campaign, ''), NULLIF(p_utm_content, ''),
    p_lead_id, p_lead_purchase_id, p_price_coins, p_revenue_brl, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.track_seo_conversion_event(text, text, text, text, text, text, text, text, text, uuid, uuid, integer, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_seo_conversion_event(text, text, text, text, text, text, text, text, text, uuid, uuid, integer, numeric, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_seo_conversion_dashboard(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_since timestamptz := now() - make_interval(days => GREATEST(1, LEAST(COALESCE(p_days, 30), 365)));
  v_result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  WITH filtered AS (
    SELECT *
    FROM public.seo_conversion_events
    WHERE created_at >= v_since
  ), page_stats AS (
    SELECT
      COALESCE(landing_path, '(sem pagina)') AS landing_path,
      max(service_slug) FILTER (WHERE service_slug IS NOT NULL) AS service_slug,
      max(service_category) FILTER (WHERE service_category IS NOT NULL) AS service_category,
      max(service_city) FILTER (WHERE service_city IS NOT NULL) AS service_city,
      count(*) FILTER (WHERE event_type = 'page_view') AS visits,
      count(*) FILTER (WHERE event_type = 'signup') AS signups,
      count(*) FILTER (WHERE event_type = 'signup' AND role = 'client') AS client_signups,
      count(*) FILTER (WHERE event_type = 'signup' AND role = 'professional') AS professional_signups,
      count(*) FILTER (WHERE event_type = 'lead_created') AS leads_created,
      count(*) FILTER (WHERE event_type = 'lead_purchased') AS leads_purchased,
      COALESCE(sum(price_coins) FILTER (WHERE event_type = 'lead_purchased'), 0) AS coins_spent,
      COALESCE(sum(revenue_brl) FILTER (WHERE event_type = 'lead_purchased'), 0) AS revenue_brl
    FROM filtered
    GROUP BY COALESCE(landing_path, '(sem pagina)')
  ), service_stats AS (
    SELECT
      COALESCE(service_category, '(sem categoria)') AS service_category,
      COALESCE(service_city, '(sem cidade)') AS service_city,
      count(*) FILTER (WHERE event_type = 'page_view') AS visits,
      count(*) FILTER (WHERE event_type = 'signup') AS signups,
      count(*) FILTER (WHERE event_type = 'lead_created') AS leads_created,
      count(*) FILTER (WHERE event_type = 'lead_purchased') AS leads_purchased,
      COALESCE(sum(price_coins) FILTER (WHERE event_type = 'lead_purchased'), 0) AS coins_spent,
      COALESCE(sum(revenue_brl) FILTER (WHERE event_type = 'lead_purchased'), 0) AS revenue_brl
    FROM filtered
    GROUP BY COALESCE(service_category, '(sem categoria)'), COALESCE(service_city, '(sem cidade)')
  ), totals AS (
    SELECT
      count(*) FILTER (WHERE event_type = 'page_view') AS visits,
      count(*) FILTER (WHERE event_type = 'signup') AS signups,
      count(*) FILTER (WHERE event_type = 'signup' AND role = 'client') AS client_signups,
      count(*) FILTER (WHERE event_type = 'signup' AND role = 'professional') AS professional_signups,
      count(*) FILTER (WHERE event_type = 'lead_created') AS leads_created,
      count(*) FILTER (WHERE event_type = 'lead_purchased') AS leads_purchased,
      COALESCE(sum(price_coins) FILTER (WHERE event_type = 'lead_purchased'), 0) AS coins_spent,
      COALESCE(sum(revenue_brl) FILTER (WHERE event_type = 'lead_purchased'), 0) AS revenue_brl
    FROM filtered
  )
  SELECT jsonb_build_object(
    'since', v_since,
    'totals', COALESCE((SELECT to_jsonb(totals) FROM totals), '{}'::jsonb),
    'pages', COALESCE((
      SELECT jsonb_agg(to_jsonb(page_stats) ORDER BY visits DESC, leads_created DESC, signups DESC)
      FROM page_stats
    ), '[]'::jsonb),
    'services', COALESCE((
      SELECT jsonb_agg(to_jsonb(service_stats) ORDER BY leads_created DESC, leads_purchased DESC, visits DESC)
      FROM service_stats
    ), '[]'::jsonb),
    'gargalos', jsonb_build_object(
      'visits_without_signup', GREATEST(0, COALESCE((SELECT visits - signups FROM totals), 0)),
      'signups_without_lead', GREATEST(0, COALESCE((SELECT signups - leads_created FROM totals), 0)),
      'leads_without_purchase', GREATEST(0, COALESCE((SELECT leads_created - leads_purchased FROM totals), 0))
    )
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_get_seo_conversion_dashboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_seo_conversion_dashboard(integer) TO authenticated;


