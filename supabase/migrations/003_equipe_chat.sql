-- Threads DM : même conv_id que dans messages (UUID déterministe côté app : SHA-256 → UUID)
CREATE TABLE IF NOT EXISTS chat_dm_threads (
  id UUID PRIMARY KEY,
  member_a UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  member_b UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chat_dm_ordered CHECK (member_a::text < member_b::text)
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_dm_threads_pair ON chat_dm_threads (member_a, member_b);

ALTER TABLE chat_dm_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY chat_dm_threads_select ON chat_dm_threads FOR SELECT TO authenticated USING (true);

CREATE POLICY chat_dm_threads_insert ON chat_dm_threads FOR INSERT TO authenticated
  WITH CHECK (
    member_a IN (SELECT id FROM membres WHERE auth_user_id = auth.uid())
    OR member_b IN (SELECT id FROM membres WHERE auth_user_id = auth.uid())
  );

-- Bucket fichiers chat (créer aussi via Dashboard Storage si besoin)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat_files_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_select_authenticated" ON storage.objects;

CREATE POLICY "chat_files_insert_authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files');

CREATE POLICY "chat_files_select_authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files');

-- Notifications sur nouveau message (contourne RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.notify_chat_message_recipients()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r UUID;
  preview TEXT;
BEGIN
  IF NEW.from_id IS NULL THEN
    RETURN NEW;
  END IF;

  preview := COALESCE(left(NEW.texte, 200), 'Fichier envoyé');

  -- Groupe projet : conv_id = projets.id
  IF EXISTS (SELECT 1 FROM projets p WHERE p.id = NEW.conv_id) THEN
    FOR r IN
      SELECT DISTINCT (e.elem)::uuid
      FROM projets p,
        LATERAL jsonb_array_elements_text(COALESCE(p.membres, '[]'::jsonb)) AS e(elem)
      WHERE p.id = NEW.conv_id
        AND e.elem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    LOOP
      IF r IS NOT NULL AND r <> NEW.from_id THEN
        INSERT INTO notifications (user_id, type, titre, "desc", canal, read)
        VALUES (r, 'message', 'Nouveau message équipe', preview, 'equipe', false);
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- DM : conv_id = chat_dm_threads.id
  IF EXISTS (SELECT 1 FROM chat_dm_threads t WHERE t.id = NEW.conv_id) THEN
    FOR r IN
      SELECT x FROM (
        SELECT member_a AS x FROM chat_dm_threads WHERE id = NEW.conv_id
        UNION ALL
        SELECT member_b FROM chat_dm_threads WHERE id = NEW.conv_id
      ) s
      WHERE x IS NOT NULL AND x <> NEW.from_id
    LOOP
      INSERT INTO notifications (user_id, type, titre, "desc", canal, read)
      VALUES (r, 'message', 'Nouveau message privé', preview, 'equipe', false);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_notify ON messages;
CREATE TRIGGER trg_messages_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.notify_chat_message_recipients();

-- Realtime (ignorer l’erreur si la table est déjà dans la publication)
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
