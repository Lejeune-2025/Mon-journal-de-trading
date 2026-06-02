import { sql } from '@vercel/postgres';
import { ensureSchema, isDbConfigured } from '../lib/schema.js';
import { verifySecret } from '../lib/crypto.js';
import { getSyncSecret, readJson, sendJson } from '../lib/http.js';

async function getAccount(accountId) {
  const { rows } = await sql`
    SELECT account_id, secret_hash, label, payload, updated_at
    FROM journal_accounts
    WHERE account_id = ${accountId}
    LIMIT 1
  `;
  return rows[0] || null;
}

export default async function handler(req, res) {
  const accountId = String(req.query?.accountId || '').trim().toLowerCase();
  if (!accountId) return sendJson(res, 400, { error: 'accountId requis' });
  if (!/^acc_[a-f0-9]{24}$/.test(accountId)) {
    return sendJson(res, 400, { error: 'Format d’identifiant invalide' });
  }

  if (!isDbConfigured()) {
    return sendJson(res, 503, { error: 'Base de données non configurée' });
  }

  const secret = getSyncSecret(req);
  if (!secret) return sendJson(res, 401, { error: 'Code secret manquant (en-tête X-Sync-Secret)' });

  try {
    await ensureSchema();
    const row = await getAccount(accountId);
    if (!row) return sendJson(res, 404, { error: 'Compte cloud introuvable' });
    if (!verifySecret(secret, row.secret_hash)) {
      return sendJson(res, 403, { error: 'Code secret incorrect' });
    }

    if (req.method === 'GET') {
      return sendJson(res, 200, {
        accountId: row.account_id,
        label: row.label,
        payload: row.payload,
        updatedAt: row.updated_at
      });
    }

    if (req.method === 'PUT') {
      const body = await readJson(req);
      if (!body.payload || typeof body.payload !== 'object') {
        return sendJson(res, 400, { error: 'payload requis' });
      }

      const payloadStr = JSON.stringify(body.payload);
      if (payloadStr.length > 4_500_000) {
        return sendJson(res, 413, {
          error: 'Sauvegarde trop volumineuse (captures incluses). Réduisez le nombre d’images ou exportez en JSON.'
        });
      }

      await sql`
        UPDATE journal_accounts
        SET payload = ${payloadStr}::jsonb,
            label = COALESCE(${body.label ? String(body.label).slice(0, 120) : null}, label),
            updated_at = NOW()
        WHERE account_id = ${accountId}
      `;

      const updated = await getAccount(accountId);
      return sendJson(res, 200, {
        ok: true,
        updatedAt: updated.updated_at
      });
    }

    if (req.method === 'DELETE') {
      await sql`DELETE FROM journal_accounts WHERE account_id = ${accountId}`;
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: 'Erreur serveur', detail: err.message });
  }
}
