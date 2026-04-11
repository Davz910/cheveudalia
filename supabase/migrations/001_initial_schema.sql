-- Cheveudalia — schéma initial + RLS
-- Exécuter dans le SQL Editor Supabase ou via CLI

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Types
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('gerant', 'sav', 'logistique', 'marketing', 'cm');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Membres : id métier ; auth_user_id lie le compte Supabase Auth (rempli après 1ère connexion)
CREATE TABLE IF NOT EXISTS membres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  prenom TEXT NOT NULL DEFAULT '',
  nom TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'cm',
  contrat TEXT,
  salaire NUMERIC,
  gratif NUMERIC,
  gratif_freq TEXT,
  horaires TEXT,
  code_acces TEXT,
  expiration_acces TIMESTAMPTZ,
  statut TEXT DEFAULT 'actif',
  permissions JSONB DEFAULT '{}',
  presences JSONB DEFAULT '[]',
  fichiers JSONB DEFAULT '[]',
  sav_signature_html TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets_sav (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_nom TEXT,
  client_email TEXT,
  client_tel TEXT,
  marche TEXT,
  canal TEXT,
  sujet TEXT,
  statut TEXT DEFAULT 'ouvert',
  priorite TEXT,
  assigned_to UUID REFERENCES membres(id),
  etat TEXT,
  msgs JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commandes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref TEXT,
  client_nom TEXT,
  client_email TEXT,
  marche TEXT,
  produits JSONB,
  montant NUMERIC,
  transporteur TEXT,
  tracking TEXT,
  statut TEXT,
  date_commande DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS produits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  type TEXT,
  gamme TEXT,
  stock INT DEFAULT 0,
  stock_min INT DEFAULT 0,
  cout_prod NUMERIC,
  prix_base NUMERIC,
  reduc1 NUMERIC,
  reduc2 NUMERIC,
  units_vendus INT DEFAULT 0,
  ca NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT,
  nom TEXT,
  email TEXT,
  tel TEXT,
  marche TEXT,
  type_cheveux TEXT,
  cmds INT DEFAULT 0,
  total_depense NUMERIC DEFAULT 0,
  last_cmd DATE,
  note TEXT,
  historique JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS finances_mois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mois INT NOT NULL CHECK (mois >= 1 AND mois <= 12),
  annee INT NOT NULL,
  ca NUMERIC DEFAULT 0,
  alimente NUMERIC DEFAULT 0,
  pockets JSONB DEFAULT '{}',
  depenses JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mois, annee)
);

CREATE TABLE IF NOT EXISTS projets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  icon TEXT,
  desc TEXT,
  marche TEXT,
  deadline DATE,
  statut TEXT,
  color TEXT,
  membres JSONB DEFAULT '[]',
  progress INT DEFAULT 0,
  createur UUID REFERENCES membres(id),
  kanban JSONB DEFAULT '{"todo":[],"inprogress":[],"done":[]}',
  fichiers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS influenceurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT,
  plateforme TEXT,
  abonnes INT,
  statut TEXT,
  type_partenariat TEXT,
  niche TEXT,
  marche TEXT,
  colis_envoye BOOLEAN DEFAULT FALSE,
  contenus_publies INT DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS posts_cm (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT,
  plateforme TEXT,
  type TEXT,
  date_publication DATE,
  heure TEXT,
  marche JSONB DEFAULT '[]',
  assign TEXT,
  statut TEXT,
  rappel TEXT,
  note TEXT,
  media_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  type TEXT,
  plateforme TEXT,
  statut TEXT,
  auteur TEXT,
  tags JSONB DEFAULT '[]',
  desc TEXT,
  fichier_url TEXT,
  taille BIGINT,
  post_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  type TEXT,
  date DATE NOT NULL,
  heure TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conv_id UUID NOT NULL,
  from_id UUID REFERENCES membres(id),
  texte TEXT,
  fichier_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES membres(id) ON DELETE CASCADE,
  type TEXT,
  titre TEXT,
  desc TEXT,
  canal TEXT,
  read BOOLEAN DEFAULT FALSE,
  action TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_configuration (
  id TEXT PRIMARY KEY DEFAULT 'default',
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS idx_tickets_sav_updated ON tickets_sav(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conv_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Realtime (à activer dans le dashboard Supabase > Database > Replication si besoin)
-- ALTER PUBLICATION supabase_realtime ADD TABLE tickets_sav;
-- ALTER PUBLICATION supabase_realtime ADD TABLE messages;
-- ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Helpers RLS
CREATE OR REPLACE FUNCTION public.membre_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM membres WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_gerant()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM membres WHERE auth_user_id = auth.uid() AND role = 'gerant');
$$;

-- RLS
ALTER TABLE membres ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_sav ENABLE ROW LEVEL SECURITY;
ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;
ALTER TABLE produits ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE finances_mois ENABLE ROW LEVEL SECURITY;
ALTER TABLE projets ENABLE ROW LEVEL SECURITY;
ALTER TABLE influenceurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts_cm ENABLE ROW LEVEL SECURITY;
ALTER TABLE medias ENABLE ROW LEVEL SECURITY;
ALTER TABLE agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_configuration ENABLE ROW LEVEL SECURITY;

-- Membres : lecture pour authentifiés appartenant à la table ; écriture gérant ou soi
CREATE POLICY membres_select ON membres FOR SELECT TO authenticated
  USING (true);
CREATE POLICY membres_update_self ON membres FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_gerant());

CREATE POLICY membres_insert_gerant ON membres FOR INSERT TO authenticated
  WITH CHECK (public.is_gerant());

-- Tickets SAV
CREATE POLICY sav_all ON tickets_sav FOR ALL TO authenticated
  USING (
    public.is_gerant()
    OR public.membre_role() = 'sav'::user_role
    OR public.membre_role() = 'marketing'::user_role
  )
  WITH CHECK (
    public.is_gerant()
    OR public.membre_role() = 'sav'::user_role
  );

-- Commandes
CREATE POLICY cmd_read ON commandes FOR SELECT TO authenticated
  USING (
    public.is_gerant()
    OR public.membre_role() IN ('sav'::user_role, 'logistique'::user_role, 'marketing'::user_role, 'cm'::user_role)
  );
CREATE POLICY cmd_write ON commandes FOR INSERT TO authenticated
  WITH CHECK (public.is_gerant() OR public.membre_role() IN ('logistique'::user_role, 'marketing'::user_role));
CREATE POLICY cmd_update ON commandes FOR UPDATE TO authenticated
  USING (public.is_gerant() OR public.membre_role() IN ('logistique'::user_role, 'marketing'::user_role));

-- Produits
CREATE POLICY prod_all ON produits FOR ALL TO authenticated
  USING (public.is_gerant() OR public.membre_role() IN ('logistique'::user_role, 'marketing'::user_role))
  WITH CHECK (public.is_gerant() OR public.membre_role() IN ('logistique'::user_role, 'marketing'::user_role));

-- Clients CRM (SAV, Marketing, CM)
CREATE POLICY clients_crm ON clients FOR ALL TO authenticated
  USING (
    public.is_gerant()
    OR public.membre_role() IN ('sav'::user_role, 'marketing'::user_role, 'cm'::user_role)
  )
  WITH CHECK (
    public.is_gerant()
    OR public.membre_role() IN ('sav'::user_role, 'marketing'::user_role, 'cm'::user_role)
  );

-- Finances : gérant principalement
CREATE POLICY fin_read ON finances_mois FOR SELECT TO authenticated
  USING (public.is_gerant() OR public.membre_role() = 'marketing'::user_role);
CREATE POLICY fin_write ON finances_mois FOR ALL TO authenticated
  USING (public.is_gerant())
  WITH CHECK (public.is_gerant());

-- Projets
CREATE POLICY proj_all ON projets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Influenceurs
CREATE POLICY inf_all ON influenceurs FOR ALL TO authenticated
  USING (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role))
  WITH CHECK (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role));

-- CM
CREATE POLICY posts_cm_all ON posts_cm FOR ALL TO authenticated
  USING (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role))
  WITH CHECK (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role));

CREATE POLICY medias_all ON medias FOR ALL TO authenticated
  USING (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role))
  WITH CHECK (public.is_gerant() OR public.membre_role() IN ('marketing'::user_role, 'cm'::user_role));

-- Agenda
CREATE POLICY agenda_all ON agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Messages équipe
CREATE POLICY msg_all ON messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notifications : sa propre ligne
CREATE POLICY notif_own ON notifications FOR ALL TO authenticated
  USING (
    user_id IN (SELECT id FROM membres WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM membres WHERE auth_user_id = auth.uid())
  );

-- Config admin
CREATE POLICY cfg_read ON app_configuration FOR SELECT TO authenticated USING (true);
CREATE POLICY cfg_write ON app_configuration FOR ALL TO authenticated
  USING (public.is_gerant()) WITH CHECK (public.is_gerant());

-- Trigger updated_at tickets_sav
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_sav_updated ON tickets_sav;
CREATE TRIGGER trg_tickets_sav_updated
  BEFORE UPDATE ON tickets_sav
  FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
