-- The check-then-insert pattern (SELECT ... IF NULL THEN INSERT) is not
-- atomic. Concurrent calls (multiple renders of useProfile mounting
-- simultaneously) both see no row and both attempt INSERT, causing the
-- second one to fail with a unique_violation → HTTP 409.
--
-- Fix: use INSERT ... ON CONFLICT (user_id) DO NOTHING, which is atomic.
-- A fallback SELECT retrieves the id if the row already existed.
CREATE OR REPLACE FUNCTION public.ensure_professional_exists(
  p_user_id  uuid,
  p_category text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prof_id UUID;
BEGIN
  INSERT INTO professionals (user_id, category, is_active)
  VALUES (p_user_id, p_category, true)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_prof_id;

  IF v_prof_id IS NULL THEN
    SELECT id INTO v_prof_id FROM professionals WHERE user_id = p_user_id;
  END IF;

  RETURN v_prof_id;
END;
$$;
