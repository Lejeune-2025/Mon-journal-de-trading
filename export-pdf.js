/**
 * Export du journal de trading au format PDF (.pdf)
 * Génère un rapport HTML complet puis conversion via html2pdf.js (CDN).
 */
(function () {
  'use strict';

  const HTML2PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';

  const cj = () => window.TradingJournalCurrency;
  const formatMoney = (n) => (cj() ? cj().formatMoney(n) : `$${n}`);
  const formatMoneyUnsigned = (n) => (cj() ? cj().formatMoneyUnsigned(n) : `$${n}`);
  const withCurrency = (n) => (cj() ? cj().withCurrency(n) : `$${n}`);

  function getLocale() {
    return window.I18n?.getLocale?.() === 'en' ? 'en' : 'fr';
  }

  function labels(locale) {
    if (locale === 'en') {
      return {
        appSubtitle: 'Professional trading journal — full export',
        exportedOn: 'Exported on',
        profile: 'Trader profile',
        userProfile: 'User profile',
        traderName: 'Trader name',
        mainMarket: 'Main market',
        strategy: 'Strategy',
        startingCapital: 'Starting capital',
        maxRisk: 'Max risk per trade',
        kpiTitle: 'Performance summary',
        totalTrades: 'Total trades',
        winners: 'Winning trades',
        losers: 'Losing trades',
        winRate: 'Win rate',
        avgWin: 'Average win',
        avgLoss: 'Average loss',
        profitFactor: 'Profit factor',
        netPnL: 'Net P/L',
        maxDD: 'Max drawdown',
        planRate: 'Plan respected',
        avgR: 'Average R multiple',
        overviewTitle: 'Trade overview',
        colDate: 'Date',
        colAsset: 'Symbol',
        colSide: 'Side',
        colResult: 'P/L',
        colR: 'R',
        colPlan: 'Plan',
        weeklyTitle: 'Weekly reviews',
        weekOf: 'Week of',
        good: 'What worked well',
        improve: 'Areas to improve',
        errors: 'Recurring errors',
        goal: 'Goal for next week',
        personalNotes: 'Personal notes',
        checklistTitle: 'Pre-trade checklist',
        tradeDetail: 'Trade details',
        tradeN: 'Trade',
        generalInfo: 'General information',
        tradePlan: 'Trade plan',
        emotions: 'Emotional management',
        discipline: 'Errors & discipline',
        screenshots: 'Screenshots',
        before: 'Before trade',
        after: 'After trade',
        noScreenshot: 'No screenshot',
        noTrades: 'No trades recorded.',
        entryReason: 'Entry rationale',
        marketConditions: 'Market context',
        timeframes: 'Timeframes',
        emotionBefore: 'Emotion (before)',
        emotionDuring: 'Emotion (during)',
        emotionAfter: 'Emotion (after)',
        emotionComments: 'Emotional notes',
        planRespected: 'Plan respected?',
        errorsCommitted: 'Errors',
        errorDetail: 'Error details',
        lesson: 'Lesson learned',
        date: 'Trade date',
        asset: 'Symbol',
        direction: 'Side',
        entry: 'Entry price',
        sl: 'Stop loss',
        tp: 'Take profit',
        size: 'Position size',
        risk: 'Risk',
        resultType: 'Result type',
        resultAmount: 'P/L amount',
        plannedRR: 'Planned R/R',
        actualRR: 'Actual R/R',
        rMultiple: 'R multiple',
        none: 'None',
        confidential: 'Confidential document — for personal use only',
        checklist: [
          'The trade fits my strategy.',
          'Risk is defined before entry.',
          'Stop loss is at a logical level.',
          'Target is realistic.',
          'Risk/reward ratio is acceptable.',
          'I am not trading on emotion.',
          'I am not increasing size to recover losses.',
          'I accept the potential loss before entering.',
        ],
      };
    }
    return {
      appSubtitle: 'Journal de trading professionnel — export complet',
      exportedOn: 'Exporté le',
      profile: 'Profil du trader',
      userProfile: 'Profil utilisateur',
      traderName: 'Nom du trader',
      mainMarket: 'Marché principal',
      strategy: 'Stratégie',
      startingCapital: 'Capital de départ',
      maxRisk: 'Risque max. par trade',
      kpiTitle: 'Synthèse de performance',
      totalTrades: 'Total trades',
      winners: 'Trades gagnants',
      losers: 'Trades perdants',
      winRate: 'Taux de réussite',
      avgWin: 'Gain moyen',
      avgLoss: 'Perte moyenne',
      profitFactor: 'Profit factor',
      netPnL: 'Résultat net',
      maxDD: 'Drawdown maximum',
      planRate: 'Respect du plan',
      avgR: 'Ratio R moyen',
      overviewTitle: 'Suivi des trades — vue d\'ensemble',
      colDate: 'Date',
      colAsset: 'Actif',
      colSide: 'Sens',
      colResult: 'Résultat',
      colR: 'R Multiple',
      colPlan: 'Plan',
      weeklyTitle: 'Analyses hebdomadaires',
      weekOf: 'Semaine du',
      good: 'Ce qui a bien fonctionné',
      improve: 'Ce qui doit être amélioré',
      errors: 'Erreurs récurrentes',
      goal: 'Objectif semaine prochaine',
      personalNotes: 'Notes personnelles',
      checklistTitle: 'Checklist pré-trade',
      tradeDetail: 'Détail des trades',
      tradeN: 'Trade',
      generalInfo: 'Informations générales',
      tradePlan: 'Plan de trade',
      emotions: 'Gestion émotionnelle',
      discipline: 'Erreurs et discipline',
      screenshots: 'Captures avant / après',
      before: 'Avant le trade',
      after: 'Après le trade',
      noScreenshot: 'Aucune capture',
      noTrades: 'Aucun trade enregistré.',
      entryReason: "Raison de l'entrée",
      marketConditions: 'Conditions de marché',
      timeframes: 'Unités de temps',
      emotionBefore: "État émotionnel avant l'entrée",
      emotionDuring: 'État émotionnel pendant le trade',
      emotionAfter: 'État émotionnel après le trade',
      emotionComments: 'Commentaires émotionnels',
      planRespected: 'Plan de trading respecté ?',
      errorsCommitted: 'Erreurs commises',
      errorDetail: 'Description des erreurs',
      lesson: 'Leçon à retenir',
      date: 'Date du trade',
      asset: 'Actif tradé',
      direction: 'Sens',
      entry: "Prix d'entrée",
      sl: 'Stop Loss',
      tp: 'Objectif / Take Profit',
      size: 'Taille de position',
      risk: 'Risque',
      resultType: 'Résultat du trade',
      resultAmount: 'Montant du résultat',
      plannedRR: 'Ratio R/R prévu',
      actualRR: 'Ratio R/R réalisé',
      rMultiple: 'R Multiple',
      none: 'Aucune',
      confidential: 'Document confidentiel — usage personnel uniquement',
      checklist: [
        'Le trade respecte ma stratégie.',
        'Le risque est défini avant l\'entrée.',
        'Le Stop Loss est placé à un niveau logique.',
        'L\'objectif est réaliste.',
        'Le ratio risque/rendement est acceptable.',
        'Je ne suis pas en train de trader sous l\'émotion.',
        'Je n\'augmente pas la taille de position pour me refaire.',
        'J\'accepte la perte potentielle avant d\'entrer.',
      ],
    };
  }

  function formatDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function val(v) {
    return v !== null && v !== undefined && v !== '' ? esc(v) : '—';
  }

  function calcActualRR(resultAmount, riskAmount) {
    if (!resultAmount || !riskAmount || parseFloat(riskAmount) === 0) return '—';
    return (parseFloat(resultAmount) / parseFloat(riskAmount)).toFixed(2);
  }

  function calcPlannedRR(entry, sl, tp, direction) {
    if (!entry || !sl || !tp) return '—';
    const risk = Math.abs(entry - sl);
    const reward = direction === 'Vente' ? entry - tp : tp - entry;
    if (risk === 0) return '—';
    return (reward / risk).toFixed(2);
  }

  function computeKPIs(trades, startingCapital) {
    const total = trades.length;
    const winners = trades.filter((t) => parseFloat(t.resultAmount) > 0);
    const losers = trades.filter((t) => parseFloat(t.resultAmount) < 0);
    const totalGains = winners.reduce((s, t) => s + parseFloat(t.resultAmount), 0);
    const totalLosses = Math.abs(losers.reduce((s, t) => s + parseFloat(t.resultAmount), 0));
    const net = totalGains - totalLosses;
    const winRate = total ? ((winners.length / total) * 100).toFixed(1) : '0.0';
    const avgWin = winners.length ? (totalGains / winners.length).toFixed(2) : '0.00';
    const avgLoss = losers.length ? (totalLosses / losers.length).toFixed(2) : '0.00';
    const profitFactor = totalLosses > 0 ? (totalGains / totalLosses).toFixed(2) : totalGains > 0 ? '∞' : '0.00';
    const planRespected = trades.filter((t) => t.planRespected === 'Oui').length;
    const planRate = total ? ((planRespected / total) * 100).toFixed(1) : '0.0';
    const rMultiples = trades.map((t) => calcActualRR(t.resultAmount, t.riskAmount)).filter((r) => r !== '—').map(Number);
    const avgR = rMultiples.length ? (rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length).toFixed(2) : '0.00';

    let running = parseFloat(startingCapital) || 0;
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
      total, winners: winners.length, losers: losers.length, winRate, net, avgWin, avgLoss,
      profitFactor, planRate, maxDD, avgR,
    };
  }

  function infoTable(rows) {
    return `<table class="tj-pdf-table tj-pdf-info">${rows.map(([l, v]) =>
      `<tr><th>${esc(l)}</th><td>${val(v)}</td></tr>`
    ).join('')}</table>`;
  }

  function resultClass(amount) {
    const n = parseFloat(amount);
    if (n > 0) return 'positive';
    if (n < 0) return 'negative';
    return '';
  }

  function buildTradeBlock(trade, index, L) {
    const planned = trade.plannedRR || calcPlannedRR(
      parseFloat(trade.entryPrice),
      parseFloat(trade.stopLoss),
      parseFloat(trade.takeProfit),
      trade.direction
    );
    const actualR = trade.actualRR || calcActualRR(trade.resultAmount, trade.riskAmount);

    const img = (src, title) => {
      if (!src) {
        return `<p class="tj-pdf-muted"><strong>${esc(title)}</strong> — ${esc(L.noScreenshot)}</p>`;
      }
      return `<figure class="tj-pdf-figure avoid-break"><figcaption>${esc(title)}</figcaption><img src="${src}" alt="${esc(title)}" /></figure>`;
    };

    return `
      <section class="tj-pdf-trade page-break-before">
        <h2 class="tj-pdf-trade-title">${esc(L.tradeN)} ${index + 1} — ${val(trade.asset)} <span class="tj-pdf-date">(${formatDate(trade.date)})</span></h2>

        <h3>${esc(L.generalInfo)}</h3>
        ${infoTable([
          [L.date, formatDate(trade.date)],
          [L.asset, trade.asset],
          [L.direction, trade.direction],
          [L.entry, trade.entryPrice],
          [L.sl, trade.stopLoss],
          [L.tp, trade.takeProfit],
          [L.size, trade.positionSize],
          [L.risk, trade.riskAmount ? withCurrency(trade.riskAmount) : ''],
          [L.resultType, trade.resultType],
          [L.resultAmount, formatMoney(trade.resultAmount)],
          [L.plannedRR, planned],
          [L.actualRR, actualR],
          [L.rMultiple, calcActualRR(trade.resultAmount, trade.riskAmount)],
        ])}

        <h3>${esc(L.tradePlan)}</h3>
        <p><strong>${esc(L.entryReason)} :</strong> ${val(trade.entryReason)}</p>
        <p><strong>${esc(L.marketConditions)} :</strong> ${val((trade.marketConditions || []).join(', ') || L.none)}</p>
        <p><strong>${esc(L.timeframes)} :</strong> ${val((trade.timeframes || []).join(', ') || L.none)}</p>

        <h3>${esc(L.emotions)}</h3>
        ${infoTable([
          [L.emotionBefore, trade.emotionBefore],
          [L.emotionDuring, trade.emotionDuring],
          [L.emotionAfter, trade.emotionAfter],
        ])}
        ${trade.emotionComments ? `<p><strong>${esc(L.emotionComments)} :</strong> ${val(trade.emotionComments)}</p>` : ''}

        <h3>${esc(L.discipline)}</h3>
        ${infoTable([
          [L.planRespected, trade.planRespected],
          [L.errorsCommitted, (trade.errors || []).join(', ') || L.none],
        ])}
        ${trade.errorDescription ? `<p><strong>${esc(L.errorDetail)} :</strong> ${val(trade.errorDescription)}</p>` : ''}
        ${trade.lessonLearned ? `<p class="tj-pdf-lesson"><strong>${esc(L.lesson)} :</strong> <em>${val(trade.lessonLearned)}</em></p>` : ''}

        <h3>${esc(L.screenshots)}</h3>
        ${img(trade.screenshotBefore, L.before)}
        ${img(trade.screenshotAfter, L.after)}
      </section>`;
  }

  function buildPdfHtml(journalData) {
    const locale = getLocale();
    const L = labels(locale);
    const appName = window.I18n?.t?.('app.name') || (locale === 'en' ? 'My Trading Journal' : 'Mon Trading Journal');
    const { profile, trades, weeklyNotes, personalNotes, checklist, userName } = journalData;
    const kpi = computeKPIs(trades, profile.startingCapital);
    const exportDate = new Date().toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
    const sortedTrades = [...trades].sort((a, b) => b.date.localeCompare(a.date));
    const detailTrades = [...trades].sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const kpiGrid = `
      <div class="tj-pdf-kpi-grid avoid-break">
        <div class="tj-pdf-kpi"><span>${esc(L.totalTrades)}</span><strong>${kpi.total}</strong></div>
        <div class="tj-pdf-kpi"><span>${esc(L.winRate)}</span><strong>${kpi.winRate} %</strong></div>
        <div class="tj-pdf-kpi"><span>${esc(L.netPnL)}</span><strong class="${resultClass(kpi.net)}">${formatMoney(kpi.net)}</strong></div>
        <div class="tj-pdf-kpi"><span>${esc(L.profitFactor)}</span><strong>${esc(kpi.profitFactor)}</strong></div>
        <div class="tj-pdf-kpi"><span>${esc(L.planRate)}</span><strong>${kpi.planRate} %</strong></div>
        <div class="tj-pdf-kpi"><span>${esc(L.avgR)}</span><strong>${kpi.avgR}</strong></div>
      </div>
      <table class="tj-pdf-table avoid-break">
        <tbody>
          <tr><th>${esc(L.winners)}</th><td>${kpi.winners}</td><th>${esc(L.losers)}</th><td>${kpi.losers}</td></tr>
          <tr><th>${esc(L.avgWin)}</th><td class="positive">${formatMoneyUnsigned(kpi.avgWin)}</td><th>${esc(L.avgLoss)}</th><td class="negative">${formatMoneyUnsigned(kpi.avgLoss)}</td></tr>
          <tr><th>${esc(L.maxDD)}</th><td colspan="3">${formatMoneyUnsigned(kpi.maxDD)}</td></tr>
        </tbody>
      </table>`;

    let overviewTable = '';
    if (sortedTrades.length) {
      overviewTable = `
        <h2 class="page-break-before">${esc(L.overviewTitle)}</h2>
        <table class="tj-pdf-table tj-pdf-overview">
          <thead><tr>
            <th>${esc(L.colDate)}</th><th>${esc(L.colAsset)}</th><th>${esc(L.colSide)}</th>
            <th>${esc(L.colResult)}</th><th>${esc(L.colR)}</th><th>${esc(L.colPlan)}</th>
          </tr></thead>
          <tbody>${sortedTrades.map((t) => `
            <tr>
              <td>${formatDate(t.date)}</td>
              <td>${val(t.asset)}</td>
              <td>${val(t.direction)}</td>
              <td class="${resultClass(t.resultAmount)}">${formatMoney(t.resultAmount)}</td>
              <td>${calcActualRR(t.resultAmount, t.riskAmount)}</td>
              <td>${val(t.planRespected)}</td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    }

    const weekKeys = Object.keys(weeklyNotes || {}).sort().reverse();
    let weeklyHtml = '';
    if (weekKeys.length) {
      weeklyHtml = `<h2 class="page-break-before">${esc(L.weeklyTitle)}</h2>`;
      weekKeys.forEach((key) => {
        const notes = weeklyNotes[key] || {};
        weeklyHtml += `<article class="tj-pdf-week avoid-break"><h3>${esc(L.weekOf)} ${formatDate(key)}</h3>`;
        [[L.good, notes.good], [L.improve, notes.improve], [L.errors, notes.errors], [L.goal, notes.goal]]
          .forEach(([label, text]) => {
            if (text) weeklyHtml += `<p><strong>${esc(label)} :</strong> ${val(text)}</p>`;
          });
        weeklyHtml += '</article>';
      });
    }

    let notesHtml = '';
    if (personalNotes && personalNotes.trim()) {
      notesHtml = `<h2 class="page-break-before">${esc(L.personalNotes)}</h2><p class="tj-pdf-notes">${val(personalNotes)}</p>`;
    }

    let checklistHtml = '';
    if (checklist && checklist.length) {
      checklistHtml = `<h2 class="page-break-before">${esc(L.checklistTitle)}</h2><ul class="tj-pdf-checklist">`;
      L.checklist.forEach((item, i) => {
        const mark = checklist[i] ? '☑' : '☐';
        checklistHtml += `<li>${mark} ${esc(item)}</li>`;
      });
      checklistHtml += '</ul>';
    }

    const tradesHtml = detailTrades.length
      ? detailTrades.map((t, i) => buildTradeBlock(t, i, L)).join('')
      : `<p class="tj-pdf-muted">${esc(L.noTrades)}</p>`;

    return `<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 10.5pt; line-height: 1.45; color: #111827; margin: 0; padding: 0; background: #fff; }
  .tj-pdf { padding: 0 4mm; }
  .tj-pdf-cover { text-align: center; padding: 28mm 8mm 20mm; border-bottom: 2px solid #1e40af; margin-bottom: 10mm; }
  .tj-pdf-cover h1 { font-size: 22pt; color: #1e40af; margin: 0 0 6px; font-weight: 700; letter-spacing: -0.02em; }
  .tj-pdf-cover .subtitle { font-size: 11pt; color: #4b5563; margin: 0 0 14px; }
  .tj-pdf-cover .meta { font-size: 10pt; color: #6b7280; }
  .tj-pdf-footer-note { text-align: center; font-size: 8.5pt; color: #9ca3af; margin-top: 16mm; padding-top: 6mm; border-top: 1px solid #e5e7eb; }
  h2 { font-size: 14pt; color: #1e40af; margin: 14px 0 8px; page-break-after: avoid; }
  h3 { font-size: 11pt; color: #374151; margin: 12px 0 6px; page-break-after: avoid; }
  .tj-pdf-trade-title { font-size: 13pt; border-left: 4px solid #1e40af; padding-left: 10px; }
  .tj-pdf-date { font-weight: 400; color: #6b7280; font-size: 10pt; }
  .tj-pdf-table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; }
  .tj-pdf-table th, .tj-pdf-table td { border: 1px solid #d1d5db; padding: 5px 7px; text-align: left; vertical-align: top; }
  .tj-pdf-table th { background: #f3f4f6; font-weight: 600; width: 38%; }
  .tj-pdf-info th { width: 42%; }
  .tj-pdf-overview th { background: #1e40af; color: #fff; font-size: 9pt; }
  .tj-pdf-overview td { font-size: 9pt; }
  .positive { color: #059669; font-weight: 600; }
  .negative { color: #dc2626; font-weight: 600; }
  .tj-pdf-kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .tj-pdf-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; text-align: center; }
  .tj-pdf-kpi span { display: block; font-size: 8.5pt; color: #64748b; margin-bottom: 4px; }
  .tj-pdf-kpi strong { font-size: 12pt; color: #0f172a; }
  .tj-pdf-muted { color: #6b7280; font-style: italic; }
  .tj-pdf-lesson em { font-style: italic; }
  .tj-pdf-notes { white-space: pre-wrap; background: #f9fafb; padding: 10px; border-radius: 6px; border: 1px solid #e5e7eb; }
  .tj-pdf-week { margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb; }
  .tj-pdf-checklist { list-style: none; padding: 0; margin: 0; }
  .tj-pdf-checklist li { padding: 4px 0; font-size: 10pt; }
  .tj-pdf-figure { margin: 10px 0; text-align: center; }
  .tj-pdf-figure figcaption { font-size: 9pt; font-weight: 600; color: #374151; margin-bottom: 6px; text-align: left; }
  .tj-pdf-figure img { max-width: 100%; max-height: 220px; border: 1px solid #e5e7eb; border-radius: 4px; }
  .tj-pdf-trade { margin-bottom: 8mm; }
  .page-break-before { page-break-before: always; }
  .avoid-break { page-break-inside: avoid; }
  p { margin: 4px 0 8px; }
</style>
<div class="tj-pdf">
  <header class="tj-pdf-cover avoid-break">
    <h1>${esc(appName)}</h1>
    <p class="subtitle">${esc(L.appSubtitle)}</p>
    <p class="meta">${esc(L.exportedOn)} ${esc(exportDate)}</p>
  </header>

  <h2>${esc(L.profile)}</h2>
  ${infoTable([
    [L.traderName, profile.traderName],
    [L.userProfile, userName],
    [L.mainMarket, profile.mainMarket],
    [L.strategy, profile.strategy],
    [L.startingCapital, profile.startingCapital ? formatMoneyUnsigned(profile.startingCapital) : ''],
    [L.maxRisk, profile.maxRisk ? `${profile.maxRisk} %` : ''],
  ])}

  <h2>${esc(L.kpiTitle)}</h2>
  ${kpiGrid}
  ${overviewTable}
  ${weeklyHtml}
  ${notesHtml}
  ${checklistHtml}

  <h2 class="page-break-before">${esc(L.tradeDetail)}</h2>
  ${tradesHtml}

  <p class="tj-pdf-footer-note">${esc(L.confidential)} — ${esc(appName)}</p>
</div>`;
  }

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-tj-html2pdf]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.html2pdf));
        existing.addEventListener('error', reject);
        return;
      }
      const script = document.createElement('script');
      script.src = HTML2PDF_URL;
      script.async = true;
      script.dataset.tjHtml2pdf = '1';
      script.onload = () => resolve(window.html2pdf);
      script.onerror = () => reject(new Error('html2pdf load failed'));
      document.head.appendChild(script);
    });
  }

  function slugify(name) {
    return (name || 'journal')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 40) || 'journal';
  }

  async function exportJournalToPdf(journalData) {
    const html2pdf = await loadHtml2Pdf();
    const html = buildPdfHtml(journalData);
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:0;top:0;width:210mm;background:#fff;opacity:0.01;pointer-events:none;z-index:-1;overflow:hidden;max-height:100vh;';
    host.innerHTML = html;
    document.body.appendChild(host);
    const element = host.querySelector('.tj-pdf');
    if (!element) throw new Error('PDF layout failed');

    const trader = journalData.profile?.traderName || journalData.userName || 'journal';
    const filename = `mon-trading-journal_${slugify(trader)}_${new Date().toISOString().slice(0, 10)}.pdf`;

    try {
      await html2pdf().set({
        margin: [12, 10, 14, 10],
        filename,
        image: { type: 'jpeg', quality: 0.88 },
        html2canvas: { scale: 2, useCORS: true, logging: false, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: '.page-break-before', avoid: '.avoid-break' },
      }).from(element).save();
    } finally {
      document.body.removeChild(host);
    }
  }

  window.TradingJournalPdfExport = {
    exportAll: exportJournalToPdf,
  };
})();
