-- Habilita Realtime para user_notification_preferences (badge "Conectado"
-- em Configurações atualiza sem refresh quando o webhook marca
-- whatsapp_connected). RLS já restringe cada usuário à própria linha.
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notification_preferences;
