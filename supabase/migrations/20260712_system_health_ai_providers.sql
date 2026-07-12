-- Estende o health check (já cobre DB/Stripe, roda a cada 5min via cron) pra
-- também monitorar Anthropic e OpenAI — hoje se qualquer uma cai, o bot do
-- WhatsApp degrada silenciosamente pro fallback genérico e ninguém percebe.
ALTER TABLE system_health_checks
  ADD COLUMN anthropic_status text,
  ADD COLUMN anthropic_latency_ms integer,
  ADD COLUMN openai_status text,
  ADD COLUMN openai_latency_ms integer;
