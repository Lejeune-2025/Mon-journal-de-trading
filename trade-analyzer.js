/**
 * Analyseur de trade — envoi d'une capture, analyse IA par timeframe.
 */
(function (global) {
  'use strict';

  const HISTORY_PREFIX = 'tradingJournalPro_analyses_v1_';
  const MAX_HISTORY = 15;
  const DEFAULT_TFS = ['M5', 'M15', 'H1', 'H4', 'Daily'];

  let hooks = null;
  let currentImage = null;
  let currentAnalysis = null;
  let analyzing = false;

  function t(key, vars) {
    return global.I18n ? global.I18n.t(key, vars) : key;
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function $(sel) { return document.querySelector(sel); }

  function historyKey() {
    const uid = hooks?.getUserId?.();
    return uid ? HISTORY_PREFIX + uid : null;
  }

  function loadHistory() {
    const key = historyKey();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHistory(items) {
    const key = historyKey();
    if (!key) return;
    localStorage.setItem(key, JSON.stringify(items.slice(0, MAX_HISTORY)));
  }

  function compressImage(dataUrl, maxWidth = 1400, quality = 0.82) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Image illisible'));
      img.src = dataUrl;
    });
  }

  function getSelectedTimeframes() {
    const tfs = [];
    const selectMinutes = $('#timeframeMinutes');
    const selectHours = $('#timeframeHours');
    const selectLong = $('#timeframeLong');

    [selectMinutes, selectHours, selectLong].forEach(select => {
      if (select) {
        const selected = [...select.selectedOptions].map(opt => opt.value);
        tfs.push(...selected);
      }
    });

    return tfs.length ? tfs : [];
  }

  function biasLabel(bias) {
    if (bias === 'long') return { text: 'Haussier', cls: 'analyzer-bias--long' };
    if (bias === 'short') return { text: 'Baissier', cls: 'analyzer-bias--short' };
    return { text: 'Neutre', cls: 'analyzer-bias--neutral' };
  }

  function confidenceLabel(c) {
    if (c === 'high') return { text: 'Élevée', cls: 'analyzer-conf--high' };
    if (c === 'medium') return { text: 'Moyenne', cls: 'analyzer-conf--medium' };
    return { text: 'Faible', cls: 'analyzer-conf--low' };
  }

  function directionClass(dir) {
    if (dir === 'Achat') return 'analyzer-dir--buy';
    if (dir === 'Vente') return 'analyzer-dir--sell';
    return 'analyzer-dir--wait';
  }

  function setPreview(dataUrl) {
    currentImage = dataUrl;
    const wrap = $('#analyzerPreview');
    const img = $('#analyzerPreviewImg');
    const placeholder = $('#analyzerPreviewPlaceholder');
    if (!wrap || !img) return;
    if (dataUrl) {
      img.src = dataUrl;
      img.classList.remove('hidden');
      placeholder?.classList.add('hidden');
      wrap.classList.add('analyzer-preview--has-image');
    } else {
      img.src = '';
      img.classList.add('hidden');
      placeholder?.classList.remove('hidden');
      wrap.classList.remove('analyzer-preview--has-image');
    }
    const btn = $('#analyzerRunBtn');
    if (btn) btn.disabled = !dataUrl || analyzing;
  }

  async function loadImageFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      hooks?.showToast?.(t('analyzer.toast.imageRequired'));
      return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const compressed = await compressImage(e.target.result);
        setPreview(compressed);
        hooks?.showToast?.(t('analyzer.toast.imageReady'));
      } catch (err) {
        hooks?.showToast?.(err.message || t('analyzer.toast.imageError'));
      }
    };
    reader.readAsDataURL(file);
  }

  function setAnalyzing(active) {
    analyzing = active;
    const btn = $('#analyzerRunBtn');
    const status = $('#analyzerStatus');
    const results = $('#analyzerResults');
    if (btn) {
      btn.disabled = active || !currentImage;
      btn.classList.toggle('btn--loading', active);
    }
    if (status) {
      status.textContent = active ? t('analyzer.status.analyzing') : '';
      status.className = 'analyzer-status' + (active ? ' analyzer-status--loading' : '');
    }
    if (active && results) results.innerHTML = '';
  }

  function renderKeyLevels(levels) {
    if (!levels) return '';
    const sup = (levels.supports || []).map((l) => `<li>${escapeHtml(l)}</li>`).join('') || '<li class="muted">—</li>';
    const res = (levels.resistances || []).map((l) => `<li>${escapeHtml(l)}</li>`).join('') || '<li class="muted">—</li>';
    return `
      <div class="analyzer-levels">
        <div class="analyzer-levels-col">
          <h4>${t('analyzer.levels.supports')}</h4>
          <ul>${sup}</ul>
        </div>
        <div class="analyzer-levels-col">
          <h4>${t('analyzer.levels.resistances')}</h4>
          <ul>${res}</ul>
        </div>
      </div>`;
  }

  function renderTimeframeCard(tf, index) {
    return `
      <article class="analyzer-tf-card" data-tf-index="${index}">
        <div class="analyzer-tf-header">
          <span class="analyzer-tf-badge">${escapeHtml(tf.timeframe)}</span>
          <span class="analyzer-dir ${directionClass(tf.direction)}">${escapeHtml(tf.direction)}</span>
        </div>
        <p class="analyzer-tf-setup"><strong>Setup :</strong> ${escapeHtml(tf.setup)}</p>
        <dl class="analyzer-tf-grid">
          <dt>Zone d'entrée</dt><dd>${escapeHtml(tf.entryZone)}</dd>
          <dt>Entrée</dt><dd>${escapeHtml(tf.entryPrice)}</dd>
          <dt>Stop Loss</dt><dd class="analyzer-val-sl">${escapeHtml(tf.stopLoss)}</dd>
          <dt>TP1</dt><dd class="analyzer-val-tp">${escapeHtml(tf.takeProfit1)}</dd>
          <dt>TP2</dt><dd class="analyzer-val-tp">${escapeHtml(tf.takeProfit2)}</dd>
          <dt>TP3</dt><dd class="analyzer-val-tp">${escapeHtml(tf.takeProfit3)}</dd>
          <dt>R:R</dt><dd>${escapeHtml(tf.riskReward)}</dd>
          <dt>Invalidation</dt><dd>${escapeHtml(tf.invalidation)}</dd>
        </dl>
        ${tf.notes ? `<p class="analyzer-tf-notes">${escapeHtml(tf.notes)}</p>` : ''}
        <button type="button" class="btn btn-ghost btn-sm analyzer-apply-btn" data-tf-index="${index}">
          ${t('analyzer.applyTrade')}
        </button>
      </article>`;
  }

  function renderAnalysis(analysis) {
    const el = $('#analyzerResults');
    if (!el || !analysis) return;

    const s = analysis.summary || {};
    const bias = biasLabel(s.bias);
    const conf = confidenceLabel(s.confidence);
    const tfCards = (analysis.timeframeAnalysis || []).map(renderTimeframeCard).join('');
    const warnings = (analysis.warnings || []).map((w) => `<li>${escapeHtml(w)}</li>`).join('');
    const checklist = (analysis.preTradeChecklist || []).map((c) => `<li>${escapeHtml(c)}</li>`).join('');

    el.innerHTML = `
      <div class="analyzer-result">
        <div class="analyzer-summary card">
          <div class="card-header">
            <h2>${t('analyzer.result.title')}</h2>
            <div class="analyzer-summary-badges">
              <span class="analyzer-bias ${bias.cls}">${bias.text}</span>
              <span class="analyzer-conf ${conf.cls}">${t('analyzer.confidence')} : ${conf.text}</span>
            </div>
          </div>
          <dl class="analyzer-summary-grid">
            <dt>Actif</dt><dd>${escapeHtml(s.asset || '—')}</dd>
            <dt>TF détecté</dt><dd>${escapeHtml(s.detectedTimeframe || '—')}</dd>
            <dt>Structure</dt><dd>${escapeHtml(s.marketStructure || '—')}</dd>
          </dl>
          <p class="analyzer-context">${escapeHtml(s.context || '')}</p>
          ${renderKeyLevels(analysis.keyLevels)}
        </div>

        <div class="card">
          <h2>${t('analyzer.result.timeframes')}</h2>
          <div class="analyzer-tf-grid">${tfCards}</div>
        </div>

        <div class="card analyzer-scenarios">
          <h2>${t('analyzer.result.scenarios')}</h2>
          <div class="analyzer-scenario-block">
            <h3>${t('analyzer.result.primary')}</h3>
            <p>${escapeHtml(analysis.primaryScenario || '')}</p>
          </div>
          <div class="analyzer-scenario-block">
            <h3>${t('analyzer.result.alternative')}</h3>
            <p>${escapeHtml(analysis.alternativeScenario || '')}</p>
          </div>
        </div>

        ${warnings ? `<div class="card analyzer-warnings"><h2>${t('analyzer.result.warnings')}</h2><ul>${warnings}</ul></div>` : ''}
        ${checklist ? `<div class="card analyzer-checklist"><h2>${t('analyzer.result.checklist')}</h2><ul>${checklist}</ul></div>` : ''}

        <p class="analyzer-disclaimer">${t('analyzer.disclaimer')}</p>
      </div>`;

    el.querySelectorAll('.analyzer-apply-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.tfIndex, 10);
        const tf = analysis.timeframeAnalysis?.[idx];
        if (tf && hooks?.onApplyToTrade) hooks.onApplyToTrade(analysis, tf);
      });
    });
  }

  async function runAnalysis() {
    if (!currentImage || analyzing) return;

    if (location.protocol === 'file:') {
      hooks?.showToast?.(t('analyzer.toast.needHttp'));
      return;
    }

    setAnalyzing(true);
    currentAnalysis = null;

    try {
      const profile = hooks?.getProfile?.() || {};
      const res = await fetch('/api/analyze-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: currentImage,
          asset: $('#analyzerAsset')?.value?.trim() || profile.mainMarket || '',
          market: $('#analyzerMarket')?.value || '',
          strategy: profile.strategy || '',
          notes: $('#analyzerNotes')?.value?.trim() || '',
          timeframes: getSelectedTimeframes()
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const hint = data.hint ? `\n${data.hint}` : '';
        throw new Error((data.error || data.detail || `Erreur ${res.status}`) + hint);
      }

      currentAnalysis = data.analysis;
      renderAnalysis(currentAnalysis);

      const history = loadHistory();
      history.unshift({
        id: `ana_${Date.now()}`,
        createdAt: data.analyzedAt || new Date().toISOString(),
        asset: currentAnalysis.summary?.asset || $('#analyzerAsset')?.value || '',
        bias: currentAnalysis.summary?.bias,
        thumb: currentImage,
        analysis: currentAnalysis
      });
      saveHistory(history);
      renderHistory();

      hooks?.showToast?.(t('analyzer.toast.done'));
    } catch (err) {
      console.error(err);
      const status = $('#analyzerStatus');
      if (status) {
        status.textContent = err.message || t('analyzer.status.error');
        status.className = 'analyzer-status analyzer-status--error';
      }
      hooks?.showToast?.(err.message || t('analyzer.status.error'));
    } finally {
      setAnalyzing(false);
    }
  }

  function renderHistory() {
    const el = $('#analyzerHistory');
    if (!el) return;
    const items = loadHistory();
    if (!items.length) {
      el.innerHTML = `<p class="empty-state">${t('analyzer.history.empty')}</p>`;
      return;
    }

    el.innerHTML = items.map((item, i) => {
      const bias = biasLabel(item.bias);
      const date = new Date(item.createdAt).toLocaleString('fr-FR');
      return `
        <button type="button" class="analyzer-history-item" data-history-index="${i}">
          <img src="${item.thumb}" alt="" class="analyzer-history-thumb" loading="lazy">
          <div class="analyzer-history-meta">
            <span class="analyzer-history-asset">${escapeHtml(item.asset || 'Capture')}</span>
            <span class="analyzer-bias ${bias.cls}">${bias.text}</span>
            <span class="analyzer-history-date">${date}</span>
          </div>
        </button>`;
    }).join('');

    el.querySelectorAll('.analyzer-history-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.historyIndex, 10);
        const item = loadHistory()[idx];
        if (!item) return;
        currentImage = item.thumb;
        currentAnalysis = item.analysis;
        setPreview(item.thumb);
        renderAnalysis(item.analysis);
      });
    });
  }

  function initUI() {
    const dropzone = $('#analyzerDropzone');
    const fileInput = $('#analyzerFileInput');

    dropzone?.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      fileInput?.click();
    });
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadImageFile(file);
      e.target.value = '';
    });

    dropzone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('analyzer-dropzone--over');
    });
    dropzone?.addEventListener('dragleave', () => {
      dropzone.classList.remove('analyzer-dropzone--over');
    });
    dropzone?.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('analyzer-dropzone--over');
      const file = e.dataTransfer?.files?.[0];
      if (file) loadImageFile(file);
    });

    document.addEventListener('paste', (e) => {
      const section = document.getElementById('section-analyzer');
      if (!section?.classList.contains('active')) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) loadImageFile(file);
          break;
        }
      }
    });

    $('#analyzerRunBtn')?.addEventListener('click', runAnalysis);
    $('#analyzerClearBtn')?.addEventListener('click', () => {
      currentImage = null;
      currentAnalysis = null;
      setPreview(null);
      const results = $('#analyzerResults');
      if (results) results.innerHTML = '';
      $('#analyzerStatus').textContent = '';
    });

    $('#analyzerClearHistoryBtn')?.addEventListener('click', () => {
      if (!confirm(t('analyzer.history.confirmClear'))) return;
      const key = historyKey();
      if (key) localStorage.removeItem(key);
      renderHistory();
    });

    renderHistory();
  }

  function configure(h) {
    hooks = h;
    renderHistory();
  }

  function refresh() {
    const profile = hooks?.getProfile?.() || {};
    const assetEl = $('#analyzerAsset');
    if (assetEl && !assetEl.value && profile.mainMarket) {
      assetEl.placeholder = profile.mainMarket;
    }
    renderHistory();
  }

  global.TradeAnalyzer = {
    configure,
    initUI,
    refresh,
    getCurrentAnalysis: () => currentAnalysis
  };
})(typeof window !== 'undefined' ? window : globalThis);
