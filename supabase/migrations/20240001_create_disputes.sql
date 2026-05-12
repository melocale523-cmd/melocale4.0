CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  client_id UUID REFERENCES auth.users(id),
  professional_id UUID REFERENCES professionals(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin vê todas disputas"
  ON disputes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Cliente vê próprias disputas"
  ON disputes FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Profissional vê próprias disputas"
  ON disputes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM professionals p WHERE p.id = professional_id AND p.user_id = auth.uid()
  ));
