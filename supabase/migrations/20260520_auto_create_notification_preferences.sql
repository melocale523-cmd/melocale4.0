-- Automatically create a default notification preferences row when
-- a new profile is inserted (new user signup).
CREATE OR REPLACE FUNCTION public.handle_new_profile_preferences()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_notification_preferences ON profiles;
CREATE TRIGGER trg_create_notification_preferences
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_profile_preferences();

-- Backfill existing users who don't have preferences yet
INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM profiles
WHERE id NOT IN (SELECT user_id FROM user_notification_preferences)
ON CONFLICT (user_id) DO NOTHING;
