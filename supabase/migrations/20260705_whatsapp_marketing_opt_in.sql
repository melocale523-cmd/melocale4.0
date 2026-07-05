-- Consentimento de marketing via WhatsApp (template Marketing exige opt-in explícito)
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS whatsapp_marketing_opt_in BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_connected BOOLEAN DEFAULT false;

-- Localiza profissionais pelo sufixo do telefone (wa_id do webhook pode vir
-- com ou sem o 9 extra / DDI 55; profiles.phone é DDD+numero sem formatação)
CREATE OR REPLACE FUNCTION public.find_professionals_by_phone_suffix(p_suffix TEXT)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
AS $$
  SELECT p.id
  FROM public.profiles p
  JOIN public.professionals pr ON pr.user_id = p.id
  WHERE p.phone IS NOT NULL
    AND regexp_replace(p.phone, '\D', '', 'g') LIKE '%' || p_suffix
$$;

-- Só o backend (service role) pode chamar
REVOKE EXECUTE ON FUNCTION public.find_professionals_by_phone_suffix(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_professionals_by_phone_suffix(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_professionals_by_phone_suffix(TEXT) FROM authenticated;
