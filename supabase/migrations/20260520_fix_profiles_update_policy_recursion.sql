-- The WITH CHECK clause on "profiles: atualização própria" contained a
-- self-referential subquery (SELECT role FROM profiles WHERE id = auth.uid()).
-- PostgREST evaluates this within an UPDATE context, which re-triggers RLS
-- policy evaluation on the same table → "infinite recursion detected".
--
-- Fix: simplify WITH CHECK to (id = auth.uid()).
-- Role-change protection is moved to the BEFORE INSERT OR UPDATE trigger,
-- which already runs as SECURITY DEFINER and is not subject to RLS.

DROP POLICY IF EXISTS "profiles: atualização própria" ON profiles;
CREATE POLICY "profiles: atualização própria" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Extend set_default_profile_role to fire on UPDATE as well,
-- silently reverting unauthorized role changes.
CREATE OR REPLACE FUNCTION public.set_default_profile_role()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       AND current_setting('role', true) != 'service_role' THEN
      NEW.role := OLD.role;
    END IF;
    RETURN NEW;
  END IF;
  -- INSERT path: validate and default role
  IF NEW.role IS NULL OR NEW.role NOT IN ('client', 'professional', 'admin') THEN
    NEW.role := 'client';
  END IF;
  IF NEW.role = 'admin' AND current_setting('role', true) != 'service_role' THEN
    NEW.role := 'client';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_default_role ON profiles;
CREATE TRIGGER trg_profiles_default_role
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_default_profile_role();
