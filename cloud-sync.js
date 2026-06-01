/**
 * Sync cloud optionnelle (Vercel Postgres / Neon).
 * Le journal reste utilisable hors ligne via localStorage + IndexedDB.
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

  function isEnabled() {
    const c = getConfig();
    return Boolean(c?.enabled && c.accountId && c.secret);
  }

  function isWebContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function apiUrl(path) {
    return new URL(path, location.origin).toString();
  }

  async function apiFetch(path, options = {}) {
    const cfg = getConfig();
    if (!cfg?.secret) throw new Error('Sync non configurée');
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

    if (panel) panel.classList.toggle('hidden', !isWebContext());
    if (creds) creds.classList.toggle('hidden', !enabled);
    if (linkForm) linkForm.classList.toggle('hidden', enabled);
    if (createForm) createForm.classList.toggle('hidden', enabled);

    const idEl = document.getElementById('cloudAccountIdDisplay');
    const lastEl = document.getElementById('cloudLastSync');
    if (idEl && cfg?.accountId) idEl.textContent = cfg.accountId;
    if (lastEl) {
      lastEl.textContent = cfg?.lastSyncedAt
        ? `Dernière sync : ${new Date(cfg.lastSyncedAt).toLocaleString('fr-FR')}`
        : 'Pas encore synchronisé';
    }

    if (!isWebContext()) {
      updateStatus('Sync cloud disponible uniquement en HTTPS (Vercel ou localhost).', 'muted');
    } else if (enabled) {
      updateStatus('Sync cloud active — sauvegarde automatique après chaque modification.', 'ok');
    } else {
      updateStatus('Sync cloud désactivée — données uniquement sur cet appareil.', 'muted');
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

    saveConfig({
      enabled: true,
      accountId: data.accountId,
      secret: data.secret,
      label: data.label,
      lastSyncedAt: null
    });
    refreshUI();
    return data;
  }

  function linkAccount(accountId, secret) {
    const id = String(accountId || '').trim();
    const sec = String(secret || '').trim();
    if (!id || !sec) throw new Error('Identifiant et code secret requis');
    saveConfig({
      enabled: true,
      accountId: id,
      secret: sec,
      label: '',
      lastSyncedAt: null
    });
    refreshUI();
  }

  function disableCloud() {
    localStorage.removeItem(STORAGE_KEY);
    refreshUI();
  }

  async function push(silent) {
    if (!isEnabled() || !hooks?.buildPayload || pushing) return;
    pushing = true;
    try {
      const payload = await hooks.buildPayload();
      const json = JSON.stringify(payload);
      if (json.length > MAX_PUSH_BYTES) {
        if (!silent) {
          updateStatus('Sauvegarde trop lourde (captures). Exportez en JSON ou supprimez des images.', 'warn');
        }
        return;
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
    } catch (err) {
      console.error(err);
      if (!silent) {
        updateStatus(err.message || 'Échec de la synchronisation', 'error');
      }
    } finally {
      pushing = false;
    }
  }

  async function pull(opts = {}) {
    if (!isEnabled() || !hooks?.applyPayload) return { applied: false };
    try {
      const cfg = getConfig();
      const remote = await apiFetch(`/api/account/${encodeURIComponent(cfg.accountId)}`, { method: 'GET' });
      const remotePayload = remote.payload;
      const remoteAt = remotePayload?.updatedAt || remote.updatedAt;
      const localAt = cfg.localUpdatedAt;

      // Sécurité “source-of-truth” : si on n'a jamais synchronisé localement (localUpdatedAt absent),
      // éviter d'écraser les données locales avec un payload remote potentiellement vide.
      if (!opts.force && !localAt) {
        await push(true);
        return { applied: false, reason: 'pushed-local-first' };
      }

      if (!opts.force && localAt && remoteAt && new Date(localAt) >= new Date(remoteAt)) {
        await push(true);
        return { applied: false, reason: 'local-newer' };
      }

      await hooks.applyPayload(remotePayload, { fromCloud: true });
      cfg.lastSyncedAt = new Date().toISOString();
      cfg.localUpdatedAt = remoteAt;
      saveConfig(cfg);
      updateStatus('Données chargées depuis le cloud.', 'ok');
      refreshUI();
      hooks.onApplied?.();
      return { applied: true };
    } catch (err) {
      console.error(err);
      if (err.status === 404 || err.status === 403) {
        updateStatus('Compte cloud invalide — vérifiez identifiant et secret.', 'error');
      } else if (err.status !== 503) {
        updateStatus(err.message || 'Impossible de charger le cloud', 'error');
      }
      return { applied: false, error: err };
    }
  }

  function schedulePush() {
    if (!isEnabled()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push(true), 2000);
  }

  function configure(h) {
    hooks = h;
  }

  function initUI() {
    refreshUI();

    document.getElementById('cloudCreateBtn')?.addEventListener('click', async () => {
      const label = document.getElementById('cloudCreateLabel')?.value?.trim();
      try {
        const data = await createAccount(label);
        await push(false);
        alert(
          'Compte cloud créé et données envoyées.\n\n' +
          'Le profil trader, les trades et les captures de cet appareil ont été sauvegardés dans le cloud.\n\n' +
          `Identifiant : ${data.accountId}\n` +
          `Code secret : ${data.secret}\n\n` +
          'Copiez ces informations pour les utiliser sur un autre appareil.'
        );
      } catch (e) {
        updateStatus(e.message, 'error');
      }
    });

    document.getElementById('cloudLinkBtn')?.addEventListener('click', async () => {
      try {
        linkAccount(
          document.getElementById('cloudLinkId')?.value,
          document.getElementById('cloudLinkSecret')?.value
        );
        await pull({ force: true });
        await push(false);
      } catch (e) {
        updateStatus(e.message, 'error');
      }
    });

    document.getElementById('cloudPushBtn')?.addEventListener('click', () => push(false));
    document.getElementById('cloudPullBtn')?.addEventListener('click', () => pull({ force: true }));

    document.getElementById('cloudDisableBtn')?.addEventListener('click', async () => {
      const ok = confirm('Désactiver la sync cloud sur cet appareil ? Les données locales restent intactes.');
      if (ok) disableCloud();
    });

    document.getElementById('cloudCopyCredsBtn')?.addEventListener('click', () => {
      const cfg = getConfig();
      if (!cfg) return;
      const text = `Identifiant : ${cfg.accountId}\nCode secret : ${cfg.secret}`;
      navigator.clipboard?.writeText(text).then(() => updateStatus('Identifiants copiés.', 'ok'));
    });
  }

  global.CloudSync = {
    configure,
    initUI,
    isEnabled,
    getConfig,
    createAccount,
    linkAccount,
    disableCloud,
    push,
    pull,
    schedulePush,
    refreshUI
  };
})(typeof window !== 'undefined' ? window : globalThis);
