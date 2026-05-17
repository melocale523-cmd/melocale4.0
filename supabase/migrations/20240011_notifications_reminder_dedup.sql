-- Elimina duplicatas de notificações de lembrete em cenários de scale-out.
-- O job lembrete24h roda com setInterval em todas as instâncias; sem esta
-- constraint dois processos podem inserir simultaneamente.
-- Índice parcial cobre apenas reminder_24h e reminder_24h_prof para não
-- afetar outros tipos de notificação que podem ter vários registros por appointment.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_reminder_dedup
  ON public.notifications (user_id, (data->>'appointment_id'))
  WHERE (data->>'type') IN ('reminder_24h', 'reminder_24h_prof');
