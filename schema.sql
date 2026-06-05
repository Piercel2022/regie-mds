-- ═══════════════════════════════════════════════════════════════════════════
-- MOUSSA STUDIO — Ad Platform Schema
-- À coller dans Supabase > SQL Editor > New query > Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Annonceurs ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS advertisers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Campagnes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_id  UUID REFERENCES advertisers(id) ON DELETE SET NULL,
  name           TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','paused','completed')),
  placement      TEXT NOT NULL
                   CHECK (placement IN ('newsletter','blog_sidebar','template','youtube','default')),
  start_date     DATE,
  end_date       DATE,
  budget_eur     NUMERIC(10,2),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ── Créatifs ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS creatives (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  image_url    TEXT NOT NULL,
  click_url    TEXT NOT NULL,
  alt_text     TEXT DEFAULT 'Publicité',
  active       BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Événements (impressions + clics) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  creative_id  UUID REFERENCES creatives(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN ('impression','click')),
  placement    TEXT,
  page_url     TEXT,
  ip_hash      TEXT,     -- SHA-256 de l'IP brute — conformité RGPD
  user_agent   TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── Index pour les rapports (agrégations rapides) ───────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_campaign_type
  ON events(campaign_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_events_created
  ON events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_campaigns_status_placement
  ON campaigns(status, placement, start_date, end_date);

-- ── RLS — Row Level Security ─────────────────────────────────────────────────
-- On active RLS sur events pour que l'anon key ne puisse pas lire les données.
-- Les Functions utilisent la service_role key qui bypass le RLS.
ALTER TABLE events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE creatives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE advertisers ENABLE ROW LEVEL SECURITY;

-- Aucune politique = aucun accès via anon key. Seule la service key peut écrire/lire.
-- (Les Netlify Functions utilisent SUPABASE_SERVICE_KEY → accès total)

-- ── Données de test ──────────────────────────────────────────────────────────
-- Décommente pour insérer une campagne de démo

/*
INSERT INTO advertisers (name, email) VALUES
  ('Kit.com', 'partnerships@kit.com');

INSERT INTO campaigns (advertiser_id, name, status, placement, start_date, end_date, budget_eur)
VALUES (
  (SELECT id FROM advertisers WHERE email = 'partnerships@kit.com'),
  'Kit.com — Newsletter Juillet 2026',
  'active',
  'newsletter',
  '2026-07-01',
  '2026-07-31',
  200.00
);

INSERT INTO creatives (campaign_id, image_url, click_url, alt_text, active)
VALUES (
  (SELECT id FROM campaigns WHERE name = 'Kit.com — Newsletter Juillet 2026'),
  'https://TON-CDN/kit-banner.png',
  'https://kit.com/?ref=moussastudio',
  'Kit.com — Email marketing pour créateurs',
  true
);
*/