-- A política "authenticated_can_insert_notifications" permite que qualquer
-- usuário autenticado insira notificações para qualquer user_id diretamente
-- pelo Supabase JS SDK, abrindo vetor de spam/phishing entre usuários.
-- O backend usa service role (bypassa RLS) para todos os inserts legítimos,
-- portanto nenhuma política de INSERT é necessária para usuários autenticados.

-- Remove ambas as variações do nome (SUPABASE_NOTIFICATIONS.sql usava nome diferente do aplicado)
DROP POLICY IF EXISTS "Anyone authenticated can send notifications" ON public.notifications;
DROP POLICY IF EXISTS "authenticated_can_insert_notifications" ON public.notifications;

-- Bloqueia INSERT explicitamente para usuários autenticados.
-- Service role não é afetado por RLS (bypassa automaticamente).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'notifications'
      AND policyname = 'no_direct_insert_by_users'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "no_direct_insert_by_users"
      ON public.notifications
      FOR INSERT
      WITH CHECK (false)
    $pol$;
  END IF;
END $$;
