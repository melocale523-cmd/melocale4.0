-- The mark_messages_read RPC tried to UPDATE conversations SET unread_client = 0
-- but that column does not exist. The conversations table only has unread_for_prof.
-- The client-side unread count (unread_for_client) is computed in v_conversations
-- by counting messages WHERE sender_type = 'professional' AND read_at IS NULL,
-- so the first UPDATE (setting read_at = NOW()) already clears the client badge.
-- Removing the broken branch fixes both the 400 error and the badge not clearing.
CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_conversation_id uuid,
  p_sender_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE messages
  SET read_at = NOW()
  WHERE conversation_id = p_conversation_id
    AND read_at IS NULL
    AND sender_type != p_sender_type;

  IF p_sender_type = 'professional' THEN
    UPDATE conversations SET unread_for_prof = 0 WHERE id = p_conversation_id;
  END IF;
END;
$$;
