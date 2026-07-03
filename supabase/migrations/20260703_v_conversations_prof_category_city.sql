-- O ChatLayout sempre teve um badge "categoria · cidade" do profissional que
-- nunca renderizou: a v_conversations junta profiles (nome/avatar) mas nunca
-- juntou professionals, onde category e city vivem. Adiciona as duas colunas
-- (no fim da lista — exigência do CREATE OR REPLACE VIEW) via join por
-- c.professional_id. Restante da view idêntico, incluindo o filtro por
-- auth.uid().

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
            WHEN jsonb_typeof(m.attachments) = 'array'::text AND jsonb_array_length(m.attachments) > 0 THEN
            CASE (m.attachments -> 0) ->> 'type'::text
                WHEN 'image'::text THEN '📷 Foto'::text
                WHEN 'audio'::text THEN '🎤 Áudio'::text
                WHEN 'file'::text THEN '📎 '::text || COALESCE((m.attachments -> 0) ->> 'fileName'::text, 'Arquivo'::text)
                ELSE m.body
            END
            ELSE m.body
        END AS last_message,
    pp.full_name AS prof_full_name,
    pp.avatar_url AS prof_avatar_url,
    cp.full_name AS client_full_name,
    cp.avatar_url AS client_avatar_url,
    ( SELECT count(*)::integer AS count
           FROM messages msg
          WHERE msg.conversation_id = c.id AND msg.sender_type = 'professional'::text AND msg.read_at IS NULL) AS unread_for_client,
    pr.category AS prof_category,
    pr.city AS prof_city
   FROM conversations c
     LEFT JOIN LATERAL ( SELECT messages.body,
            messages.attachments
           FROM messages
          WHERE messages.conversation_id = c.id
          ORDER BY messages.created_at DESC
         LIMIT 1) m ON true
     LEFT JOIN profiles pp ON pp.id = c.professional_user_id
     LEFT JOIN profiles cp ON cp.id = c.client_id
     LEFT JOIN professionals pr ON pr.id = c.professional_id
  WHERE c.client_id = auth.uid() OR c.professional_user_id = auth.uid();
