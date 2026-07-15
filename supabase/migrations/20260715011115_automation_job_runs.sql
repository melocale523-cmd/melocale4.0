create table if not exists public.automation_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  lease_expires_at timestamptz,
  duration_ms integer,
  processed_count integer,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists automation_job_runs_recent_idx on public.automation_job_runs (job_name, started_at desc);
create unique index if not exists automation_job_runs_one_running_idx on public.automation_job_runs (job_name) where status = 'running';

alter table public.automation_job_runs enable row level security;
revoke all on public.automation_job_runs from anon, authenticated;

create or replace function public.start_automation_job(p_job_name text, p_lease_seconds integer default 900)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid;
begin
  update public.automation_job_runs
     set status = 'failed', finished_at = now(), lease_expires_at = null,
         error_message = 'Lease expirado antes da conclusão'
   where job_name = p_job_name and status = 'running' and lease_expires_at < now();

  begin
    insert into public.automation_job_runs (job_name, status, lease_expires_at)
    values (p_job_name, 'running', now() + make_interval(secs => greatest(p_lease_seconds, 30)))
    returning id into v_id;
  exception when unique_violation then
    return null;
  end;
  return v_id;
end;
$$;

create or replace function public.finish_automation_job(
  p_run_id uuid, p_status text, p_processed_count integer default null,
  p_error_message text default null, p_metadata jsonb default '{}'::jsonb
)
returns void language sql security definer set search_path = public, extensions as $$
  update public.automation_job_runs
     set status = p_status,
         finished_at = now(),
         lease_expires_at = null,
         duration_ms = extract(epoch from (now() - started_at))::integer * 1000,
         processed_count = p_processed_count,
         error_message = p_error_message,
         metadata = coalesce(p_metadata, '{}'::jsonb)
   where id = p_run_id and status = 'running';
$$;

revoke all on function public.start_automation_job(text, integer) from public, anon, authenticated;
revoke all on function public.finish_automation_job(uuid, text, integer, text, jsonb) from public, anon, authenticated;
grant execute on function public.start_automation_job(text, integer) to service_role;
grant execute on function public.finish_automation_job(uuid, text, integer, text, jsonb) to service_role;
