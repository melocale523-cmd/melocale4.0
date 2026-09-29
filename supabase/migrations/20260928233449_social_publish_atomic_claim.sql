-- An approved image must be reserved before any external Instagram request.
-- A crash leaves it in publishing for manual reconciliation; no automatic retry.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
begin
  if to_regclass('public.social_content_items') is null then
    raise exception 'Milocale social_content_items missing';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'social_content_items' and column_name = 'scheduled_for') then
    raise exception 'Milocale scheduled_for missing';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.social_content_items'::regclass and conname = 'social_content_items_status_check') then
    raise exception 'Milocale status constraint missing';
  end if;
end $$;

alter table public.social_content_items
  drop constraint if exists social_content_items_status_check;
alter table public.social_content_items
  add constraint social_content_items_status_check
  check (status in ('draft', 'approved', 'rejected', 'publishing', 'published'));
alter table public.social_content_items
  add column if not exists publishing_started_at timestamptz;
create index if not exists social_content_due_publish_idx
  on public.social_content_items (scheduled_for, created_at)
  where status = 'approved' and generation_status = 'ready';

commit;
