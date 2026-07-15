create index if not exists idx_seo_conversion_events_lead_purchase_id on public.seo_conversion_events(lead_purchase_id) where lead_purchase_id is not null;
