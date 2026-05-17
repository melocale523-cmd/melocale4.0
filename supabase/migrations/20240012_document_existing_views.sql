-- Documenta as views críticas existentes no banco.
-- Definições extraídas via: SELECT viewname, definition FROM pg_views WHERE schemaname = 'public'.
-- CREATE OR REPLACE VIEW é idempotente e seguro de reaplicar.

CREATE OR REPLACE VIEW public.v_available_leads AS
SELECT id,
       client_id,
       category_id,
       title,
       description,
       city,
       state,
       event_date,
       budget_min,
       budget_max,
       price_coins,
       max_purchases,
       purchases_count,
       status,
       expires_at,
       metadata,
       created_at,
       updated_at,
       category,
       location,
       images
FROM v_leads_available;

CREATE OR REPLACE VIEW public.v_wallet_balance AS
SELECT professional_id AS user_id,
       balance         AS balance_coins
FROM professional_coins
WHERE professional_id = auth.uid();

CREATE OR REPLACE VIEW public.v_my_purchases AS
SELECT lp.id,
       lp.lead_id,
       lp.professional_id,
       lp.user_id,
       lp.price_coins,
       lp.created_at,
       lp.notes,
       lp.idempotency_key,
       lp.status,
       l.title,
       l.description,
       l.category,
       l.city,
       l.state,
       l.location,
       l.budget_min,
       l.budget_max,
       l.event_date,
       l.expires_at,
       l.images,
       l.max_purchases,
       l.purchases_count,
       l.status      AS lead_status,
       c.id          AS client_id,
       c.full_name   AS client_name,
       c.email       AS client_email,
       c.phone       AS client_phone,
       c.city        AS client_city
FROM lead_purchases lp
JOIN leads          l  ON l.id  = lp.lead_id
JOIN clients        c  ON c.id  = l.client_id
WHERE lp.user_id = auth.uid();

CREATE OR REPLACE VIEW public.v_conversations AS
SELECT c.id,
       c.client_id,
       c.professional_id,
       c.professional_user_id,
       c.lead_id,
       c.last_message_at,
       c.unread_for_prof,
       c.created_at,
       CASE
         WHEN jsonb_typeof(m.attachments) = 'array' AND jsonb_array_length(m.attachments) > 0 THEN
           CASE (m.attachments -> 0) ->> 'type'
             WHEN 'image' THEN '📷 Foto'
             WHEN 'audio' THEN '🎤 Áudio'
             WHEN 'file'  THEN '📎 ' || COALESCE((m.attachments -> 0) ->> 'fileName', 'Arquivo')
             ELSE m.body
           END
         ELSE m.body
       END AS last_message,
       pp.full_name  AS prof_full_name,
       pp.avatar_url AS prof_avatar_url,
       cp.full_name  AS client_full_name,
       cp.avatar_url AS client_avatar_url,
       (SELECT COUNT(*)::integer
        FROM messages msg
        WHERE msg.conversation_id = c.id
          AND msg.sender_type = 'professional'
          AND msg.read_at IS NULL) AS unread_for_client
FROM conversations c
LEFT JOIN LATERAL (
  SELECT body, attachments
  FROM messages
  WHERE conversation_id = c.id
  ORDER BY created_at DESC
  LIMIT 1
) m ON true
LEFT JOIN profiles pp ON pp.id = c.professional_user_id
LEFT JOIN profiles cp ON cp.id = c.client_id;
