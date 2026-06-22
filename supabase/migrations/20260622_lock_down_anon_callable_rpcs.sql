-- Funções que creditavam/debitavam client_coins e eram chamáveis por anon/authenticated
-- direto via REST do Supabase, bypassando completamente as validações do Express.
-- Adicionado SET search_path (proteção contra search-path hijacking) e
-- REVOKE de anon/authenticated — só service_role (backend) pode chamar agora.

CREATE OR REPLACE FUNCTION public.credit_client_coins(p_user_id uuid, p_amount integer, p_kind text, p_reference text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_balance_after integer;
BEGIN
  IF p_reference IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM client_coin_transactions WHERE user_id = p_user_id AND reference = p_reference) THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_credited');
    END IF;
  END IF;
  INSERT INTO client_coins (user_id, balance, total_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = client_coins.balance + p_amount, total_earned = client_coins.total_earned + p_amount, updated_at = now();
  SELECT balance INTO v_balance_after FROM client_coins WHERE user_id = p_user_id;
  INSERT INTO client_coin_transactions (user_id, amount, kind, reference, metadata, balance_after)
  VALUES (p_user_id, p_amount, p_kind, p_reference, p_metadata, v_balance_after);
  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.credit_client_coins(uuid, integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_client_coins(uuid, integer, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.debit_client_coins(p_user_id uuid, p_amount integer, p_kind text, p_reference text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_current_balance integer;
  v_balance_after integer;
BEGIN
  SELECT balance INTO v_current_balance FROM client_coins WHERE user_id = p_user_id;
  IF NOT FOUND OR v_current_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance');
  END IF;
  UPDATE client_coins SET balance = balance - p_amount, total_withdrawn = total_withdrawn + p_amount, updated_at = now() WHERE user_id = p_user_id;
  v_balance_after := v_current_balance - p_amount;
  INSERT INTO client_coin_transactions (user_id, amount, kind, reference, metadata, balance_after)
  VALUES (p_user_id, -p_amount, p_kind, p_reference, p_metadata, v_balance_after);
  RETURN jsonb_build_object('success', true, 'balance_after', v_balance_after);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.debit_client_coins(uuid, integer, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_client_coins(uuid, integer, text, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_cascade_referral(p_level1_user_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_level0_code TEXT;
  v_level0_id UUID;
  v_reward INT := 20;
BEGIN
  SELECT referred_by_code INTO v_level0_code FROM profiles WHERE id = p_level1_user_id;
  IF v_level0_code IS NULL THEN RETURN; END IF;
  SELECT id INTO v_level0_id FROM profiles WHERE referral_code = v_level0_code;
  IF v_level0_id IS NULL THEN RETURN; END IF;
  BEGIN
    PERFORM credit_professional_coins(v_level0_id, v_reward, 'cascade_referral', jsonb_build_object('level', 2, 'level1_user_id', p_level1_user_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO notifications (user_id, title, body, data)
  VALUES (v_level0_id, '🔗 Indicação em cascata!', 'Alguém que você indicou trouxe mais um usuário. +20 moedas creditadas!', jsonb_build_object('type', 'cascade_referral', 'coins', v_reward));
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.credit_cascade_referral(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_cascade_referral(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.credit_referral_reward(p_referral_id uuid, p_reward_coins integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_referral referrals%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_new_balance integer;
BEGIN
  SELECT * INTO v_referral FROM referrals WHERE id = p_referral_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'referral_not_found'); END IF;
  IF v_referral.status = 'credited' THEN RETURN jsonb_build_object('success', false, 'error', 'already_credited'); END IF;
  IF v_referral.referrer_role = 'professional' THEN
    UPDATE professional_coins SET balance = balance + p_reward_coins, total_earned = total_earned + p_reward_coins, updated_at = now()
    WHERE professional_id = (SELECT id FROM professionals WHERE user_id = v_referral.referrer_id LIMIT 1);
    SELECT * INTO v_wallet FROM wallets WHERE professional_id = (SELECT id FROM professionals WHERE user_id = v_referral.referrer_id LIMIT 1) LIMIT 1;
    IF FOUND THEN
      v_new_balance := v_wallet.balance_coins + p_reward_coins;
      INSERT INTO wallet_transactions (wallet_id, amount, kind, reference, balance_after, professional_id, metadata)
      SELECT v_wallet.id, p_reward_coins, 'credit', 'referral_reward', v_new_balance, v_wallet.professional_id,
        jsonb_build_object('referral_id', p_referral_id, 'referred_id', v_referral.referred_id);
      UPDATE wallets SET balance_coins = v_new_balance, updated_at = now() WHERE id = v_wallet.id;
    END IF;
  ELSE
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_referral.referrer_id LIMIT 1;
    IF FOUND THEN
      v_new_balance := v_wallet.balance + 200;
      INSERT INTO wallet_transactions (wallet_id, amount, kind, reference, balance_after, user_id, metadata)
      VALUES (v_wallet.id, 200, 'credit', 'referral_reward', v_new_balance, v_referral.referrer_id,
        jsonb_build_object('referral_id', p_referral_id, 'referred_id', v_referral.referred_id));
      UPDATE wallets SET balance = v_new_balance, updated_at = now() WHERE id = v_wallet.id;
    END IF;
  END IF;
  UPDATE referrals SET status = 'credited', reward_amount = p_reward_coins, credited_at = now() WHERE id = p_referral_id;
  RETURN jsonb_build_object('success', true, 'reward_coins', p_reward_coins);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.credit_referral_reward(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_referral_reward(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_monthly_referral_bonus()
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_month DATE := date_trunc('month', now())::date;
  v_rec RECORD;
  v_count INT := 0;
BEGIN
  FOR v_rec IN
    SELECT s.referrer_id, s.total_this_month FROM referral_monthly_stats s
    WHERE s.total_this_month >= 5
      AND NOT EXISTS (SELECT 1 FROM referral_monthly_bonuses b WHERE b.referrer_id = s.referrer_id AND b.month = v_month)
  LOOP
    BEGIN
      PERFORM credit_professional_coins(v_rec.referrer_id, 500, 'monthly_referral_bonus', jsonb_build_object('month', v_month, 'referrals', v_rec.total_this_month));
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    INSERT INTO referral_monthly_bonuses (referrer_id, month) VALUES (v_rec.referrer_id, v_month) ON CONFLICT DO NOTHING;
    INSERT INTO notifications (user_id, title, body, data)
    VALUES (v_rec.referrer_id, '🏆 Meta mensal atingida!', 'Você indicou 5 ou mais pessoas este mês e ganhou 500 moedas bônus!', jsonb_build_object('type', 'monthly_bonus', 'coins', 500));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.apply_monthly_referral_bonus() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_monthly_referral_bonus() TO service_role;

-- request_withdrawal e admin_process_withdrawal já validavam auth.uid() internamente —
-- só removendo o acesso anon desnecessário (defesa em profundidade, não eram exploráveis).
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, text) FROM anon;

-- Funções legadas do schema antigo (wallets/transactions, superado por
-- professional_coins/wallet_transactions). Zero chamadores no código atual
-- (frontend e backend) — confirmado via grep antes de travar. Mantidas
-- restritas a service_role em vez de removidas, por precaução.
REVOKE EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_credits(uuid, integer, text, numeric, text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reprocess_payment(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reprocess_payment(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_wallet(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_wallet(uuid, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_professional_balance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_professional_balance(uuid) TO service_role;
