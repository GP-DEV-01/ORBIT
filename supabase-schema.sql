-- Run this in your Supabase SQL Editor
-- Go to: Supabase Dashboard → SQL Editor → New Query

-- Portfolio table
CREATE TABLE IF NOT EXISTS portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'stock',
  quantity NUMERIC NOT NULL DEFAULT 0,
  avg_price NUMERIC NOT NULL DEFAULT 0,
  isin TEXT,
  position TEXT DEFAULT 'long',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, run these to add the new columns:
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS isin TEXT;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS position TEXT DEFAULT 'long';

-- Watchlist table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'stock',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol)
);

-- Row Level Security (RLS) - users can only see their own data
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own portfolio"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own watchlist"
  ON watchlists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- News comments table
CREATE TABLE IF NOT EXISTS news_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_url TEXT NOT NULL,
  article_headline TEXT NOT NULL,
  content TEXT NOT NULL,
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE news_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments"
  ON news_comments FOR SELECT USING (true);

CREATE POLICY "Users can insert own comments"
  ON news_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
  ON news_comments FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Net worth growth tracking + live export links
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- One row per user, day and currency: portfolio value and invested capital (cost basis).
-- Written by the dashboard while it is open; the last write of the day wins.
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  currency TEXT NOT NULL,
  value NUMERIC NOT NULL,
  cost NUMERIC NOT NULL,
  positions INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, date, currency)
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own snapshots" ON portfolio_snapshots;
CREATE POLICY "Users can manage their own snapshots"
  ON portfolio_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Secret token behind the live CSV links (Google Sheets IMPORTDATA / Excel "From Web").
-- Regenerating the token invalidates the old links; deleting the row disables them.
CREATE TABLE IF NOT EXISTS export_tokens (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  token TEXT NOT NULL UNIQUE CHECK (length(token) >= 32),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE export_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own export token" ON export_tokens;
CREATE POLICY "Users can manage their own export token"
  ON export_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- The feed route has no user session: these functions resolve the token server-side
-- and return only that user's rows. Nothing else is reachable with the anon key.
CREATE OR REPLACE FUNCTION feed_positions(p_token TEXT)
RETURNS SETOF portfolios
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM portfolios p
  JOIN export_tokens t ON t.user_id = p.user_id
  WHERE t.token = p_token AND length(p_token) >= 32
$$;

CREATE OR REPLACE FUNCTION feed_snapshots(p_token TEXT)
RETURNS SETOF portfolio_snapshots
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.* FROM portfolio_snapshots s
  JOIN export_tokens t ON t.user_id = s.user_id
  WHERE t.token = p_token AND length(p_token) >= 32
  ORDER BY s.currency, s.date
$$;

REVOKE ALL ON FUNCTION feed_positions(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION feed_snapshots(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION feed_positions(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION feed_snapshots(TEXT) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- PAC (piano di accumulo): recurring contributions on a position.
-- quantity / avg_price of a PAC row are derived from the plan and historical prices
-- (see lib/pac.ts) and re-synced by the dashboard when new instalments fall due.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS is_pac BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS pac_amount NUMERIC;          -- per instalment, in the instrument currency
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS pac_frequency TEXT;          -- monthly | bimonthly | quarterly | semiannual | annual
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS pac_start DATE;              -- first instalment; later ones fall on the same day of month
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS pac_end DATE;                -- optional
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS pac_initial NUMERIC DEFAULT 0; -- optional lump sum on the start date
