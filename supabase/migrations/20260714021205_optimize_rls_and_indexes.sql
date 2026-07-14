-- Performance hardening based on Supabase database advisor findings.
-- This migration preserves authorization predicates while removing proven redundancy.

CREATE INDEX IF NOT EXISTS idx_professional_guarantee_requests_lead_purchase_id
  ON public.professional_guarantee_requests (lead_purchase_id);
CREATE INDEX IF NOT EXISTS idx_professional_guarantee_requests_professional_id
  ON public.professional_guarantee_requests (professional_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_processed_by
  ON public.withdrawal_requests (processed_by);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
  ON public.withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_wizard_funnel_events_client_id
  ON public.wizard_funnel_events (client_id);

-- Keep the more frequently used leads(client_id) index and the canonical
-- professional_coins unique constraint; remove only exact duplicates.
DROP INDEX IF EXISTS public.idx_leads_client;
ALTER TABLE public.professional_coins
  DROP CONSTRAINT IF EXISTS unique_professional;

-- Make auth/current-setting calls init-plan eligible. ALTER POLICY retains
-- each policy's command, roles and authorization logic.
DO $migration$
DECLARE
  policy_row record;
  optimized_using text;
  optimized_check text;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') LIKE '%auth.uid()%'
        OR coalesce(with_check, '') LIKE '%auth.uid()%'
        OR coalesce(qual, '') LIKE '%current_setting(''role''::text, true)%'
        OR coalesce(with_check, '') LIKE '%current_setting(''role''::text, true)%'
      )
  LOOP
    optimized_using := policy_row.qual;
    optimized_check := policy_row.with_check;

    IF optimized_using IS NOT NULL THEN
      optimized_using := replace(optimized_using, '( SELECT auth.uid() AS uid)', '__AUTH_UID_INITPLAN__');
      optimized_using := replace(optimized_using, 'auth.uid()', '( SELECT auth.uid() AS uid)');
      optimized_using := replace(optimized_using, '__AUTH_UID_INITPLAN__', '( SELECT auth.uid() AS uid)');
      optimized_using := replace(optimized_using, 'current_setting(''role''::text, true)', '( SELECT current_setting(''role''::text, true) AS current_setting)');
    END IF;

    IF optimized_check IS NOT NULL THEN
      optimized_check := replace(optimized_check, '( SELECT auth.uid() AS uid)', '__AUTH_UID_INITPLAN__');
      optimized_check := replace(optimized_check, 'auth.uid()', '( SELECT auth.uid() AS uid)');
      optimized_check := replace(optimized_check, '__AUTH_UID_INITPLAN__', '( SELECT auth.uid() AS uid)');
      optimized_check := replace(optimized_check, 'current_setting(''role''::text, true)', '( SELECT current_setting(''role''::text, true) AS current_setting)');
    END IF;

    EXECUTE format(
      'ALTER POLICY %I ON %I.%I%s%s',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename,
      CASE WHEN optimized_using IS NULL THEN '' ELSE format(' USING (%s)', optimized_using) END,
      CASE WHEN optimized_check IS NULL THEN '' ELSE format(' WITH CHECK (%s)', optimized_check) END
    );
  END LOOP;
END
$migration$;

-- Exact duplicates, impossible anon paths, or policies fully subsumed by a
-- broader authenticated SELECT policy.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles: leitura própria" ON public.profiles;
DROP POLICY IF EXISTS "professionals: leitura própria" ON public.professionals;
DROP POLICY IF EXISTS "Admin conta conversations" ON public.conversations;
DROP POLICY IF EXISTS "Admin conta lead_purchases" ON public.lead_purchases;
DROP POLICY IF EXISTS "Admin conta messages" ON public.messages;
DROP POLICY IF EXISTS "Admin conta notifications" ON public.notifications;
DROP POLICY IF EXISTS lead_purchases_select_admin ON public.lead_purchases;
DROP POLICY IF EXISTS no_direct_insert_by_users ON public.notifications;

-- Authenticated users already have a broader category read policy; preserve
-- active-only visibility specifically for anonymous visitors.
ALTER POLICY categories_public_read ON public.categories TO anon;

-- Consolidate equivalent admin-or-owner SELECT paths.
DROP POLICY IF EXISTS payments_select_admin ON public.payments;
DROP POLICY IF EXISTS payments_select_own ON public.payments;
CREATE POLICY payments_select_authorized ON public.payments
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR has_role((SELECT auth.uid()), 'admin'::text)
  );

DROP POLICY IF EXISTS "User can view own wallet" ON public.professional_coins;
DROP POLICY IF EXISTS professional_coins_select_admin ON public.professional_coins;
CREATE POLICY professional_coins_select_authorized ON public.professional_coins
  FOR SELECT TO authenticated
  USING (
    professional_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'::text
    )
  );

DROP POLICY IF EXISTS referral_monthly_bonuses_select_admin ON public.referral_monthly_bonuses;
DROP POLICY IF EXISTS referral_monthly_bonuses_select_own ON public.referral_monthly_bonuses;
CREATE POLICY referral_monthly_bonuses_select_authorized ON public.referral_monthly_bonuses
  FOR SELECT TO authenticated
  USING (
    referrer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'::text
    )
  );

DROP POLICY IF EXISTS wtx_select_admin ON public.wallet_transactions;
DROP POLICY IF EXISTS wtx_select_own ON public.wallet_transactions;
CREATE POLICY wtx_select_authorized ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'::text
    )
    OR wallet_id IN (
      SELECT w.id
      FROM public.wallets w
      JOIN public.professionals p ON p.id = w.professional_id
      WHERE p.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS wallets_select_admin ON public.wallets;
DROP POLICY IF EXISTS wallets_select_own ON public.wallets;
CREATE POLICY wallets_select_authorized ON public.wallets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'::text
    )
    OR professional_id IN (
      SELECT professionals.id FROM public.professionals
      WHERE professionals.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS admin_see_all_withdrawals ON public.withdrawal_requests;
DROP POLICY IF EXISTS client_see_own_withdrawals ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_authorized ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin'::text
    )
  );

ALTER POLICY client_insert_own_withdrawal ON public.withdrawal_requests
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY admin_update_withdrawals ON public.withdrawal_requests
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id = (SELECT auth.uid()) AND pr.role = 'admin'::text
    )
  );
