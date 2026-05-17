-- Problema: o frontend chamava supabase.from('leads').update({ status: 'finalizado' })
-- após marcar um appointment como 'completed'. Por RLS, profissionais não têm UPDATE
-- em leads (apenas clientes podem), portanto a atualização era um no-op silencioso.
-- Leads nunca transitavam para 'finalizado'.
--
-- Correção: mesmo padrão de purchase_lead (migration 20240007) — mover a transição
-- de status para um RPC com SECURITY DEFINER que bypassa RLS legitimamente.
--
-- A função valida que o caller é o profissional do appointment antes de agir.
-- Appointment e lead são atualizados atomicamente na mesma transação.
CREATE OR REPLACE FUNCTION public.finalize_lead(p_appointment_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID;
  v_prof_user_id   UUID;
  v_conv_id        UUID;
  v_lead_id        UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Busca conversation_id e valida que o caller é o profissional do appointment
  SELECT a.conversation_id, pr.user_id
  INTO   v_conv_id, v_prof_user_id
  FROM   appointments a
  JOIN   professionals pr ON pr.id = a.professional_id
  WHERE  a.id = p_appointment_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'appointment_not_found');
  END IF;

  IF v_prof_user_id IS DISTINCT FROM v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'forbidden');
  END IF;

  -- Marca appointment como concluído
  UPDATE appointments
  SET    status = 'completed', updated_at = now()
  WHERE  id = p_appointment_id;

  -- Transiciona lead para 'finalizado' via SECURITY DEFINER (bypassa RLS)
  IF v_conv_id IS NOT NULL THEN
    SELECT lead_id INTO v_lead_id
    FROM   conversations
    WHERE  id = v_conv_id;

    IF v_lead_id IS NOT NULL THEN
      UPDATE leads
      SET    status = 'finalizado'
      WHERE  id = v_lead_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Apenas usuários autenticados podem chamar; a validação de ownership fica no RPC
REVOKE EXECUTE ON FUNCTION public.finalize_lead(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_lead(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.finalize_lead(UUID) TO authenticated;
