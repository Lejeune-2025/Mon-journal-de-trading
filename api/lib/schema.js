import { sql } from '@vercel/postgres';

let ready = false;

export async function ensureSchema() {
  if (ready) return;
  await sql`
    CREATE TABLE IF NOT EXISTS journal_accounts (
      account_id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS journal_accounts_updated_idx
    ON journal_accounts (updated_at DESC)
  `;
  ready = true;
}

export function isDbConfigured() {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}
