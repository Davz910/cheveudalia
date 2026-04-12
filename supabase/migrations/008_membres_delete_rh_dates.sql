-- Suppression réservée au gérant
CREATE POLICY membres_delete_gerant ON membres FOR DELETE TO authenticated
  USING (public.is_gerant());

-- Dates contrat (RH)
ALTER TABLE membres ADD COLUMN IF NOT EXISTS date_debut DATE;
ALTER TABLE membres ADD COLUMN IF NOT EXISTS date_fin DATE;
