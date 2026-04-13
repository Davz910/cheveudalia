-- Métadonnées email IMAP/SMTP pour fil de discussion et réponses
ALTER TABLE tickets_sav ADD COLUMN IF NOT EXISTS imap_last_message_id TEXT;
ALTER TABLE tickets_sav ADD COLUMN IF NOT EXISTS imap_references TEXT;

-- Évite de traiter deux fois le même Message-ID IMAP
CREATE TABLE IF NOT EXISTS sav_imap_processed (
  message_id TEXT PRIMARY KEY,
  ticket_id UUID REFERENCES tickets_sav(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE sav_imap_processed ENABLE ROW LEVEL SECURITY;
