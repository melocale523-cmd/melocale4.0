-- Idempotency guard: prevents sending the 24h reminder more than once per appointment
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

-- Partial index so the reminder job can quickly find unprocessed rows
CREATE INDEX IF NOT EXISTS idx_appointments_reminder_pending
  ON public.appointments(scheduled_at)
  WHERE reminder_sent_at IS NULL;
