drop policy if exists U&"professionals: leitura pr\00F3pria" on public.professionals;
drop policy if exists U&"profiles: leitura pr\00F3pria" on public.profiles;
drop policy if exists lead_purchases_select_own on public.lead_purchases;
drop policy if exists "professional sees own lead_purchases" on public.lead_purchases;

drop policy if exists referral_config_select_admin_all on public.referral_config;

create policy referral_config_insert_admin
on public.referral_config
for insert to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

create policy referral_config_update_admin
on public.referral_config
for update to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);

create policy referral_config_delete_admin
on public.referral_config
for delete to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = (select auth.uid()) and profiles.role = 'admin'
  )
);