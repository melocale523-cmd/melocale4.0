-- SEO conversion events are written by the trusted backend service only.
-- The frontend sends events to /api/track/seo-conversion, never to this RPC directly.
revoke execute on function public.track_seo_conversion_event(text,text,text,text,text,text,text,text,text,uuid,uuid,integer,numeric,jsonb) from anon, authenticated;
grant execute on function public.track_seo_conversion_event(text,text,text,text,text,text,text,text,text,uuid,uuid,integer,numeric,jsonb) to service_role;