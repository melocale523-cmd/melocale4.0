-- Marketing IA orchestration: calendário, orçamento, deduplicação e multicanal.
alter table public.social_content_campaigns
  add column if not exists budget_cents integer not null default 0,
  add column if not exists spent_cents integer not null default 0,
  add column if not exists auto_generate_images boolean not null default true,
  add column if not exists evergreen_enabled boolean not null default true,
  add column if not exists seasonal_enabled boolean not null default true,
  add column if not exists multichannel_enabled boolean not null default true,
  add column if not exists trend_radar_enabled boolean not null default false,
  add column if not exists last_autopilot_at timestamptz;

alter table public.social_content_items
  add column if not exists scheduled_for timestamptz,
  add column if not exists duplicate_key text,
  add column if not exists generated_by_autopilot boolean not null default false,
  add column if not exists channels jsonb not null default '{}'::jsonb,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists performance jsonb not null default '{}'::jsonb,
  add column if not exists automation_note text;

create index if not exists social_content_items_schedule_idx
  on public.social_content_items (status, generation_status, scheduled_for);
create index if not exists social_content_items_duplicate_idx
  on public.social_content_items (duplicate_key, created_at desc);
create index if not exists social_content_items_autopilot_idx
  on public.social_content_items (campaign_id, generated_by_autopilot, scheduled_for);

-- Os dados continuam privados: somente o backend com service_role acessa estas tabelas.
revoke all on table public.social_content_items from anon, authenticated;
revoke all on table public.social_content_campaigns from anon, authenticated;