
CREATE POLICY "volunteer uploads own proof"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "participants read proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.donations d ON d.id = a.donation_id
      WHERE a.proof_url = storage.objects.name
        AND (a.volunteer_id = auth.uid() OR d.donor_id = auth.uid() OR d.claimed_by = auth.uid())
    )
  )
);

CREATE POLICY "volunteer updates own proof"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'delivery-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);
