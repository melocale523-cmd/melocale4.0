DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='wallet_transactions' AND column_name='type') THEN
    ALTER TABLE wallet_transactions RENAME COLUMN type TO kind;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name='wallet_transactions' AND column_name='description') THEN
    ALTER TABLE wallet_transactions RENAME COLUMN description TO reference;
  END IF;
END $$;

ALTER TABLE wallet_transactions ALTER COLUMN stripe_event_id DROP NOT NULL;
