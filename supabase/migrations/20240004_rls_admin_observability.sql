DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='conversations' AND policyname='Admin conta conversations'
  ) THEN
    CREATE POLICY "Admin conta conversations"
      ON conversations FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='Admin conta messages'
  ) THEN
    CREATE POLICY "Admin conta messages"
      ON messages FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='lead_purchases' AND policyname='Admin conta lead_purchases'
  ) THEN
    CREATE POLICY "Admin conta lead_purchases"
      ON lead_purchases FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='Admin conta notifications'
  ) THEN
    CREATE POLICY "Admin conta notifications"
      ON notifications FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
  END IF;
END $$;
