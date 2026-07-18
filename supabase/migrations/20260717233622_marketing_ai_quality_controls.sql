-- Marketing IA quality controls
-- bounded budgets, explainable failures, campaign lifecycle and metrics.
alter table public.social_content_campaigns
  add column if not exists archived_at timestamptz,
  add column if not exists archive_reason text,
  add column if not exists last_error text;

alter table public.social_content_items
  add column if not exists failure_code text,
  add column if not exists failure_details text,
  add column if not exists conversion_metrics jsonb not null default '{}'::jsonb;

create index if not exists social_content_campaigns_lifecycle_idx
  on public.social_content_campaigns (status, city, service, updated_at desc);
create index if not exists social_content_items_campaign_status_idx
  on public.social_content_items (campaign_id, generation_status, status, created_at desc);

revoke all on table public.social_content_campaigns from anon, authenticated;
revoke all on table public.social_content_items from anon, authenticated;
