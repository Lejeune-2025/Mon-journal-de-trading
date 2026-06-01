(function () {
  'use strict';

  const STORAGE_PREFIX = 'tradingJournalPro_v1_';
  const DRAFT_PREFIX = 'tradingJournalPro_draft_v1_';
  const LEGACY_STORAGE_KEY = 'tradingJournalPro_v1';
  const LEGACY_DRAFT_KEY = 'tradingJournalPro_draft_v1';
  const USERS_KEY = 'tradingJournalPro_users';
  const CURRENT_USER_KEY = 'tradingJournalPro_currentUser';
  const IDB_NAME = 'tradingJournalPro_images';
  const IDB_STORE = 'screenshots';
  const SPLASH_MIN_MS = 900;
  const splashStart = performance.now();

  const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const defaultData = () => ({
    profile: {
      traderName: '',
      mainMarket: '',
      strategy: '',
      startingCapital: '',
      maxRisk: ''
    },
    trades: [],
    weeklyNotes: {},
    checklist: [false, false, false, false, false, false, false, false],
    personalNotes: ''
  });

  let data = defaultData();
  let currentUserId = null;
  let saveTimeout = null;
  let draftTimeout = null;
  let screenshotBefore = '';
  let screenshotAfter = '';
  let quickScreenshotTradeId = null;
  let dashboardChartScope = 'week';
  let deferredInstallPrompt = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const curr = () => window.TradingJournalCurrency;
  const formatMoney = (n) => curr().formatMoney(n);
  const formatMoneyUnsigned = (n) => curr().formatMoneyUnsigned(n);
  const formatMoneyAxis = (n, d) => curr().formatMoneyAxis(n, d);
  const withCurrency = (n) => curr().withCurrency(n);

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function storageKey() {
    return STORAGE_PREFIX + currentUserId;
  }

  function draftKey() {
    return DRAFT_PREFIX + currentUserId;
  }

  function imgKey(tradeId, target) {
    return `${currentUserId}:${tradeId}:${target}`;
  }

  function loadUsersRegistry() {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveUsersRegistry(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function getCurrentUser() {
    return loadUsersRegistry().find((u) => u.id === currentUserId) || null;
  }

  function migrateLegacyDataIfNeeded(users) {
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacy || users.length > 0) return users;
    try {
      const legacyData = JSON.parse(legacy);
      const userId = uid();
      const name = (legacyData.profile?.traderName || 'Trader').trim() || 'Trader';
      const user = { id: userId, name, createdAt: new Date().toISOString() };
      localStorage.setItem(STORAGE_PREFIX + userId, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const legacyDraft = localStorage.getItem(LEGACY_DRAFT_KEY);
      if (legacyDraft) {
        localStorage.setItem(DRAFT_PREFIX + userId, legacyDraft);
        localStorage.removeItem(LEGACY_DRAFT_KEY);
      }
      saveUsersRegistry([user]);
      localStorage.setItem(CURRENT_USER_KEY, userId);
      return [user];
    } catch {
      return users;
    }
  }

  function createUser(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const user = { id: uid(), name: trimmed, createdAt: new Date().toISOString() };
    const users = loadUsersRegistry();
    users.push(user);
    saveUsersRegistry(users);
    localStorage.setItem(STORAGE_PREFIX + user.id, JSON.stringify(defaultData()));
    return user;
  }

  async function purgeUserStorage(userId) {
    let userData;
    try {
      userData = JSON.parse(localStorage.getItem(STORAGE_PREFIX + userId) || '{}');
    } catch {
      userData = {};
    }
    const trades = userData.trades || [];
    await Promise.all(trades.flatMap((t) => [
      idbDelete(`${userId}:${t.id}:before`).catch(() => {}),
      idbDelete(`${userId}:${t.id}:after`).catch(() => {})
    ]));
    localStorage.removeItem(STORAGE_PREFIX + userId);
    localStorage.removeItem(DRAFT_PREFIX + userId);
  }

  async function deleteUser(userId) {
    const users = loadUsersRegistry();
    const user = users.find((u) => u.id === userId);
    if (!user) return;

    const isLast = users.length <= 1;
    const ok = await showConfirm(
      isLast
        ? `Supprimer « ${user.name} » et toutes ses données ? Vous devrez créer un nouveau profil.`
        : `Supprimer définitivement « ${user.name} » et tous ses trades ? Cette action est irréversible.`,
      { title: 'Supprimer le profil', confirmText: 'Supprimer', danger: true }
    );
    if (!ok) return;

    await purgeUserStorage(userId);
    const remaining = users.filter((u) => u.id !== userId);
    saveUsersRegistry(remaining);

    if (isLast) {
      currentUserId = null;
      localStorage.removeItem(CURRENT_USER_KEY);
      data = defaultData();
      renderProfilesList();
      showUserModal(true);
      showToast('Profil supprimé');
      return;
    }

    if (userId === currentUserId) {
      await activateUser(remaining[0].id);
    } else {
      renderProfilesList();
      showToast(`Profil « ${user.name} » supprimé`);
    }
  }

  function renderProfilesList() {
    const el = $('#profilesList');
    if (!el) return;
    const users = loadUsersRegistry();
    if (!users.length) {
      el.innerHTML = '<p class="empty-state">Aucun profil.</p>';
      return;
    }
    el.innerHTML = users.map((u) => `
      <div class="profile-row">
        <div class="profile-row-info">
          <span class="profile-row-name">${escapeHtml(u.name)}</span>
          ${u.id === currentUserId ? '<span class="badge badge-yes">Actif</span>' : ''}
          <span class="profile-row-date">Depuis ${new Date(u.createdAt).toLocaleDateString('fr-FR')}</span>
        </div>
        <div class="profile-row-actions">
          ${u.id !== currentUserId ? `<button type="button" class="btn btn-ghost btn-sm" data-activate-user="${escapeHtml(u.id)}">Activer</button>` : ''}
          <button type="button" class="btn btn-danger btn-sm" data-delete-user="${escapeHtml(u.id)}">Supprimer</button>
        </div>
      </div>
    `).join('');
  }

  function updateCurrentUserName(name) {
    const trimmed = name.trim();
    if (!trimmed || !currentUserId) return;
    const users = loadUsersRegistry();
    const idx = users.findIndex((u) => u.id === currentUserId);
    if (idx >= 0) {
      users[idx].name = trimmed;
      saveUsersRegistry(users);
      updateUserDisplay();
    }
  }

  function updateUserDisplay() {
    const user = getCurrentUser();
    const label = user?.name || '—';
    const el = $('#currentUserName');
    if (el) el.textContent = label;
    const info = $('#profileUserInfo');
    if (info && user) {
      const created = new Date(user.createdAt).toLocaleDateString('fr-FR');
      info.textContent = `Connecté en tant que ${user.name} — profil créé le ${created}. Vos données sont isolées des autres profils.`;
    }
    renderProfilesList();
  }

  function canCloseUserModal() {
    const modal = $('#userModal');
    if (modal?.dataset.force === '1') return false;
    return !!currentUserId;
  }

  function tryCloseUserModal() {
    if (canCloseUserModal()) hideUserModal();
  }

  function showUserModal(force = false) {
    const modal = $('#userModal');
    const users = loadUsersRegistry();
    const list = $('#userList');
    list.innerHTML = users.length
      ? users.map((u) => `
        <button type="button" class="user-list-item${u.id === currentUserId ? ' active' : ''}" data-user-id="${escapeHtml(u.id)}">
          <span class="user-list-name">${escapeHtml(u.name)}</span>
          <span class="user-list-date">Depuis ${new Date(u.createdAt).toLocaleDateString('fr-FR')}</span>
        </button>
      `).join('')
      : '<p class="empty-state">Aucun profil — créez le vôtre ci-dessous.</p>';
    modal.classList.add('open');
    document.body.classList.add('modal-open');
    if (force) modal.dataset.force = '1';
    else delete modal.dataset.force;
    const closable = !force && !!currentUserId;
    $('#userModalClose').hidden = !closable;
    $('#userModalCancel').hidden = !closable;
    setTimeout(() => $('#newUserName')?.focus(), 100);
  }

  function hideUserModal() {
    $('#userModal').classList.remove('open');
    document.body.classList.remove('modal-open');
    delete $('#userModal').dataset.force;
    $('#userModalClose').hidden = true;
    $('#userModalCancel').hidden = true;
  }

  async function activateUser(userId) {
    if (!userId) return;
    currentUserId = userId;
    localStorage.setItem(CURRENT_USER_KEY, userId);
    hideUserModal();
    await bootApp();
    showToast(`Profil « ${getCurrentUser()?.name || ''} » actif`);
  }

  async function switchToUser(userId) {
    if (userId === currentUserId) {
      hideUserModal();
      return;
    }
    await activateUser(userId);
  }

  function initUserModal() {
    $('#userList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-user-id]');
      if (btn) switchToUser(btn.dataset.userId);
    });

    $('#createUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#newUserName').value.trim();
      if (!name) return;
      const user = createUser(name);
      if (user) {
        $('#newUserName').value = '';
        await activateUser(user.id);
      }
    });

    $('#userBadge').addEventListener('click', () => showUserModal());
    $('#switchUserBtn').addEventListener('click', () => showUserModal());
    $('#createUserBtn').addEventListener('click', () => {
      showUserModal();
      $('#newUserName').focus();
    });

    $('#userModalClose').addEventListener('click', tryCloseUserModal);
    $('#userModalCancel').addEventListener('click', tryCloseUserModal);

    $('#userModal').addEventListener('click', (e) => {
      if (e.target.id === 'userModal') tryCloseUserModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#userModal')?.classList.contains('open')) {
        tryCloseUserModal();
      }
    });

    $('#profilesList')?.addEventListener('click', (e) => {
      const del = e.target.closest('[data-delete-user]');
      if (del) deleteUser(del.dataset.deleteUser);
      const act = e.target.closest('[data-activate-user]');
      if (act) switchToUser(act.dataset.activateUser);
    });

    $('#deleteCurrentProfileBtn')?.addEventListener('click', () => {
      if (currentUserId) deleteUser(currentUserId);
    });
  }

  function deepMerge(base, override) {
    if (!override || typeof override !== 'object') return base;
    const out = { ...base };
    for (const key of Object.keys(override)) {
      const val = override[key];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = deepMerge(base[key] || {}, val);
      } else if (val !== undefined) {
        out[key] = val;
      }
    }
    return out;
  }

  function openImageDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbSet(key, dataUrl) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || '');
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(key) {
    const db = await openImageDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function compressImage(dataUrl, maxWidth = 1200, quality = 0.82) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round(height * maxWidth / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function persistScreenshot(tradeId, target, dataUrl) {
    const key = imgKey(tradeId, target);
    if (dataUrl) {
      const compressed = await compressImage(dataUrl);
      await idbSet(key, compressed);
      return true;
    }
    await idbDelete(key);
    return false;
  }

  async function loadScreenshot(tradeId, target) {
    return idbGet(imgKey(tradeId, target));
  }

  async function hydrateTradesForExport(trades) {
    return Promise.all(trades.map(async (t) => {
      const copy = { ...t };
      if (t.screenshotBefore?.startsWith?.('data:')) {
        copy.screenshotBefore = t.screenshotBefore;
      } else {
        copy.screenshotBefore = t.hasScreenshotBefore ? await loadScreenshot(t.id, 'before') : '';
      }
      if (t.screenshotAfter?.startsWith?.('data:')) {
        copy.screenshotAfter = t.screenshotAfter;
      } else {
        copy.screenshotAfter = t.hasScreenshotAfter ? await loadScreenshot(t.id, 'after') : '';
      }
      return copy;
    }));
  }

  async function migrateLegacyScreenshots() {
    let changed = false;
    for (const trade of data.trades) {
      for (const [field, target] of [['screenshotBefore', 'before'], ['screenshotAfter', 'after']]) {
        const val = trade[field];
        if (val && typeof val === 'string' && val.startsWith('data:')) {
          const compressed = await compressImage(val);
          await idbSet(imgKey(trade.id, target), compressed);
          trade[`hasScreenshot${target === 'before' ? 'Before' : 'After'}`] = true;
          delete trade[field];
          changed = true;
        }
      }
    }
    if (changed) saveData();
  }

  const sectionTitles = {
    dashboard: 'Tableau de bord',
    profile: 'Profil trader',
    'new-trade': 'Nouveau trade',
    trades: 'Historique des trades',
    weekly: 'Analyse hebdomadaire',
    checklist: 'Checklist pré-trade',
    notes: 'Notes personnelles',
    sync: 'Sync mobile'
  };

  function loadData() {
    if (!currentUserId) return defaultData();
    try {
      const raw = localStorage.getItem(storageKey());
      const loaded = raw ? deepMerge(defaultData(), JSON.parse(raw)) : defaultData();
      return stripExportMeta(loaded);
    } catch {
      return defaultData();
    }
  }

  function saveData() {
    if (!currentUserId) return;
    try {
      const clean = stripExportMeta({ ...data });
      localStorage.setItem(storageKey(), JSON.stringify(clean));
      flashSaveIndicator();
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        showToast('Espace de stockage saturé — exportez une sauvegarde JSON');
      } else {
        showToast('Erreur de sauvegarde');
      }
      console.error(err);
    }
  }

  function debouncedSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveData, 400);
  }

  function flashSaveIndicator() {
    const el = $('#saveIndicator');
    el.textContent = 'Sauvegardé automatiquement';
    el.style.color = 'var(--primary)';
    setTimeout(() => { el.textContent = 'Données conservées localement'; el.style.color = ''; }, 2000);
  }

  function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function hideSplash() {
    const remaining = SPLASH_MIN_MS - (performance.now() - splashStart);
    const delay = Math.max(0, remaining);
    setTimeout(() => {
      document.body.classList.add('app-ready');
      const splash = $('#splashScreen');
      if (splash) {
        splash.classList.add('fade-out');
        splash.setAttribute('aria-hidden', 'true');
        setTimeout(() => splash.remove(), 550);
      }
    }, delay);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function toLocalDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function stripExportMeta(obj) {
    const { exportVersion, userId, userName, ...rest } = obj;
    return rest;
  }

  function showConfirm(message, { title = 'Confirmation', confirmText = 'Confirmer', danger = false } = {}) {
    return new Promise((resolve) => {
      const modal = $('#confirmModal');
      const okBtn = $('#confirmModalOk');
      const cancelBtn = $('#confirmModalCancel');
      $('#confirmModalTitle').textContent = title;
      $('#confirmModalMessage').textContent = message;
      okBtn.textContent = confirmText;
      okBtn.className = danger ? 'btn btn-danger' : 'btn btn-primary';
      modal.classList.add('open');
      document.body.classList.add('modal-open');

      const done = (result) => {
        modal.classList.remove('open');
        if (!$('#userModal')?.classList.contains('open')) {
          document.body.classList.remove('modal-open');
        }
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        resolve(result);
      };
      okBtn.onclick = () => done(true);
      cancelBtn.onclick = () => done(false);
    });
  }

  function getCheckedValues(containerId) {
    return [...$$(`#${containerId} input:checked`)].map((cb) => cb.value);
  }

  function setCheckedValues(containerId, values) {
    $$(`#${containerId} input[type="checkbox"]`).forEach((cb) => {
      cb.checked = values.includes(cb.value);
    });
  }

  function calcPlannedRR(entry, sl, tp, direction) {
    if (!entry || !sl || !tp) return '';
    const risk = Math.abs(entry - sl);
    const reward = direction === 'Vente' ? entry - tp : tp - entry;
    if (risk === 0) return '';
    return (reward / risk).toFixed(2);
  }

  function calcActualRR(resultAmount, riskAmount) {
    if (!resultAmount || !riskAmount || parseFloat(riskAmount) === 0) return '';
    return (parseFloat(resultAmount) / parseFloat(riskAmount)).toFixed(2);
  }

  function updateComputedFields() {
    const entry = parseFloat($('#entryPrice').value);
    const sl = parseFloat($('#stopLoss').value);
    const tp = parseFloat($('#takeProfit').value);
    const direction = document.querySelector('input[name="direction"]:checked')?.value || 'Achat';
    const risk = parseFloat($('#riskAmount').value);
    const result = parseFloat($('#resultAmount').value);

    $('#plannedRR').value = calcPlannedRR(entry, sl, tp, direction);
    $('#actualRR').value = calcActualRR(result, risk);
  }

  function getWeekKey(dateStr) {
    return getWeekFromInput(dateToWeekInput(new Date(dateStr + 'T12:00:00'))).key;
  }

  function dateToWeekInput(date) {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    const dayNr = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dayNr + 3);
    const isoYear = d.getFullYear();
    const jan4 = new Date(isoYear, 0, 4);
    const jan4Day = (jan4.getDay() + 6) % 7;
    jan4.setDate(jan4.getDate() - jan4Day);
    const week = 1 + Math.round((d - jan4) / 604800000);
    return `${isoYear}-W${String(week).padStart(2, '0')}`;
  }

  function getWeekFromInput(weekVal) {
    if (!weekVal) return null;
    const [year, week] = weekVal.split('-W').map(Number);
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { start: monday, end: sunday, key: toLocalDateStr(monday) };
  }

  const CALENDAR_WEEK_KEY = 'tj_calendarWeek';

  function currentWeekInput() {
    const probe = document.createElement('input');
    probe.type = 'week';
    try {
      probe.valueAsDate = new Date();
      if (probe.value) return probe.value;
    } catch (_) { /* navigateurs anciens */ }
    return dateToWeekInput(new Date());
  }

  /** Passe à la semaine ISO en cours quand le calendrier change (nouvelle semaine). */
  function syncCalendarWeekInputs() {
    const cur = currentWeekInput();
    const prev = sessionStorage.getItem(CALENDAR_WEEK_KEY);
    const changed = prev !== cur;
    if (changed) sessionStorage.setItem(CALENDAR_WEEK_KEY, cur);
    const weeklyEl = $('#weeklyWeek');
    if (weeklyEl && (changed || !weeklyEl.value)) weeklyEl.value = cur;
    return { cur, changed };
  }

  function filterTradesByWeek(trades, weekVal) {
    const w = getWeekFromInput(weekVal);
    if (!w) return trades;
    const startStr = toLocalDateStr(w.start);
    const endStr = toLocalDateStr(w.end);
    return trades.filter((t) => t.date >= startStr && t.date <= endStr);
  }

  function filterTradesByDate(trades, dateVal) {
    if (!dateVal) return trades;
    return trades.filter((t) => t.date === dateVal);
  }

  function getCurrentWeekTrades() {
    return filterTradesByWeek(data.trades, currentWeekInput());
  }

  function getWeekDays(weekVal) {
    const w = getWeekFromInput(weekVal);
    if (!w) return [];
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(w.start);
      d.setDate(w.start.getDate() + i);
      days.push({
        date: toLocalDateStr(d),
        label: DAY_NAMES[i]
      });
    }
    return days;
  }

  function formatWeekRange(weekVal) {
    const w = getWeekFromInput(weekVal);
    if (!w) return '';
    const fmt = (d) => d.toLocaleDateString('fr-FR');
    return `${fmt(w.start)} → ${fmt(w.end)}`;
  }

  function computeKPIs(trades) {
    const total = trades.length;
    const winners = trades.filter((t) => parseFloat(t.resultAmount) > 0);
    const losers = trades.filter((t) => parseFloat(t.resultAmount) < 0);
    const breakeven = trades.filter((t) => parseFloat(t.resultAmount) === 0);

    const totalGains = winners.reduce((s, t) => s + parseFloat(t.resultAmount), 0);
    const totalLosses = Math.abs(losers.reduce((s, t) => s + parseFloat(t.resultAmount), 0));
    const net = totalGains - totalLosses;

    const winRate = total ? ((winners.length / total) * 100).toFixed(1) : '0.0';
    const avgWin = winners.length ? (totalGains / winners.length).toFixed(2) : '0.00';
    const avgLoss = losers.length ? (totalLosses / losers.length).toFixed(2) : '0.00';
    const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : totalGains > 0 ? '∞' : '0.00';

    const risks = trades.filter((t) => t.riskAmount).map((t) => parseFloat(t.riskAmount));
    const avgRisk = risks.length ? (risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(2) : '0.00';

    const rMultiples = trades.map((t) => calcActualRR(t.resultAmount, t.riskAmount)).filter(Boolean).map(Number);
    const avgR = rMultiples.length ? (rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length).toFixed(2) : '0.00';

    const planRespected = trades.filter((t) => t.planRespected === 'Oui').length;
    const planRate = total ? ((planRespected / total) * 100).toFixed(1) : '0.0';

    let running = parseFloat(data.profile.startingCapital) || 0;
    let peak = running;
    let maxDD = 0;
    const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach((t) => {
      running += parseFloat(t.resultAmount) || 0;
      if (running > peak) peak = running;
      const dd = peak - running;
      if (dd > maxDD) maxDD = dd;
    });

    return {
      total, winners: winners.length, losers: losers.length, breakeven: breakeven.length,
      winRate, totalGains, totalLosses, net, avgWin, avgLoss, profitFactor,
      avgRisk, avgR, maxDD, planRate,
      biggestWin: winners.length ? Math.max(...winners.map((t) => parseFloat(t.resultAmount))).toFixed(2) : '0.00',
      biggestLoss: losers.length ? Math.min(...losers.map((t) => parseFloat(t.resultAmount))).toFixed(2) : '0.00'
    };
  }

  function renderKPIs() {
    syncCalendarWeekInputs();
    const weekVal = currentWeekInput();
    const weekTrades = filterTradesByWeek(data.trades, weekVal);
    const kpi = computeKPIs(weekTrades);
    const label = $('#dashboardWeekLabel');
    if (label) label.textContent = `Statistiques — semaine du ${formatWeekRange(weekVal)}`;

    const items = [
      { label: 'Total trades', value: kpi.total, cls: 'neutral' },
      { label: 'Taux de réussite', value: `${kpi.winRate} %`, cls: 'neutral' },
      { label: 'Résultat net', value: formatMoney(kpi.net), cls: kpi.net >= 0 ? 'positive' : 'negative' },
      { label: 'Profit Factor', value: kpi.profitFactor, cls: parseFloat(kpi.profitFactor) >= 1 ? 'positive' : 'negative' },
      { label: 'Gain moyen', value: formatMoneyUnsigned(kpi.avgWin), cls: 'positive' },
      { label: 'Perte moyenne', value: formatMoneyUnsigned(kpi.avgLoss), cls: 'negative' },
      { label: 'Ratio R moyen', value: kpi.avgR, cls: parseFloat(kpi.avgR) >= 0 ? 'positive' : 'negative' },
      { label: 'Drawdown max', value: formatMoneyUnsigned(kpi.maxDD), cls: 'negative' },
      { label: 'Respect du plan', value: `${kpi.planRate} %`, cls: parseFloat(kpi.planRate) >= 70 ? 'positive' : 'negative' },
      { label: 'Trades gagnants', value: kpi.winners, cls: 'positive' },
      { label: 'Trades perdants', value: kpi.losers, cls: 'negative' },
      { label: 'Risque moyen', value: formatMoneyUnsigned(kpi.avgRisk), cls: 'neutral' }
    ];

    $('#kpiGrid').innerHTML = items.map((i) => `
      <div class="kpi-card">
        <div class="kpi-label">${i.label}</div>
        <div class="kpi-value ${i.cls}">${i.value}</div>
      </div>
    `).join('');
  }

  function buildEquityPoints(trades, scope) {
    const capital = parseFloat(data.profile.startingCapital) || 0;
    let list = [...trades].sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : (a.createdAt || '').localeCompare(b.createdAt || '');
    });
    if (scope === 'week') list = filterTradesByWeek(list, currentWeekInput());

    const points = [{ y: capital, date: '', label: 'Capital initial' }];
    let running = capital;
    list.forEach((t) => {
      running += parseFloat(t.resultAmount) || 0;
      points.push({ y: running, date: t.date, label: formatDate(t.date), asset: t.asset });
    });
    return points;
  }

  function renderEquityChart() {
    const wrap = $('#equityChartWrap');
    if (!wrap) return;
    const points = buildEquityPoints(data.trades, dashboardChartScope);

    if (points.length < 2) {
      wrap.innerHTML = '<p class="empty-state chart-empty">Enregistrez des trades pour afficher la courbe d\'équité.</p>';
      return;
    }

    const W = 800;
    const H = 240;
    const pad = { t: 20, r: 20, b: 40, l: 62 };
    const innerW = W - pad.l - pad.r;
    const innerH = H - pad.t - pad.b;
    const ys = points.map((p) => p.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const margin = Math.max((maxY - minY) * 0.1, 50);
    const yMin = minY - margin;
    const yMax = maxY + margin;
    const toX = (i) => pad.l + (i / (points.length - 1)) * innerW;
    const toY = (v) => pad.t + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
    const linePts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.y).toFixed(1)}`).join(' ');
    const areaPts = `${pad.l},${(pad.t + innerH).toFixed(1)} ${linePts} ${(pad.l + innerW).toFixed(1)},${(pad.t + innerH).toFixed(1)}`;
    const start = points[0].y;
    const end = points[points.length - 1].y;
    const color = end >= start ? '#22c55e' : '#ef4444';

    let grid = '';
    for (let g = 0; g <= 4; g++) {
      const v = yMin + (g / 4) * (yMax - yMin);
      const y = toY(v).toFixed(1);
      grid += `<line x1="${pad.l}" y1="${y}" x2="${pad.l + innerW}" y2="${y}" class="chart-grid"/>`;
      grid += `<text x="${pad.l - 8}" y="${(+y + 4).toFixed(1)}" class="chart-axis" text-anchor="end">${formatMoneyAxis(v)}</text>`;
    }

    const scopeLabel = dashboardChartScope === 'week' ? 'semaine en cours' : 'historique complet';
    wrap.innerHTML = `
      <div class="chart-meta">
        <span>Période : <strong>${scopeLabel}</strong></span>
        <span>Départ : <strong>${formatMoneyUnsigned(start)}</strong></span>
        <span>Actuel : <strong class="${end >= start ? 'positive' : 'negative'}">${formatMoneyUnsigned(end)}</strong></span>
      </div>
      <svg class="equity-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Courbe d'équité">
        ${grid}
        <polygon points="${areaPts}" fill="${color}" opacity="0.1"/>
        <polyline points="${linePts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        ${points.map((p, i) => `<circle cx="${toX(i).toFixed(1)}" cy="${toY(p.y).toFixed(1)}" r="4" fill="${color}"><title>${escapeHtml(p.label)}${p.asset ? ' — ' + escapeHtml(p.asset) : ''} : ${formatMoneyUnsigned(p.y)}</title></circle>`).join('')}
        <text x="${pad.l}" y="${H - 10}" class="chart-axis" text-anchor="start">${points[1]?.label || ''}</text>
        <text x="${pad.l + innerW}" y="${H - 10}" class="chart-axis" text-anchor="end">${points[points.length - 1].label}</text>
      </svg>`;
  }

  function initEquityChart() {
    $$('[data-chart-scope]').forEach((btn) => {
      btn.addEventListener('click', () => {
        dashboardChartScope = btn.dataset.chartScope;
        $$('[data-chart-scope]').forEach((b) => b.classList.toggle('active', b === btn));
        renderEquityChart();
      });
    });
  }

  function isWebContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  const APP_BUILD = '4';

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !isWebContext()) return;

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register(`./sw.js?v=${APP_BUILD}`)
      .then((reg) => {
        reg.update();
        if (reg.waiting && navigator.serviceWorker.controller) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});
  }

  function updatePwaStatus() {
    const note = $('#pwaInstallNote');
    if (!note) return;
    if (window.matchMedia('(display-mode: standalone)').matches) {
      note.textContent = 'Application installée — mode standalone actif.';
      return;
    }
    if (!isWebContext()) {
      note.innerHTML = '<strong>Mode fichier (file://)</strong> — l\'app fonctionne, mais le manifest PWA est désactivé ici. Lancez <code>start.bat</code> puis ouvrez <code>http://localhost:3000</code> pour installer l\'application.';
      return;
    }
    note.textContent = 'Chrome/Edge : menu ⋮ → « Installer l\'application ». iPhone : Partager → « Sur l\'écran d\'accueil ».';
  }

  function initPwaInstall() {
    const btn = $('#installPwaBtn');
    updatePwaStatus();
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      btn?.classList.remove('hidden');
      $('#pwaInstallNote')?.classList.add('hidden');
    });
    btn?.addEventListener('click', async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      btn.classList.add('hidden');
    });
    window.addEventListener('appinstalled', () => {
      btn?.classList.add('hidden');
      showToast('Application installée');
    });
  }

  function planBadge(val) {
    if (val === 'Oui') return '<span class="badge badge-yes">Oui</span>';
    if (val === 'Non') return '<span class="badge badge-no">Non</span>';
    if (val === 'Partiellement') return '<span class="badge badge-partial">Partiel</span>';
    return '—';
  }

  function resultClass(amount) {
    const n = parseFloat(amount);
    if (n > 0) return 'positive';
    if (n < 0) return 'negative';
    return '';
  }

  function tradeCardHTML(t, full = false) {
    const comment = t.lessonLearned || t.entryReason || '';
    const hasAfter = t.hasScreenshotAfter || !!t.screenshotAfter;
    return `
      <article class="trade-card">
        <div class="trade-card-header">
          <div>
            <div class="trade-card-title">${escapeHtml(t.asset)} · ${escapeHtml(t.direction)}</div>
            <div class="trade-card-date">${formatDate(t.date)}</div>
          </div>
          ${planBadge(t.planRespected)}
        </div>
        <dl class="trade-card-grid">
          <dt>Résultat</dt><dd class="${resultClass(t.resultAmount)}">${formatMoney(t.resultAmount)}</dd>
          <dt>R Multiple</dt><dd>${calcActualRR(t.resultAmount, t.riskAmount) || '—'}</dd>
          ${full ? `<dt>Entrée</dt><dd>${escapeHtml(t.entryPrice) || '—'}</dd>
          <dt>Stop Loss</dt><dd>${escapeHtml(t.stopLoss) || '—'}</dd>
          <dt>Objectif</dt><dd>${escapeHtml(t.takeProfit) || '—'}</dd>
          <dt>Risque</dt><dd>${t.riskAmount ? escapeHtml(withCurrency(t.riskAmount)) : '—'}</dd>` : ''}
        </dl>
        ${comment ? `<p class="trade-card-comment">${escapeHtml(comment)}</p>` : ''}
        <div class="trade-card-actions">
          <button class="btn btn-screenshot btn-sm add-screenshot-after" data-id="${escapeHtml(t.id)}">${hasAfter ? 'Capture ✓' : '+ Capture'}</button>
          ${full ? `<button class="btn btn-ghost btn-sm export-trade-word" data-id="${escapeHtml(t.id)}">Word</button>
          <button class="btn btn-ghost btn-sm edit-trade" data-id="${escapeHtml(t.id)}">Modifier</button>
          <button class="btn btn-danger btn-sm delete-trade" data-id="${escapeHtml(t.id)}">Supprimer</button>` : `<button class="btn btn-ghost btn-sm edit-trade" data-id="${escapeHtml(t.id)}">Voir / Modifier</button>`}
        </div>
      </article>`;
  }

  function renderRecentTrades() {
    const tbody = $('#recentTradesTable tbody');
    const weekTrades = getCurrentWeekTrades();
    const recent = [...weekTrades].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    const empty = $('#emptyTrades');

    if (!recent.length) {
      tbody.innerHTML = '';
      $('#recentTradesCards').innerHTML = '';
      empty.classList.remove('hidden');
      empty.textContent = weekTrades.length === 0 && data.trades.length > 0
        ? 'Aucun trade cette semaine. Consultez l\'historique pour les semaines passées.'
        : 'Aucun trade enregistré. Commencez par ajouter votre premier trade.';
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = recent.map((t) => `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.asset)}</td>
        <td>${escapeHtml(t.direction)}</td>
        <td class="${resultClass(t.resultAmount)}">${formatMoney(t.resultAmount)}</td>
        <td>${calcActualRR(t.resultAmount, t.riskAmount) || '—'}</td>
        <td>${planBadge(t.planRespected)}</td>
      </tr>
    `).join('');

    $('#recentTradesCards').innerHTML = recent.map((t) => tradeCardHTML(t, false)).join('');
  }

  function renderAllTrades() {
    const weekFilter = $('#filterWeek').value;
    const dateFilter = $('#filterDate').value;
    const assetFilter = ($('#filterAsset')?.value || '').trim().toLowerCase();
    let filtered = [...data.trades].sort((a, b) => b.date.localeCompare(a.date));
    if (weekFilter) filtered = filterTradesByWeek(filtered, weekFilter);
    if (dateFilter) filtered = filterTradesByDate(filtered, dateFilter);
    if (assetFilter) filtered = filtered.filter((t) => (t.asset || '').toLowerCase().includes(assetFilter));

    const hasFilters = !!(weekFilter || dateFilter || assetFilter);
    const clearBtn = $('#clearFilter');
    if (clearBtn) clearBtn.disabled = !hasFilters;

    const summary = $('#historyFilterSummary');
    if (summary) {
      const total = data.trades.length;
      const shown = filtered.length;
      const tradeWord = shown === 1 ? 'trade' : 'trades';
      summary.textContent = hasFilters
        ? `${shown} ${tradeWord} affiché${shown !== 1 ? 's' : ''} sur ${total} · filtres actifs`
        : `${shown} ${tradeWord} au total`;
    }

    $('#allTradesTable tbody').innerHTML = filtered.map((t) => {
      const comment = t.lessonLearned || t.entryReason || '';
      const hasAfter = t.hasScreenshotAfter || !!t.screenshotAfter;
      return `
      <tr>
        <td>${formatDate(t.date)}</td>
        <td>${escapeHtml(t.asset)}</td>
        <td>${escapeHtml(t.direction)}</td>
        <td>${escapeHtml(t.entryPrice) || '—'}</td>
        <td>${escapeHtml(t.stopLoss) || '—'}</td>
        <td>${escapeHtml(t.takeProfit) || '—'}</td>
        <td>${t.riskAmount ? escapeHtml(withCurrency(t.riskAmount)) : '—'}</td>
        <td class="${resultClass(t.resultAmount)}">${formatMoney(t.resultAmount)}</td>
        <td>${calcActualRR(t.resultAmount, t.riskAmount) || '—'}</td>
        <td>${planBadge(t.planRespected)}</td>
        <td style="font-family:var(--font);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(comment)}">${escapeHtml(comment) || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn btn-screenshot btn-sm add-screenshot-after" data-id="${escapeHtml(t.id)}" title="Ajouter ou remplacer la capture après le trade">
              ${hasAfter ? 'Capture ✓' : '+ Capture après'}
            </button>
            <button class="btn btn-ghost btn-sm export-trade-word" data-id="${escapeHtml(t.id)}" title="Exporter ce trade en Word">Word</button>
            <button class="btn btn-ghost btn-sm edit-trade" data-id="${escapeHtml(t.id)}">Modifier</button>
            <button class="btn btn-danger btn-sm delete-trade" data-id="${escapeHtml(t.id)}">Suppr.</button>
          </div>
        </td>
      </tr>`;
    }).join('');

    $('#allTradesCards').innerHTML = filtered.length
      ? filtered.map((t) => tradeCardHTML(t, true)).join('')
      : `<p class="empty-state">${hasFilters
        ? 'Aucun trade ne correspond à vos critères. Modifiez les filtres ou réinitialisez la recherche.'
        : 'Aucun trade enregistré. Commencez par ajouter votre premier trade.'}</p>`;
  }

  function renderWeeklySummary() {
    const weekVal = $('#weeklyWeek').value || currentWeekInput();
    $('#weeklyWeek').value = weekVal;
    const w = getWeekFromInput(weekVal);
    if (!w) return;
    const trades = filterTradesByWeek(data.trades, weekVal);
    const kpi = computeKPIs(trades);

    const fmt = (d) => d.toLocaleDateString('fr-FR');
    $('#weeklySummary').innerHTML = `
      <div class="weekly-stat" style="grid-column:1/-1;background:rgba(34,197,94,0.08);border:1px solid var(--border);border-radius:6px;padding:0.85rem 1rem;margin-bottom:0.25rem">
        <div class="weekly-stat-label">Semaine du</div>
        <div class="weekly-stat-value" style="font-size:0.95rem">${fmt(w.start)} au ${fmt(w.end)}</div>
      </div>
      <div class="weekly-stat"><div class="weekly-stat-label">Total trades</div><div class="weekly-stat-value">${kpi.total}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Gagnants</div><div class="weekly-stat-value" style="color:var(--primary)">${kpi.winners}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Perdants</div><div class="weekly-stat-value" style="color:var(--danger)">${kpi.losers}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Break-even</div><div class="weekly-stat-value">${kpi.breakeven}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Taux de réussite</div><div class="weekly-stat-value">${kpi.winRate} %</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Gain total</div><div class="weekly-stat-value" style="color:var(--primary)">${formatMoneyUnsigned(kpi.totalGains)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Perte totale</div><div class="weekly-stat-value" style="color:var(--danger)">${formatMoneyUnsigned(kpi.totalLosses)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Résultat net</div><div class="weekly-stat-value" style="color:${kpi.net >= 0 ? 'var(--primary)' : 'var(--danger)'}">${formatMoney(kpi.net)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Plus gros gain</div><div class="weekly-stat-value" style="color:var(--primary)">${formatMoneyUnsigned(kpi.biggestWin)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Plus grosse perte</div><div class="weekly-stat-value" style="color:var(--danger)">${formatMoneyUnsigned(kpi.biggestLoss)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Drawdown max</div><div class="weekly-stat-value" style="color:var(--danger)">${formatMoneyUnsigned(kpi.maxDD)}</div></div>
      <div class="weekly-stat"><div class="weekly-stat-label">Ratio gain/perte moy.</div><div class="weekly-stat-value">${kpi.avgWin} / ${kpi.avgLoss}</div></div>
    `;

    const notes = data.weeklyNotes[w.key] || {};
    $('#weeklyGood').value = notes.good || '';
    $('#weeklyImprove').value = notes.improve || '';
    $('#weeklyErrors').value = notes.errors || '';
    $('#weeklyGoal').value = notes.goal || '';
    renderWeeklyDailyBreakdown(weekVal, trades);
  }

  function renderWeeklyDailyBreakdown(weekVal, weekTrades) {
    const days = getWeekDays(weekVal);
    const tbody = $('#weeklyDailyTable tbody');
    const cards = $('#weeklyDailyCards');
    const byDay = $('#weeklyTradesByDay');

    if (!days.length) {
      tbody.innerHTML = '';
      cards.innerHTML = '';
      byDay.innerHTML = '';
      return;
    }

    tbody.innerHTML = days.map((day) => {
      const dayTrades = weekTrades.filter((t) => t.date === day.date);
      const kpi = computeKPIs(dayTrades);
      const netCls = kpi.net >= 0 ? 'positive' : kpi.net < 0 ? 'negative' : '';
      return `
        <tr>
          <td>${day.label}</td>
          <td>${formatDate(day.date)}</td>
          <td>${kpi.total}</td>
          <td style="color:var(--primary)">${kpi.winners}</td>
          <td style="color:var(--danger)">${kpi.losers}</td>
          <td class="${netCls}">${kpi.total ? formatMoney(kpi.net) : '—'}</td>
        </tr>`;
    }).join('');

    cards.innerHTML = days.map((day) => {
      const dayTrades = weekTrades.filter((t) => t.date === day.date);
      const kpi = computeKPIs(dayTrades);
      return `
        <article class="trade-card">
          <div class="trade-card-header">
            <div>
              <div class="trade-card-title">${day.label}</div>
              <div class="trade-card-date">${formatDate(day.date)}</div>
            </div>
            <span class="badge badge-yes">${kpi.total} trade${kpi.total !== 1 ? 's' : ''}</span>
          </div>
          <dl class="trade-card-grid">
            <dt>Gagnants</dt><dd style="color:var(--primary)">${kpi.winners}</dd>
            <dt>Perdants</dt><dd style="color:var(--danger)">${kpi.losers}</dd>
            <dt>Net</dt><dd class="${kpi.net >= 0 ? 'positive' : kpi.net < 0 ? 'negative' : ''}">${kpi.total ? formatMoney(kpi.net) : '—'}</dd>
          </dl>
        </article>`;
    }).join('');

    const daysWithTrades = days.filter((day) => weekTrades.some((t) => t.date === day.date));
    byDay.innerHTML = daysWithTrades.length
      ? daysWithTrades.map((day) => {
          const dayTrades = weekTrades.filter((t) => t.date === day.date);
          return `
            <div class="day-trades-group">
              <h3 class="day-trades-title">${day.label} ${formatDate(day.date)} — ${dayTrades.length} trade${dayTrades.length !== 1 ? 's' : ''}</h3>
              <div class="day-trades-list">${dayTrades.map((t) => tradeCardHTML(t, true)).join('')}</div>
            </div>`;
        }).join('')
      : '<p class="empty-state">Aucun trade enregistré cette semaine.</p>';
  }

  function loadProfile() {
    const user = getCurrentUser();
    const p = data.profile;
    $('#traderName').value = p.traderName || user?.name || '';
    $('#mainMarket').value = p.mainMarket || '';
    $('#strategy').value = p.strategy || '';
    $('#startingCapital').value = p.startingCapital || '';
    $('#maxRisk').value = p.maxRisk || '';
    renderProfileView();
    setProfileEditMode(false);
  }

  function profileVal(v, suffix = '') {
    return v !== null && v !== undefined && v !== '' ? escapeHtml(v) + suffix : '<span class="text-muted">—</span>';
  }

  function renderProfileView() {
    const el = $('#profileView');
    if (!el) return;
    const p = data.profile;
    const user = getCurrentUser();
    el.innerHTML = `
      <dt>Nom du trader</dt><dd>${profileVal(p.traderName || user?.name)}</dd>
      <dt>Marché principal</dt><dd>${profileVal(p.mainMarket)}</dd>
      <dt>Stratégie</dt><dd>${profileVal(p.strategy)}</dd>
      <dt>Capital de départ</dt><dd>${p.startingCapital ? formatMoneyUnsigned(p.startingCapital) : '<span class="text-muted">—</span>'}</dd>
      <dt>Risque max / trade</dt><dd>${profileVal(p.maxRisk, ' %')}</dd>`;
  }

  function setProfileEditMode(editing) {
    $('#profileView')?.classList.toggle('hidden', editing);
    $('#profileForm')?.classList.toggle('hidden', !editing);
    $('#editProfileBtn')?.classList.toggle('hidden', editing);
    if (!editing) {
      const p = data.profile;
      const user = getCurrentUser();
      $('#traderName').value = p.traderName || user?.name || '';
      $('#mainMarket').value = p.mainMarket || '';
      $('#strategy').value = p.strategy || '';
      $('#startingCapital').value = p.startingCapital || '';
      $('#maxRisk').value = p.maxRisk || '';
    }
  }

  function saveProfile() {
    data.profile = {
      traderName: $('#traderName').value.trim(),
      mainMarket: $('#mainMarket').value.trim(),
      strategy: $('#strategy').value.trim(),
      startingCapital: $('#startingCapital').value,
      maxRisk: $('#maxRisk').value
    };
    if (data.profile.traderName) updateCurrentUserName(data.profile.traderName);
    saveData();
    renderProfileView();
    renderKPIs();
    renderEquityChart();
  }

  function loadChecklist() {
    $$('#preTradeChecklist input').forEach((cb, i) => {
      cb.checked = data.checklist[i] || false;
      cb.closest('li').classList.toggle('checked', cb.checked);
    });
  }

  function saveChecklist() {
    data.checklist = [...$$('#preTradeChecklist input')].map((cb) => cb.checked);
    debouncedSave();
  }

  function setScreenshotPreview(target, src) {
    const preview = target === 'before' ? $('#previewBefore') : $('#previewAfter');
    if (src) {
      preview.innerHTML = `<img src="${src}" alt="Capture ${target}">`;
      preview.classList.add('has-image');
    } else {
      preview.innerHTML = '<span class="placeholder-text">Cliquer, coller (Ctrl+V) ou glisser une image</span>';
      preview.classList.remove('has-image');
    }
  }

  function ensureDraftId() {
    if (!$('#tradeId').value) $('#tradeId').value = uid();
  }

  function clearDraft() {
    if (!currentUserId) return;
    localStorage.removeItem(draftKey());
  }

  function normalizeResultAmount(type, amount) {
    const n = parseFloat(amount);
    if (isNaN(n) || !type) return amount;
    if (type === 'Gain') return String(Math.abs(n));
    if (type === 'Perte') return String(-Math.abs(n));
    if (type === 'Break-even') return '0';
    return amount;
  }

  function checkRiskWarning(riskAmount) {
    const maxRisk = parseFloat(data.profile.maxRisk);
    const capital = parseFloat(data.profile.startingCapital);
    const risk = parseFloat(riskAmount);
    if (!maxRisk || !capital || isNaN(risk)) return;
    const maxAllowed = capital * maxRisk / 100;
    if (risk > maxAllowed * 1.05) {
      showToast(`Risque (${formatMoneyUnsigned(risk)}) supérieur à ${maxRisk}% du capital (${formatMoneyUnsigned(maxAllowed)})`);
    }
  }

  function applyScreenshot(target, dataUrl) {
    ensureDraftId();
    if (target === 'before') screenshotBefore = dataUrl;
    else screenshotAfter = dataUrl;
    setScreenshotPreview(target, dataUrl);
    const id = $('#tradeId').value;
    persistScreenshot(id, target, dataUrl).then(() => autoSaveCurrentTrade()).catch(console.error);
  }

  function handleScreenshotUpload(file, target) {
    if (!file || !file.type.startsWith('image/')) {
      showToast('Veuillez sélectionner une image (PNG, JPG...)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      applyScreenshot(target, e.target.result);
      showToast(target === 'after' ? 'Capture après ajoutée' : 'Capture avant ajoutée');
    };
    reader.readAsDataURL(file);
  }

  function quickAddScreenshotAfter(tradeId, file) {
    if (!file || !file.type.startsWith('image/')) return;
    const idx = data.trades.findIndex((t) => t.id === tradeId);
    if (idx < 0) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      await persistScreenshot(tradeId, 'after', e.target.result);
      data.trades[idx].hasScreenshotAfter = true;
      delete data.trades[idx].screenshotAfter;
      saveData();
      renderAllTrades();
      showToast('Capture après enregistrée et sauvegardée');
    };
    reader.readAsDataURL(file);
  }

  function autoSaveCurrentTrade() {
    if (!$('#asset').value && !$('#entryReason').value && !screenshotBefore && !screenshotAfter) return;
    ensureDraftId();
    const id = $('#tradeId').value;
    const trade = collectTradeForm();
    const idx = data.trades.findIndex((t) => t.id === id);
    if (idx >= 0) {
      trade.createdAt = data.trades[idx].createdAt;
      data.trades[idx] = trade;
      debouncedSave();
      renderKPIs();
      renderRecentTrades();
    } else {
      clearTimeout(draftTimeout);
      draftTimeout = setTimeout(() => {
        try {
          localStorage.setItem(draftKey(), JSON.stringify(trade));
        } catch (err) {
          console.error(err);
        }
      }, 400);
    }
  }

  function resetTradeForm(clearDraftToo = true) {
    $('#tradeForm').reset();
    $('#tradeId').value = '';
    screenshotBefore = '';
    screenshotAfter = '';
    setScreenshotPreview('before', '');
    setScreenshotPreview('after', '');
    $('#tradeDate').value = new Date().toISOString().slice(0, 10);
    $('#plannedRR').value = '';
    $('#actualRR').value = '';
    $('#saveTradeBtn').textContent = 'Enregistrer le trade';
    if (clearDraftToo) clearDraft();
  }

  function collectTradeForm() {
    const timeframes = getCheckedValues('timeframes');
    const otherTf = $('#timeframeOther').value.trim();
    if ($('#timeframeOtherCheck').checked && otherTf) timeframes.push(`Autre: ${otherTf}`);

    return {
      id: $('#tradeId').value || uid(),
      date: $('#tradeDate').value,
      weekKey: getWeekKey($('#tradeDate').value),
      asset: $('#asset').value,
      direction: document.querySelector('input[name="direction"]:checked')?.value || 'Achat',
      entryPrice: $('#entryPrice').value,
      stopLoss: $('#stopLoss').value,
      takeProfit: $('#takeProfit').value,
      positionSize: $('#positionSize').value,
      riskAmount: $('#riskAmount').value,
      resultType: document.querySelector('input[name="resultType"]:checked')?.value || '',
      resultAmount: $('#resultAmount').value,
      plannedRR: $('#plannedRR').value,
      actualRR: $('#actualRR').value,
      entryReason: $('#entryReason').value,
      marketConditions: getCheckedValues('marketConditions'),
      timeframes,
      emotionBefore: $('#emotionBefore').value,
      emotionDuring: $('#emotionDuring').value,
      emotionAfter: $('#emotionAfter').value,
      emotionComments: $('#emotionComments').value,
      planRespected: document.querySelector('input[name="planRespected"]:checked')?.value || '',
      errors: getCheckedValues('errors'),
      errorDescription: $('#errorDescription').value,
      lessonLearned: $('#lessonLearned').value,
      hasScreenshotBefore: !!screenshotBefore,
      hasScreenshotAfter: !!screenshotAfter,
      createdAt: new Date().toISOString()
    };
  }

  async function fillTradeForm(trade) {
    $('#tradeId').value = trade.id;
    $('#tradeDate').value = trade.date;
    $('#asset').value = trade.asset;
    document.querySelector(`input[name="direction"][value="${CSS.escape(trade.direction)}"]`)?.click();
    $('#entryPrice').value = trade.entryPrice || '';
    $('#stopLoss').value = trade.stopLoss || '';
    $('#takeProfit').value = trade.takeProfit || '';
    $('#positionSize').value = trade.positionSize || '';
    $('#riskAmount').value = trade.riskAmount || '';
    if (trade.resultType) document.querySelector(`input[name="resultType"][value="${CSS.escape(trade.resultType)}"]`)?.click();
    $('#resultAmount').value = trade.resultAmount || '';
    $('#entryReason').value = trade.entryReason || '';
    setCheckedValues('marketConditions', trade.marketConditions || []);
    setCheckedValues('timeframes', (trade.timeframes || []).filter((t) => !t.startsWith('Autre:')));
    const otherTf = (trade.timeframes || []).find((t) => t.startsWith('Autre:'));
    if (otherTf) {
      $('#timeframeOtherCheck').checked = true;
      $('#timeframeOther').value = otherTf.replace('Autre: ', '');
    }
    $('#emotionBefore').value = trade.emotionBefore || '';
    $('#emotionDuring').value = trade.emotionDuring || '';
    $('#emotionAfter').value = trade.emotionAfter || '';
    $('#emotionComments').value = trade.emotionComments || '';
    if (trade.planRespected) document.querySelector(`input[name="planRespected"][value="${CSS.escape(trade.planRespected)}"]`)?.click();
    setCheckedValues('errors', trade.errors || []);
    $('#errorDescription').value = trade.errorDescription || '';
    $('#lessonLearned').value = trade.lessonLearned || '';
    if (trade.screenshotBefore?.startsWith?.('data:')) {
      screenshotBefore = trade.screenshotBefore;
    } else {
      screenshotBefore = trade.hasScreenshotBefore ? await loadScreenshot(trade.id, 'before') : '';
    }
    if (trade.screenshotAfter?.startsWith?.('data:')) {
      screenshotAfter = trade.screenshotAfter;
    } else {
      screenshotAfter = trade.hasScreenshotAfter ? await loadScreenshot(trade.id, 'after') : '';
    }
    setScreenshotPreview('before', screenshotBefore);
    setScreenshotPreview('after', screenshotAfter);
    updateComputedFields();
    $('#saveTradeBtn').textContent = 'Mettre à jour le trade';
  }

  async function restoreDraftIfAny() {
    try {
      const raw = localStorage.getItem(draftKey());
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft.id || data.trades.some((t) => t.id === draft.id)) {
        clearDraft();
        return;
      }
      if (!draft.asset && !draft.entryReason) return;
      await fillTradeForm(draft);
      $('#saveTradeBtn').textContent = 'Enregistrer le trade';
      showToast('Brouillon restauré');
    } catch {
      clearDraft();
    }
  }

  async function saveTrade(e) {
    e.preventDefault();
    ensureDraftId();
    const resultType = document.querySelector('input[name="resultType"]:checked')?.value || '';
    $('#resultAmount').value = normalizeResultAmount(resultType, $('#resultAmount').value);
    updateComputedFields();
    checkRiskWarning($('#riskAmount').value);

    const trade = collectTradeForm();
    await persistScreenshot(trade.id, 'before', screenshotBefore);
    await persistScreenshot(trade.id, 'after', screenshotAfter);
    trade.hasScreenshotBefore = !!screenshotBefore;
    trade.hasScreenshotAfter = !!screenshotAfter;

    const idx = data.trades.findIndex((t) => t.id === trade.id);
    if (idx >= 0) {
      trade.createdAt = data.trades[idx].createdAt;
      data.trades[idx] = trade;
    } else {
      data.trades.push(trade);
    }
    clearDraft();
    saveData();
    resetTradeForm();
    renderAll();
    showToast(idx >= 0 ? 'Trade mis à jour' : 'Trade enregistré');
    navigateTo('trades');
  }

  async function deleteTrade(id) {
    const ok = await showConfirm('Supprimer ce trade ?', { title: 'Supprimer le trade', confirmText: 'Supprimer', danger: true });
    if (!ok) return;
    await idbDelete(imgKey(id, 'before')).catch(() => {});
    await idbDelete(imgKey(id, 'after')).catch(() => {});
    data.trades = data.trades.filter((t) => t.id !== id);
    saveData();
    renderAll();
    showToast('Trade supprimé');
  }

  async function exportWord(singleTradeId = null) {
    if (!window.TradingJournalExport) {
      showToast('Module d\'export Word non chargé');
      return;
    }
    if (!singleTradeId && data.trades.length === 0) {
      showToast('Aucun trade à exporter');
      return;
    }
    const btn = singleTradeId ? null : $('#exportWordBtn');
    const btnOriginal = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Génération en cours...';
    }
    showToast('Génération du document Word en cours...');
    try {
      const trades = await hydrateTradesForExport(
        singleTradeId ? data.trades.filter((t) => t.id === singleTradeId) : data.trades
      );
      const exportData = { ...data, trades };
      if (singleTradeId) {
        await window.TradingJournalExport.exportSingleTradeToWord(exportData, singleTradeId);
      } else {
        await window.TradingJournalExport.exportAllToWord(exportData);
      }
      showToast('Document Word (.docx) téléchargé');
    } catch (err) {
      console.error(err);
      showToast('Erreur export Word. Connexion internet requise (1ère fois).');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btnOriginal;
      }
    }
  }

  async function exportBackup() {
    showToast('Préparation de la sauvegarde...');
    const exportData = deepMerge(defaultData(), data);
    exportData.trades = await hydrateTradesForExport(data.trades);
    const user = getCurrentUser();
    const payload = {
      exportVersion: 2,
      userId: currentUserId,
      userName: user?.name || '',
      ...exportData
    };
    const slug = (user?.name || 'journal').replace(/\s+/g, '-').toLowerCase();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal-trading-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Sauvegarde exportée — transférez ce fichier sur votre téléphone');
  }

  function importBackup(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        const payload = stripExportMeta(imported);
        if (!payload.trades && !payload.profile) {
          showToast('Fichier invalide');
          return;
        }
        let msg = 'Remplacer toutes les données du profil actif par cette sauvegarde ?';
        if (imported.userId && imported.userId !== currentUserId) {
          const from = imported.userName || 'un autre profil';
          msg = `Cette sauvegarde provient de « ${from} ». Elle remplacera les données du profil actuel. Continuer ?`;
        }
        const ok = await showConfirm(msg, { title: 'Importer une sauvegarde', confirmText: 'Importer' });
        if (!ok) return;
        data = deepMerge(defaultData(), payload);
        await migrateLegacyScreenshots();
        saveData();
        loadProfile();
        loadChecklist();
        $('#personalNotes').value = data.personalNotes || '';
        resetTradeForm();
        renderAll();
        showToast('Données importées avec succès');
      } catch {
        showToast('Erreur : fichier JSON invalide');
      }
    };
    reader.readAsText(file);
  }

  function exportCSV() {
    const headers = ['Date', 'Actif', 'Sens', 'Entrée', 'Stop Loss', 'Objectif', 'Risque $', 'Résultat $', 'R Multiple', 'Plan respecté', 'Leçon'];
    const rows = data.trades.map((t) => [
      formatDate(t.date), t.asset, t.direction, t.entryPrice, t.stopLoss, t.takeProfit,
      t.riskAmount, t.resultAmount, calcActualRR(t.resultAmount, t.riskAmount),
      t.planRespected, (t.lessonLearned || '').replace(/"/g, '""')
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c ?? ''}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal-trading-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Export CSV téléchargé');
  }

  function navigateTo(section) {
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.section === section));
    $$('.bottom-nav-item[data-section]').forEach((n) => n.classList.toggle('active', n.dataset.section === section));
    $$('.section').forEach((s) => s.classList.toggle('active', s.id === `section-${section}`));
    $('#pageTitle').textContent = sectionTitles[section] || section;
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof window.trackJournalSection === 'function') window.trackJournalSection(section);

    if (section === 'dashboard') {
      renderKPIs();
      renderRecentTrades();
      renderEquityChart();
    }
    if (section === 'weekly') {
      $('#weeklyWeek').value = currentWeekInput();
      renderWeeklySummary();
    }
    if (section === 'trades') renderAllTrades();
    if (section === 'profile') {
      updateUserDisplay();
      loadProfile();
    }
  }

  function renderAll() {
    renderKPIs();
    renderEquityChart();
    renderRecentTrades();
    renderAllTrades();
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    document.body.classList.remove('sidebar-open');
    const overlay = $('.sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
  }

  function openSidebar() {
    $('#sidebar').classList.add('open');
    document.body.classList.add('sidebar-open');
    let overlay = $('.sidebar-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      document.body.appendChild(overlay);
      overlay.addEventListener('click', closeSidebar);
    }
    overlay.classList.add('active');
  }

  function initNavigation() {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.section));
    });

    $$('.bottom-nav-item[data-section]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.section));
    });

    $('#bottomMenuBtn').addEventListener('click', openSidebar);

    $$('[data-goto]').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
    });

    $('#menuToggle').addEventListener('click', openSidebar);

    $('#sidebarClose').addEventListener('click', closeSidebar);
  }

  function initBottomNav() {
    $$('.bottom-nav-item[data-section]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === 'dashboard');
    });
  }

  function initErrorCheckboxLogic() {
    const panel = $('#errors');
    if (!panel) return;
    const noneValue = 'Aucune erreur';
    panel.addEventListener('change', (e) => {
      const target = e.target;
      if (target.type !== 'checkbox') return;
      const boxes = [...panel.querySelectorAll('input[type="checkbox"]')];
      const noneBox = panel.querySelector(`input[value="${noneValue}"]`);
      if (target.value === noneValue && target.checked) {
        boxes.forEach((cb) => { if (cb !== target) cb.checked = false; });
      } else if (target.checked && noneBox) {
        noneBox.checked = false;
      }
    });
  }

  function initForms() {
    $('#editProfileBtn')?.addEventListener('click', () => setProfileEditMode(true));
    $('#cancelProfileBtn')?.addEventListener('click', () => setProfileEditMode(false));
    $('#profileForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      saveProfile();
      setProfileEditMode(false);
      showToast('Profil enregistré');
    });

    $('#personalNotes').value = data.personalNotes || '';
    $('#personalNotes').addEventListener('input', () => {
      data.personalNotes = $('#personalNotes').value;
      debouncedSave();
    });

    ['entryPrice', 'stopLoss', 'takeProfit', 'riskAmount', 'resultAmount'].forEach((id) => {
      $(`#${id}`).addEventListener('input', () => { updateComputedFields(); autoSaveCurrentTrade(); });
    });
    $$('input[name="direction"]').forEach((r) => r.addEventListener('change', () => { updateComputedFields(); autoSaveCurrentTrade(); }));

    const tradeAutoSaveFields = [
      '#tradeDate', '#asset', '#entryPrice', '#stopLoss', '#takeProfit', '#positionSize', '#riskAmount',
      '#resultAmount', '#entryReason', '#emotionBefore', '#emotionDuring', '#emotionAfter',
      '#emotionComments', '#errorDescription', '#lessonLearned', '#timeframeOther'
    ];
    tradeAutoSaveFields.forEach((sel) => {
      const el = $(sel);
      if (el) el.addEventListener('input', autoSaveCurrentTrade);
      if (el && el.tagName === 'SELECT') el.addEventListener('change', autoSaveCurrentTrade);
    });
    ['resultType', 'planRespected', 'direction'].forEach((name) => {
      $$(`input[name="${name}"]`).forEach((r) => r.addEventListener('change', autoSaveCurrentTrade));
    });
    ['marketConditions', 'timeframes', 'errors'].forEach((id) => {
      $$(`#${id} input`).forEach((cb) => cb.addEventListener('change', autoSaveCurrentTrade));
    });
    initErrorCheckboxLogic();

    $('#tradeForm').addEventListener('submit', saveTrade);
    $('#resetTradeForm').addEventListener('click', resetTradeForm);

    $('#filterWeek').addEventListener('change', renderAllTrades);
    $('#filterDate').addEventListener('change', renderAllTrades);
    $('#filterAsset')?.addEventListener('input', renderAllTrades);
    $('#clearFilter').addEventListener('click', () => {
      $('#filterWeek').value = '';
      $('#filterDate').value = '';
      if ($('#filterAsset')) $('#filterAsset').value = '';
      renderAllTrades();
    });

    $('#weeklyWeek').addEventListener('change', renderWeeklySummary);

    ['weeklyGood', 'weeklyImprove', 'weeklyErrors', 'weeklyGoal'].forEach((id) => {
      $(`#${id}`).addEventListener('input', () => {
        const w = getWeekFromInput($('#weeklyWeek').value);
        if (!w) return;
        data.weeklyNotes[w.key] = {
          good: $('#weeklyGood').value,
          improve: $('#weeklyImprove').value,
          errors: $('#weeklyErrors').value,
          goal: $('#weeklyGoal').value
        };
        debouncedSave();
      });
    });

    $('#saveWeeklyNotes').addEventListener('click', () => {
      const w = getWeekFromInput($('#weeklyWeek').value);
      if (!w) return;
      data.weeklyNotes[w.key] = {
        good: $('#weeklyGood').value,
        improve: $('#weeklyImprove').value,
        errors: $('#weeklyErrors').value,
        goal: $('#weeklyGoal').value
      };
      saveData();
      showToast('Analyse hebdomadaire sauvegardée');
    });

    $$('#preTradeChecklist input').forEach((cb) => {
      cb.addEventListener('change', () => {
        cb.closest('li').classList.toggle('checked', cb.checked);
        saveChecklist();
      });
    });
    $('#resetChecklist').addEventListener('click', () => {
      data.checklist = [false, false, false, false, false, false, false, false];
      loadChecklist();
      saveData();
    });

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('edit-trade')) {
        const trade = data.trades.find((t) => t.id === e.target.dataset.id);
        if (trade) fillTradeForm(trade).then(() => navigateTo('new-trade'));
      }
      if (e.target.classList.contains('add-screenshot-after')) {
        quickScreenshotTradeId = e.target.dataset.id;
        $('#quickScreenshotInput').click();
      }
      if (e.target.classList.contains('export-trade-word')) {
        exportWord(e.target.dataset.id);
      }
      if (e.target.classList.contains('delete-trade')) {
        deleteTrade(e.target.dataset.id);
      }
    });

    $('#quickScreenshotInput').addEventListener('change', (e) => {
      if (quickScreenshotTradeId && e.target.files[0]) {
        quickAddScreenshotAfter(quickScreenshotTradeId, e.target.files[0]);
      }
      quickScreenshotTradeId = null;
      e.target.value = '';
    });

    $('#exportWordBtn').addEventListener('click', () => exportWord());
    $('#exportBtn').addEventListener('click', exportCSV);
    $('#exportBackupBtn').addEventListener('click', exportBackup);
    $('#importBackupBtn').addEventListener('click', () => $('#importBackupInput').click());
    $('#importBackupInput').addEventListener('change', (e) => {
      importBackup(e.target.files[0]);
      e.target.value = '';
    });
    $('#printBtn').addEventListener('click', () => window.print());
  }

  function initScreenshots() {
    [['before', '#screenshotBefore', '#previewBefore'], ['after', '#screenshotAfter', '#previewAfter']].forEach(([target, inputSel, previewSel]) => {
      const input = $(inputSel);
      const preview = $(previewSel);

      preview.addEventListener('click', () => input.click());
      input.addEventListener('change', () => handleScreenshotUpload(input.files[0], target));

      preview.addEventListener('dragover', (e) => { e.preventDefault(); preview.style.borderColor = 'var(--primary)'; });
      preview.addEventListener('dragleave', () => { preview.style.borderColor = ''; });
      preview.addEventListener('drop', (e) => {
        e.preventDefault();
        preview.style.borderColor = '';
        handleScreenshotUpload(e.dataTransfer.files[0], target);
      });

      preview.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            e.preventDefault();
            handleScreenshotUpload(item.getAsFile(), target);
            break;
          }
        }
      });
    });

    $$('.clear-screenshot').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyScreenshot(btn.dataset.target, '');
        showToast('Capture supprimée');
      });
    });
  }

  async function bootApp() {
    data = loadData();
    await migrateLegacyScreenshots();
    loadProfile();
    loadChecklist();
    resetTradeForm(false);
    $('#personalNotes').value = data.personalNotes || '';
    sessionStorage.setItem(CALENDAR_WEEK_KEY, currentWeekInput());
    $('#weeklyWeek').value = currentWeekInput();
    $('#filterWeek').value = '';
    $('#filterDate').value = '';
    initBottomNav();
    updateUserDisplay();
    renderAll();
    await restoreDraftIfAny();
    if (typeof window.trackJournalSection === 'function') window.trackJournalSection('dashboard');
  }

  function initWeekAutoRefresh() {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const { changed } = syncCalendarWeekInputs();
      if (!changed) return;
      const active = document.querySelector('.section.active')?.id;
      if (active === 'section-dashboard') {
        renderKPIs();
        renderRecentTrades();
        renderEquityChart();
      } else if (active === 'section-weekly') {
        renderWeeklySummary();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
  }

  async function init() {
    try {
      initUserModal();
      initNavigation();
      initWeekAutoRefresh();
      initForms();
      initScreenshots();
      initEquityChart();
      registerServiceWorker();
      initPwaInstall();

      migrateLegacyDataIfNeeded(loadUsersRegistry());
      const users = loadUsersRegistry();
      currentUserId = localStorage.getItem(CURRENT_USER_KEY);

      if (users.length === 0) {
        showUserModal(true);
        return;
      }
      if (!currentUserId || !users.some((u) => u.id === currentUserId)) {
        showUserModal(true);
        return;
      }
      await bootApp();
    } finally {
      hideSplash();
    }
  }

  init().catch((err) => {
    console.error(err);
    hideSplash();
  });
})();
