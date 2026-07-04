-- Auditoria (seção segurança): 34 funções SECURITY DEFINER executáveis por
-- anon/authenticated via /rest/v1/rpc/. Classificação feita por grep de cada
-- nome no frontend/backend + tipo de retorno. Segue o precedente de
-- 20260622_lock_down_anon_callable_rpcs.sql.
--
-- GRUPO A — 16 trigger functions: não são chamáveis via RPC (PostgREST não
-- expõe funções que retornam trigger) e disparo de trigger NÃO checa EXECUTE
-- do usuário da sessão — revogar é higiene sem efeito em runtime.
REVOKE EXECUTE ON FUNCTION public.calculate_lead_price() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_wallet_for_new_professional() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_professional_active() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_professional() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_profile_preferences() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_client() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_lead_views() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_profile_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_professional_city() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_professional_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_professional_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_professional() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_wallet_balance_from_coins() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_appointments_coherence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_wallet_tx_consistency_guard() FROM PUBLIC, anon, authenticated;

-- GRUPO B — 6 RPCs sem nenhum chamador no código (só aparecem em
-- database.types.ts): restritas a service_role, mantidas por precaução.
REVOKE EXECUTE ON FUNCTION public.get_available_leads(uuid, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_leads(uuid, text, text, integer, integer) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_leads() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_leads() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_my_purchases() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_purchases() TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_professional_completeness(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_professional_completeness(uuid) TO service_role;
REVOKE EXECUTE ON FUNCTION public.get_seo_professionals(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_professionals(text, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO service_role;

-- GRUPO C — 11 RPCs usadas por fluxos logados do frontend: anon revogado,
-- authenticated mantido. Nota: o cadastro roda autenticado (autoconfirm de
-- email está ativo — 33/34 usuários confirmados em <5s), então
-- save_full_profile e ensure_professional_exists não precisam de anon.
-- Se o autoconfirm for desativado um dia, o cadastro de profissional passa
-- a precisar de anon EXECUTE em save_full_profile de novo.
REVOKE EXECUTE ON FUNCTION public.admin_get_approved_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_pending_professionals() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_professional_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_professional_exists(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finalize_lead(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.purchase_lead(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.respond_proposal(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_full_profile(uuid, text, text, text, text, integer) FROM PUBLIC, anon;

-- GRUPO D — mantida como está: has_role é referenciada em expressões de RLS
-- avaliadas sob anon e authenticated; revogar quebraria a avaliação das
-- policies que a usam.

-- ═══ VIEWS ═══
--
-- 🚨 v_withdrawal_requests: view SECURITY DEFINER SEM filtro, com SELECT
-- para anon e authenticated — expunha nome, telefone e CHAVE PIX de todos
-- os saques a qualquer sessão. Único consumidor legítimo: admin/Saques.tsx.
-- Fix: filtro has_role(admin) no corpo (views não têm RLS) + revoke anon.
CREATE OR REPLACE VIEW public.v_withdrawal_requests AS
 SELECT wr.id,
    wr.user_id,
    p.full_name,
    p.phone,
    wr.coins_amount,
    wr.brl_amount,
    wr.pix_key,
    wr.pix_key_type,
    wr.status,
    wr.admin_note,
    wr.requested_at,
    wr.processed_at,
    wr.processed_by,
    cc.balance AS current_balance
   FROM withdrawal_requests wr
     JOIN profiles p ON p.id = wr.user_id
     LEFT JOIN client_coins cc ON cc.user_id = wr.user_id
  WHERE has_role(auth.uid(), 'admin'::text);
REVOKE ALL ON public.v_withdrawal_requests FROM anon;

-- referral_monthly_stats: sem chamador no código (só a RPC de bônus mensal,
-- que roda como owner da função) — acesso de API removido.
REVOKE ALL ON public.referral_monthly_stats FROM anon, authenticated;

-- client_coins_ranking: consumida apenas pelo backend (service_role) que a
-- expõe num endpoint público intencional — acesso direto de API removido.
REVOKE ALL ON public.client_coins_ranking FROM anon, authenticated;

-- v_available_leads: consumida por profissionais logados (leadService);
-- anon não tem por que enumerar o pipeline de leads.
REVOKE ALL ON public.v_available_leads FROM anon;

-- Demais views (v_my_purchases, v_client_leads, v_conversations,
-- v_wallet_balance): filtram por auth.uid() — corretas, sem mudança.
-- professionals_with_rating: diretório público usado pela busca (anon) —
-- intencional, sem mudança.
