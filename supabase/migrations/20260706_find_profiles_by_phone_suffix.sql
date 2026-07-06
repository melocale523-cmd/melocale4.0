-- Localiza QUALQUER profile (cliente, profissional ou desconhecido) pelo
-- sufixo do telefone — usado pelo webhook do WhatsApp para resolver
-- contact_id/contact_type de whatsapp_conversations. Complementa
-- find_professionals_by_phone_suffix (que só enxerga professionals).
CREATE OR REPLACE FUNCTION public.find_profiles_by_phone_suffix(p_suffix TEXT)
RETURNS TABLE (id UUID, full_name TEXT, role TEXT, city TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id, p.full_name, p.role, p.city
  FROM public.profiles p
  WHERE p.phone IS NOT NULL
    AND regexp_replace(p.phone, '\D', '', 'g') LIKE '%' || p_suffix
$$;

-- Só o backend (service role) pode chamar
REVOKE EXECUTE ON FUNCTION public.find_profiles_by_phone_suffix(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_profiles_by_phone_suffix(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_profiles_by_phone_suffix(TEXT) FROM authenticated;
