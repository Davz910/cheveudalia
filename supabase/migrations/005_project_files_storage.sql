INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_files_select" ON storage.objects;

CREATE POLICY "project_files_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files');

CREATE POLICY "project_files_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files');

-- Realtime Kanban (ignorer si déjà publié)
-- ALTER PUBLICATION supabase_realtime ADD TABLE projets;
