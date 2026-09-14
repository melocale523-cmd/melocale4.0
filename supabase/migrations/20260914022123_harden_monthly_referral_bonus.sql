-- Harden monthly referral bonus:
-- 1. Claim (referrer_id, month) BEFORE credit using existing UNIQUE constraint.
-- 2. Only the transaction that successfully claims the month may credit coins.
-- 3. Any credit/notification failure aborts the RPC transaction and rolls the claim back.
-- 4. Use deterministic text identifiers compatible with credit_professional_coins(uuid,int,text,text).
-- 5. Preserve service_role-only execution.

CREATE OR REPLACE FUNCTION public.apply_monthly_referral_bonus()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_rec record;
  v_count integer := 0;
  v_claim_id uuid;
  v_event_id text;
BEGIN
  FOR v_rec IN
    SELECT
      s.referrer_id,
      s.total_this_month
    FROM public.referral_monthly_stats s
    WHERE s.total_this_month >= 5
  LOOP
    v_claim_id := NULL;

    INSERT INTO public.referral_monthly_bonuses (
      referrer_id,
      month
    )
    VALUES (
      v_rec.referrer_id,
      v_month
    )
    ON CONFLICT (referrer_id, month) DO NOTHING
    RETURNING id INTO v_claim_id;

    -- Another execution already claimed/credited this user for this month.
    IF v_claim_id IS NULL THEN
      CONTINUE;
    END IF;

    v_event_id :=
      'monthly_referral_bonus:' ||
      v_rec.referrer_id::text ||
      ':' ||
      to_char(v_month, 'YYYY-MM-DD');

    PERFORM public.credit_professional_coins(
      v_rec.referrer_id,
      500,
      'monthly_referral_bonus',
      v_event_id
    );

    INSERT INTO public.notifications (
      user_id,
      title,
      body,
      data
    )
    VALUES (
      v_rec.referrer_id,
      '🏆 Meta mensal atingida!',
      'Você indicou 5 ou mais pessoas este mês e ganhou 500 moedas bônus!',
      jsonb_build_object(
        'type', 'monthly_bonus',
        'coins', 500,
        'month', v_month
      )
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE EXECUTE
ON FUNCTION public.apply_monthly_referral_bonus()
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.apply_monthly_referral_bonus()
TO service_role;
