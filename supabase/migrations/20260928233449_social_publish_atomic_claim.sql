-- An approved image must be reserved before any external Instagram request.
-- A crash leaves it in publishing for manual reconciliation; no automatic retry.
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
