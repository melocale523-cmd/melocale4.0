-- Prevent duplicate reviews for the same appointment
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_appointment_id_key UNIQUE (appointment_id);

-- Strengthen INSERT policy: authenticated only + block self-review
DROP POLICY IF EXISTS "Cliente pode criar review" ON public.reviews;
CREATE POLICY "Cliente pode criar review"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = professional_id AND p.user_id = auth.uid()
    )
  );
