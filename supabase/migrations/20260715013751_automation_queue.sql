create table if not exists public.automation_job_queue (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','running','succeeded','dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  last_error text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists automation_queue_claim_idx on public.automation_job_queue (status, available_at, created_at);
create index if not exists automation_queue_job_idx on public.automation_job_queue (job_name, created_at desc);
alter table public.automation_job_queue enable row level security;
revoke all on public.automation_job_queue from anon, authenticated;

create or replace function public.enqueue_automation_job(p_job_name text, p_payload jsonb default '{}'::jsonb, p_max_attempts integer default 3, p_available_at timestamptz default now())
returns uuid language sql security definer set search_path = public, extensions as $$
  insert into public.automation_job_queue(job_name,payload,max_attempts,available_at)
  values (p_job_name,coalesce(p_payload,'{}'::jsonb),greatest(p_max_attempts,1),coalesce(p_available_at,now()))
  returning id;
$$;

create or replace function public.claim_automation_job(p_worker_id text, p_lease_seconds integer default 900)
returns setof public.automation_job_queue language plpgsql security definer set search_path = public, extensions as $$
declare v_row public.automation_job_queue;
begin
  update public.automation_job_queue set status='queued', locked_at=null, locked_by=null
   where status='running' and locked_at < now() - make_interval(secs => greatest(p_lease_seconds,30));
  select * into v_row from public.automation_job_queue
   where status='queued' and available_at <= now() and attempts < max_attempts
   order by available_at, created_at
   for update skip locked limit 1;
  if v_row.id is null then return; end if;
  update public.automation_job_queue set status='running', attempts=attempts+1, locked_at=now(), locked_by=p_worker_id
   where id=v_row.id returning * into v_row;
  return next v_row;
end;
$$;

create or replace function public.finish_automation_queue_job(p_id uuid, p_success boolean, p_error text default null, p_result jsonb default '{}'::jsonb)
returns public.automation_job_queue language plpgsql security definer set search_path = public, extensions as $$
declare v_row public.automation_job_queue;
begin
  update public.automation_job_queue set
    status = case when p_success then 'succeeded' when attempts >= max_attempts then 'dead_letter' else 'queued' end,
    available_at = case when p_success or attempts >= max_attempts then available_at else now() + make_interval(secs => least(3600, greatest(30, attempts * attempts * 30))) end,
    completed_at = case when p_success or attempts >= max_attempts then now() else null end,
    locked_at=null, locked_by=null, last_error=p_error, result=coalesce(p_result,'{}'::jsonb)
   where id=p_id and status='running' returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.requeue_automation_job(p_id uuid)
returns public.automation_job_queue language sql security definer set search_path = public, extensions as $$
  update public.automation_job_queue set status='queued', attempts=0, available_at=now(), locked_at=null, locked_by=null, completed_at=null, last_error=null
   where id=p_id and status='dead_letter' returning *;
$$;
revoke all on function public.enqueue_automation_job(text,jsonb,integer,timestamptz) from public, anon, authenticated;
revoke all on function public.claim_automation_job(text,integer) from public, anon, authenticated;
revoke all on function public.finish_automation_queue_job(uuid,boolean,text,jsonb) from public, anon, authenticated;
revoke all on function public.requeue_automation_job(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_automation_job(text,jsonb,integer,timestamptz) to service_role;
grant execute on function public.claim_automation_job(text,integer) to service_role;
grant execute on function public.finish_automation_queue_job(uuid,boolean,text,jsonb) to service_role;
grant execute on function public.requeue_automation_job(uuid) to service_role;