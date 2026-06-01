-- Vercel Postgres (Neon) — exécuter une fois dans le SQL Editor du dashboard Vercel/Neon
CREATE TABLE IF NOT EXISTS journal_accounts (
  account_id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_accounts_updated_idx ON journal_accounts (updated_at DESC);
