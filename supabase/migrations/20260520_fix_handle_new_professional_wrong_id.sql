-- professional_coins.professional_id has FK → profiles(id)
-- but handle_new_professional was inserting NEW.id (professionals.id)
-- instead of NEW.user_id (which equals profiles.id).
CREATE OR REPLACE FUNCTION public.handle_new_professional()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.professional_coins (professional_id, balance, total_earned, total_spent)
  VALUES (NEW.user_id, 0, 0, 0)
  ON CONFLICT (professional_id) DO NOTHING;
  RETURN NEW;
END;
$$;
