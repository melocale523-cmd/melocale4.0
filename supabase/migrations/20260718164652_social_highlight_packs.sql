-- MeloCal?: Brand Kit e pacotes de Destaques do Instagram.
create table if not exists public.social_highlight_packs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null check (char_length(name) between 2 and 80),
  category text not null check (category in ('start', 'clients', 'professionals', 'services', 'safety', 'brand')),
  description text not null default '',
  cover_color text not null default '#0B3D91',
  cover_logo_url text,
  stories jsonb not null default '[]'::jsonb,
  status text not null default 'ready' check (status in ('draft', 'ready', 'published', 'archived')),
  instagram_story_ids jsonb not null default '[]'::jsonb,
  last_published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_highlight_packs_status_idx
  on public.social_highlight_packs (status, updated_at desc);

alter table public.social_highlight_packs enable row level security;
revoke all on table public.social_highlight_packs from anon, authenticated;
