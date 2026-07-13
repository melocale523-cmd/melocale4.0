-- Harden user-scoped views so their queries run with the caller's privileges
-- and RLS policies instead of the view owner's privileges. PostgreSQL 17
-- supports security_invoker views.
ALTER VIEW public.v_conversations SET (security_invoker = true);
ALTER VIEW public.v_client_leads SET (security_invoker = true);
ALTER VIEW public.v_my_purchases SET (security_invoker = true);
ALTER VIEW public.v_wallet_balance SET (security_invoker = true);
ALTER VIEW public.v_available_leads SET (security_invoker = true);
ALTER VIEW public.v_withdrawal_requests SET (security_invoker = true);

-- These tables are written by backend jobs using service_role only. Keep RLS
-- enabled and make that access contract explicit for the security advisor.
CREATE POLICY stripe_audit_runs_service_role_only
  ON public.stripe_audit_runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY stripe_processed_events_service_role_only
  ON public.stripe_processed_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Pin search_path on public functions that are not SECURITY DEFINER but are
-- still reported as mutable by the Supabase security advisor.
ALTER FUNCTION public.find_professionals_by_phone_suffix(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.find_profiles_by_phone_suffix(text)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.normalize_city_text()
  SET search_path = public, pg_temp;
