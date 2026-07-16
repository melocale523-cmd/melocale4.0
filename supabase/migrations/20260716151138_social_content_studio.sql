-- Marketing IA: rascunhos, aprovações e ativos gerados.
-- Todo acesso do produto acontece pelo backend autenticado com service_role;
-- não expor rascunhos, prompts, custos ou imagens por meio da Data API.
create table if not exists public.social_content_items (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  objective text not null check (objective in ('reach', 'client_leads', 'professional_signup', 'trust', 'education')),
  audience text not null check (audience in ('client', 'professional', 'mixed')),
  city text,
  service text,
  format text not null check (format in ('reel', 'carousel', 'story', 'feed', 'article')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'published')),
  generation_status text not null default 'pending' check (generation_status in ('pending', 'generating', 'ready', 'failed')),
  brief jsonb not null default '{}'::jsonb,
  content jsonb not null default '{}'::jsonb,
  research_sources jsonb not null default '[]'::jsonb,
  visual_prompt text,
  image_storage_path text,
  strategy_model text,
  visual_model text,
  strategy_usage jsonb not null default '{}'::jsonb,
  visual_usage jsonb not null default '{}'::jsonb,
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  safety_notes jsonb not null default '[]'::jsonb,
  rejection_note text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_content_items_status_created_idx
  on public.social_content_items (status, created_at desc);
create index if not exists social_content_items_city_service_idx
  on public.social_content_items (city, service, created_at desc);

alter table public.social_content_items enable row level security;
revoke all on table public.social_content_items from anon, authenticated;

-- Bucket privado: o backend gera URLs assinadas curtas apenas para administradores.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'social-content',
  'social-content',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;