-- Marca quando uma conversa em needs_human já disparou o alerta de
-- escalonamento (2h sem resposta) — evita repetir o alerta a cada 15min
-- enquanto continuar parada. RLS já tem policy explícita pro service_role
-- (whatsapp_conversations_service_role_full_access), não precisa de nova.
ALTER TABLE whatsapp_conversations ADD COLUMN handoff_escalated_at timestamptz;
