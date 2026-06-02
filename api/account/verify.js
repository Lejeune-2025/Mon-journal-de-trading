import { ensureSchema, isDbConfigured } from '../lib/schema.js';
import { verifySecret } from '../lib/crypto.js';
import { readJson, sendJson } from '../lib/http.js';
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });

  if (!isDbConfigured()) {
    return sendJson(res, 503, { error: 'Base de données non configurée' });
  }

  try {
    await ensureSchema();
    const body = await readJson(req);
    const accountId = String(body.accountId || '').trim().toLowerCase();
    const secret = String(body.secret || '').trim();

    if (!accountId || !secret) {
      return sendJson(res, 400, { error: 'Identifiant et code secret requis' });
    }

    if (!/^acc_[a-f0-9]{24}$/i.test(accountId)) {
      return sendJson(res, 400, { error: 'Format d’identifiant invalide (ex. acc_abc123…)' });
    }

    const { rows } = await sql`
      SELECT account_id, secret_hash, label
      FROM journal_accounts
      WHERE account_id = ${accountId}
      LIMIT 1
    `;

    if (!rows.length) {
      return sendJson(res, 404, { error: 'Compte cloud introuvable — vérifiez l’identifiant copié' });
    }

    if (!verifySecret(secret, rows[0].secret_hash)) {
      return sendJson(res, 403, { error: 'Code secret incorrect' });
    }

    return sendJson(res, 200, {
      ok: true,
      accountId: rows[0].account_id,
      label: rows[0].label
    });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Erreur serveur', detail: err.message });
  }
}
