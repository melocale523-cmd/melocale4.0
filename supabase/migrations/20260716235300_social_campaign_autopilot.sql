-- Marketing IA autopilot: a campanha permanece pausada por padrÃ£o.
create table if not exists public.social_content_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 3 and 120),
  city text not null check (char_length(city) between 2 and 100),
  service text,
  audience text not null check (audience in ('client', 'professional', 'mixed')),
  objective text not null check (objective in ('reach', 'client_leads', 'professional_signup', 'trust', 'education')),
  posts_per_week integer not null default 3 check (posts_per_week between 1 and 7),
  status text not null default 'paused' check (status in ('active', 'paused', 'archived')),
  auto_generate boolean not null default false,
  research_enabled boolean not null default false,
  weekly_generation_limit integer not null default 3 check (weekly_generation_limit between 1 and 7),
  plan jsonb not null default '[]'::jsonb,
  plan_model text,
  plan_usage jsonb not null default '{}'::jsonb,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  last_planned_at timestamptz,
  last_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_content_items
  add column if not exists campaign_id uuid references public.social_content_campaigns(id) on delete set null,
  add column if not exists planned_for timestamptz,
  add column if not exists content_pillar text,
  add column if not exists quality_score smallint check (quality_score between 0 and 100),
  add column if not exists instagram_container_id text,
  add column if not exists instagram_media_id text,
  add column if not exists publication_error text,
  add column if not exists published_by uuid references public.profiles(id) on delete set null;

create index if not exists social_content_campaigns_status_idx
  on public.social_content_campaigns (status, auto_generate, updated_at desc);
create index if not exists social_content_items_campaign_plan_idx
  on public.social_content_items (campaign_id, planned_for, generation_status);

alter table public.social_content_campaigns enable row level security;
revoke all on table public.social_content_campaigns from anon, authenticated;