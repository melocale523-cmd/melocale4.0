-- Track when the client explicitly confirmed physical presence
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
