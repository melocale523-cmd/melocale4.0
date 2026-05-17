-- Removes permissive SELECT policies that were never applied to production
-- (RLS_FIX.sql was committed but not executed; these DROPs are safe no-ops
-- kept here for idempotency if ever run against a stale environment).
DROP POLICY IF EXISTS "allow all select lead_purchases"     ON public.lead_purchases;
DROP POLICY IF EXISTS "allow all select wallet_transactions" ON public.wallet_transactions;

-- Ensures professionals can select their own lead_purchases rows via
-- the professionals.user_id foreign key. Complements the existing
-- "professional_can_view_own_purchases" policy (which also checks user_id
-- directly on the row) without conflicting with it.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'lead_purchases'
      AND policyname = 'professional sees own lead_purchases'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "professional sees own lead_purchases"
      ON public.lead_purchases
      FOR SELECT
      USING (
        professional_id IN (
          SELECT id FROM public.professionals
          WHERE user_id = auth.uid()
        )
      )
    $pol$;
  END IF;
END $$;

-- Ensures users can select their own wallet_transactions rows via user_id.
-- The existing "wtx_select_own" policy covers rows with wallet_id populated;
-- this policy closes the gap for rows where only user_id is set (backend
-- webhook inserts), making all 20 historical transactions visible to their
-- owners via the frontend (which filters by user_id).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'wallet_transactions'
      AND policyname = 'user sees own wallet_transactions'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "user sees own wallet_transactions"
      ON public.wallet_transactions
      FOR SELECT
      USING (user_id = auth.uid())
    $pol$;
  END IF;
END $$;
