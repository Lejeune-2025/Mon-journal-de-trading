/**
 * Sync cloud (Vercel Postgres / Neon) — obligatoire en HTTPS pour enregistrer.
 * Local cache + sync bidirectionnelle entre appareils.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'tradingJournalPro_cloud';
  const MAX_PUSH_BYTES = 4_200_000;

  let hooks = null;
  let pushTimer = null;
  let pushing = false;

  function getConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function isWebContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  /** Cloud obligatoire pour la sauvegarde sur le site déployé (Vercel). */
  function isRequired() {
    return isWebContext();
  }

  function isEnabled() {
    const c = getConfig();
    return Boolean(c?.enabled && c.accountId && c.secret);
  }

  function apiUrl(path) {
    return new URL(path, location.origin).toString();
  }

  function normalizeCredentials(accountIdRaw, secretRaw) {
    let accountId = String(accountIdRaw || '').trim();
    let secret = String(secretRaw || '').trim();
    const blob = `${accountId}\n${secret}`;

    const idMatch = blob.match(/acc_[a-f0-9]{24}/i);
    if (idMatch) accountId = idMatch[0].toLowerCase();

    const lines = blob.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const lineId = line.match(/acc_[a-f0-9]{24}/i);
      if (lineId) accountId = lineId[0].toLowerCase();
      else if (
        line.length >= 16
        && !line.toLowerCase().includes('identifiant')
        && !line.toLowerCase().includes('acc_')
      ) {
        secret = line;
      }
    }

    return { accountId, secret };
  }

  function payloadHasData(payload) {
    if (!payload) return false;
    const users = payload.users || [];
    if (!users.length) return false;
    const userData = payload.userData || {};
    return Object.keys(userData).some((uid) => {
      const block = userData[uid];
      if (!block) return false;
      return (block.trades && block.trades.length > 0)
        || block.profile?.traderName
        || (block.personalNotes && block.personalNotes.length > 0);
    });
  }

  async function verifyRemote(accountId, secret) {
    const res = await fetch(apiUrl('/api/account/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, secret })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Erreur ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function apiFetch(path, options = {}) {
    const cfg = getConfig();
    if (!cfg?.secret) throw new Error('Compte cloud non configuré');
    const headers = {
      'Content-Type': 'application/json',
      'X-Sync-Secret': cfg.secret,
      ...(options.headers || {})
    };
    const res = await fetch(apiUrl(path), { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Erreur ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function updateStatus(text, type) {
    const el = document.getElementById('cloudSyncStatus');
    if (!el) return;
    el.textContent = text;
    el.className = 'cloud-sync-status' + (type ? ` cloud-sync-status--${type}` : '');
  }

  function refreshUI() {
    const cfg = getConfig();
    const enabled = isEnabled();
    const panel = document.getElementById('cloudSyncPanel');
    const creds = document.getElementById('cloudSyncCredentials');
    const linkForm = document.getElementById('cloudLinkForm');
    const createForm = document.getElementById('cloudCreateForm');
    const disableBtn = document.getElementById('cloudDisableBtn');

    if (panel) panel.classList.toggle('hidden', !isWebContext());
    if (creds) creds.classList.toggle('hidden', !enabled);
    if (linkForm) linkForm.classList.toggle('hidden', enabled);
    if (createForm) createForm.classList.toggle('hidden', enabled);
    if (disableBtn) disableBtn.classList.toggle('hidden', isRequired());

    const idEl = document.getElementById('cloudAccountIdDisplay');
    const lastEl = document.getElementById('cloudLastSync');
    if (idEl && cfg?.accountId) idEl.textContent = cfg.accountId;
    if (lastEl) {
      lastEl.textContent = cfg?.lastSyncedAt
        ? `Dernière sync : ${new Date(cfg.lastSyncedAt).toLocaleString('fr-FR')}`
        : 'Pas encore synchronisé';
    }

    if (!isWebContext()) {
      updateStatus('Mode local (file://) — cloud disponible uniquement en HTTPS.', 'muted');
    } else if (!enabled) {
      updateStatus('Compte cloud obligatoire — créez un compte sur le 1er appareil, puis liez les autres.', 'warn');
    } else {
      updateStatus('Compte cloud actif — vos données sont synchronisées entre appareils.', 'ok');
    }
  }

  async function createAccount(label) {
    const res = await fetch(apiUrl('/api/account/create'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label || 'Mon journal' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Création impossible');

    const cfg = {
      enabled: true,
      accountId: data.accountId,
      secret: data.secret,
      label: data.label,
      lastSyncedAt: null,
      localUpdatedAt: null
    };
    saveConfig(cfg);
    refreshUI();
    return data;
  }

  async function linkAccount(accountIdRaw, secretRaw) {
    const { accountId, secret } = normalizeCredentials(accountIdRaw, secretRaw);
    if (!accountId || !secret) throw new Error('Identifiant et code secret requis');
    if (!/^acc_[a-f0-9]{24}$/.test(accountId)) {
      throw new Error('Identifiant invalide. Copiez uniquement la ligne acc_…');
    }

    await verifyRemote(accountId, secret);

    saveConfig({
      enabled: true,
      accountId,
      secret,
      label: '',
      lastSyncedAt: null,
      localUpdatedAt: null
    });
    refreshUI();
  }

  async function push(silent) {
    if (!isEnabled() || !hooks?.buildPayload || pushing) return false;
    pushing = true;
    try {
      const payload = await hooks.buildPayload();
      const json = JSON.stringify(payload);
      if (json.length > MAX_PUSH_BYTES) {
        if (!silent) {
          updateStatus('Sauvegarde trop lourde (captures). Réduisez le nombre d’images.', 'warn');
        }
        return false;
      }
      const cfg = getConfig();
      await apiFetch(`/api/account/${encodeURIComponent(cfg.accountId)}`, {
        method: 'PUT',
        body: JSON.stringify({ payload, label: cfg.label })
      });
      cfg.lastSyncedAt = new Date().toISOString();
      cfg.localUpdatedAt = payload.updatedAt;
      saveConfig(cfg);
      if (!silent) updateStatus('Synchronisé avec le cloud.', 'ok');
      refreshUI();
      return true;
    } catch (err) {
      console.error(err);
      if (!silent) {
        updateStatus(err.message || 'Échec de la synchronisation', 'error');
      }
      return false;
    } finally {
      pushing = false;
    }
  }

  async function syncFromServer(opts = {}) {
    if (!isEnabled() || !hooks?.applyPayload) return { applied: false };

    try {
      const cfg = getConfig();
      const remote = await apiFetch(`/api/account/${encodeURIComponent(cfg.accountId)}`, { method: 'GET' });
      const remotePayload = remote.payload;
      const remoteAt = remotePayload?.updatedAt || remote.updatedAt;
      const localAt = cfg.localUpdatedAt;
      const remoteHasData = payloadHasData(remotePayload);

      if (!remoteHasData) {
        const pushed = await push(true);
        if (!pushed && !opts.silent) {
          updateStatus('Aucune donnée sur le cloud. Sur le 1er appareil : créez le compte puis « Envoyer vers le cloud ».', 'warn');
        }
        return { applied: false, reason: 'empty-remote' };
      }

      if (!opts.force && localAt && remoteAt && new Date(localAt) >= new Date(remoteAt)) {
        await push(true);
        return { applied: false, reason: 'local-newer' };
      }

      await hooks.applyPayload(remotePayload, { fromCloud: true });
      cfg.lastSyncedAt = new Date().toISOString();
      cfg.localUpdatedAt = remoteAt;
      saveConfig(cfg);
      updateStatus('Données récupérées depuis le cloud.', 'ok');
      refreshUI();
      hooks.onApplied?.();
      return { applied: true };
    } catch (err) {
      console.error(err);
      if (err.status === 404) {
        updateStatus('Compte introuvable — vérifiez l’identifiant (acc_…). Ne recréez pas un compte sur le 2e appareil.', 'error');
      } else if (err.status === 403) {
        updateStatus('Code secret incorrect — copiez-le sans espace ni texte en plus.', 'error');
      } else if (err.status !== 503) {
        updateStatus(err.message || 'Impossible de charger le cloud', 'error');
      }
      return { applied: false, error: err };
    }
  }

  function schedulePush() {
    if (!isEnabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(true), 1200);
  }

  function requireForSave() {
    if (!isRequired()) return true;
    return isEnabled();
  }

  function configure(h) {
    hooks = h;
  }

  function initUI() {
    refreshUI();

    document.getElementById('cloudCreateBtn')?.addEventListener('click', async () => {
      const label = document.getElementById('cloudCreateLabel')?.value?.trim();
      const btn = document.getElementById('cloudCreateBtn');
      try {
        if (btn) btn.disabled = true;
        const data = await createAccount(label);
        const pushed = await push(false);
        if (!pushed) {
          updateStatus('Compte créé mais envoi impossible. Réessayez « Envoyer vers le cloud ».', 'warn');
        } else {
          alert(
            'Compte cloud créé.\n\n' +
            'Étape 1 — Sur cet appareil : terminé.\n' +
            'Étape 2 — Sur l’autre appareil (téléphone ou PC) :\n' +
            '• Ouvrez Sync\n' +
            '• Cliquez « Lier cet appareil » (ne pas recréer un compte)\n' +
            '• Collez exactement :\n\n' +
            `Identifiant :\n${data.accountId}\n\n` +
            `Code secret :\n${data.secret}`
          );
        }
      } catch (e) {
        updateStatus(e.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById('cloudLinkBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('cloudLinkBtn');
      try {
        if (btn) btn.disabled = true;
        updateStatus('Vérification des identifiants…', 'muted');
        await linkAccount(
          document.getElementById('cloudLinkId')?.value,
          document.getElementById('cloudLinkSecret')?.value
        );
        const result = await syncFromServer({ force: true });
        if (result.applied) {
          await push(true);
          updateStatus('Appareil lié et synchronisé.', 'ok');
        } else if (result.reason === 'local-newer') {
          updateStatus('Données locales plus récentes — envoyées vers le cloud.', 'ok');
        } else {
          updateStatus('Compte lié. Si le cloud était vide, utilisez « Envoyer » sur le 1er appareil.', 'warn');
        }
      } catch (e) {
        updateStatus(e.message, 'error');
      } finally {
        if (btn) btn.disabled = false;
      }
    });

    document.getElementById('cloudPushBtn')?.addEventListener('click', () => push(false));
    document.getElementById('cloudPullBtn')?.addEventListener('click', () => syncFromServer({ force: true }));

    document.getElementById('cloudCopyCredsBtn')?.addEventListener('click', () => {
      const cfg = getConfig();
      if (!cfg) return;
      const text = `Identifiant cloud:\n${cfg.accountId}\n\nCode secret:\n${cfg.secret}`;
      navigator.clipboard?.writeText(text).then(() => updateStatus('Identifiants copiés (2 lignes).', 'ok'));
    });

    document.getElementById('cloudDisableBtn')?.addEventListener('click', () => {
      if (isRequired()) {
        updateStatus('Le compte cloud est obligatoire sur le site — impossible de désactiver.', 'warn');
        return;
      }
      if (!confirm('Désactiver la synchro cloud sur cet appareil uniquement ?')) return;
      localStorage.removeItem(STORAGE_KEY);
      refreshUI();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && isEnabled()) push(true);
    });
  }

  global.CloudSync = {
    configure,
    initUI,
    isWebContext,
    isRequired,
    isEnabled,
    getConfig,
    createAccount,
    linkAccount,
    push,
    syncFromServer,
    pull: syncFromServer,
    schedulePush,
    requireForSave,
    refreshUI
  };
})(typeof window !== 'undefined' ? window : globalThis);
