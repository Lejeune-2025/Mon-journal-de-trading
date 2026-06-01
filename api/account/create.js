import { sql } from '@vercel/postgres';
import { ensureSchema, isDbConfigured } from '../lib/schema.js';
import { hashSecret, newAccountId, newSecret } from '../lib/crypto.js';
import { readJson, sendJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return sendJson(res, 503, {
      error: 'Base de données non configurée',
      hint: 'Ajoutez Vercel Postgres (Neon) au projet et POSTGRES_URL dans les variables d’environnement.'
    });
  }

  try {
    await ensureSchema();
    const body = await readJson(req);
    const label = String(body.label || 'Mon journal').slice(0, 120);
    const accountId = newAccountId();
    const secret = newSecret();
    const secretHash = hashSecret(secret);
    const emptyPayload = {
      version: 2,
      users: [],
      currentUserId: null,
      userData: {},
      images: {},
      updatedAt: new Date().toISOString()
    };

    await sql`
      INSERT INTO journal_accounts (account_id, secret_hash, label, payload, updated_at)
      VALUES (${accountId}, ${secretHash}, ${label}, ${JSON.stringify(emptyPayload)}::jsonb, NOW())
    `;

    return sendJson(res, 201, {
      accountId,
      secret,
      label,
      message: 'Compte cloud créé. Conservez l’identifiant et le code secret.'
    });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Erreur serveur', detail: err.message });
  }
}
