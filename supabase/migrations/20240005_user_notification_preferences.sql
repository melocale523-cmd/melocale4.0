CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  email_new_lead BOOLEAN DEFAULT true,
  email_messages BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário gerencia próprias preferências"
  ON user_notification_preferences FOR ALL
  USING (user_id = auth.uid());
