/**
 * Internationalisation — langue du navigateur (fr / en).
 */
(function (global) {
  'use strict';

  const MESSAGES = {
    fr: {
      'app.name': 'Mon Trading Journal',
      'meta.title': 'Mon Trading Journal',
      'splash.loading': 'Chargement du journal…',
      'nav.dashboard': 'Tableau de bord',
      'nav.profile': 'Profil trader',
      'nav.newTrade': 'Nouveau trade',
      'nav.trades': 'Historique',
      'nav.weekly': 'Analyse hebdo',
      'nav.checklist': 'Checklist',
      'nav.notes': 'Notes',
      'nav.sync': 'Sync mobile',
      'nav.analyzer': 'Analyseur',
      'analyzer.title': 'Analyseur de trade',
      'analyzer.intro': 'Envoyez une capture de votre graphique avant de trader. L\'analyseur identifie la structure, les niveaux clés et propose des points d\'entrée par timeframe.',
      'analyzer.asset': 'Actif (optionnel)',
      'analyzer.market': 'Marché',
      'analyzer.timeframes': 'Timeframes à analyser',
      'analyzer.notes': 'Notes / contexte (optionnel)',
      'analyzer.upload': 'Capture du graphique',
      'analyzer.dropzone': 'Cliquez, glissez-déposez ou collez (Ctrl+V) une capture',
      'analyzer.run': 'Analyser le graphique',
      'analyzer.clear': 'Effacer',
      'analyzer.confidence': 'Confiance',
      'analyzer.applyTrade': 'Utiliser pour un nouveau trade',
      'analyzer.disclaimer': 'Analyse indicative — ne constitue pas un conseil en investissement. Vérifiez toujours votre plan et votre gestion du risque.',
      'analyzer.result.title': 'Synthèse',
      'analyzer.result.timeframes': 'Plans par timeframe',
      'analyzer.result.scenarios': 'Scénarios',
      'analyzer.result.primary': 'Scénario principal',
      'analyzer.result.alternative': 'Scénario alternatif',
      'analyzer.result.warnings': 'Risques & alertes',
      'analyzer.result.checklist': 'Checklist pré-entrée',
      'analyzer.levels.supports': 'Supports',
      'analyzer.levels.resistances': 'Résistances',
      'analyzer.history.title': 'Historique des analyses',
      'analyzer.history.clear': 'Effacer l\'historique',
      'analyzer.history.empty': 'Aucune analyse enregistrée.',
      'analyzer.history.confirmClear': 'Effacer tout l\'historique des analyses ?',
      'analyzer.toast.imageRequired': 'Sélectionnez une image (PNG, JPG…)',
      'analyzer.toast.imageReady': 'Capture prête — lancez l\'analyse',
      'analyzer.toast.imageError': 'Impossible de charger l\'image',
      'analyzer.toast.needHttp': 'L\'analyseur nécessite HTTP/HTTPS (pas file://)',
      'analyzer.toast.done': 'Analyse terminée',
      'analyzer.status.analyzing': 'Analyse en cours… (15–45 s)',
      'analyzer.status.error': 'Échec de l\'analyse',
      'analyzer.toast.applied': 'Formulaire pré-rempli depuis l\'analyse',
      'nav.closeMenu': 'Fermer le menu',
      'nav.openMenu': 'Ouvrir le menu',
      'nav.changeProfile': 'Changer de profil',
      'persist.note': 'Données sauvegardées automatiquement sur cet ordinateur',
      'btn.exportWord': 'Exporter Word (.docx)',
      'btn.exportPdf': 'Exporter PDF (.pdf)',
      'toast.pdfModule': 'Module d\'export PDF non chargé',
      'toast.pdfGenerating': 'Génération du rapport PDF en cours…',
      'toast.pdfDone': 'Rapport PDF téléchargé',
      'toast.pdfError': 'Erreur export PDF. Connexion internet requise (1ère fois).',
      'saveIndicator.local': 'Données conservées localement',
      'saveIndicator.saved': 'Sauvegardé automatiquement',
      'period.currentWeek': 'Semaine en cours',
      'workflow.title': 'Comment enregistrer un trade ?',
      'workflow.lead': 'La checklist se fait avant d’ouvrir une position. Le nouveau trade se remplit après (ou pendant) le trade — c’est l’étape principale du journal. Les notes personnelles sont libres et ne remplacent pas le formulaire trade.',
      'workflow.step1.title': 'Checklist pré-trade',
      'workflow.step1.desc': 'Vérifiez votre discipline avant de prendre une position. Ce n’est pas obligatoire pour enregistrer un trade.',
      'workflow.step1.open': 'Ouvrir la checklist',
      'workflow.step2.title': 'Nouveau trade',
      'workflow.step2.desc': 'Enregistrez le trade ici : résultat, plan, émotions, captures. Faites cette étape après la checklist (si vous l’utilisez).',
      'workflow.step2.hint': ' Utilisez le bouton + en bas de l’écran.',
      'workflow.step2.btn': '+ Nouveau trade',
      'workflow.step3.title': 'Notes personnelles',
      'workflow.step3.desc': 'Réflexions générales sur votre trading (pas le détail d’un trade précis — utilisez le formulaire ci-dessus pour ça).',
      'workflow.step3.open': 'Ouvrir les notes',
      'workflow.footnote': 'En fin de semaine :',
      'workflow.weekly': 'Analyse hebdomadaire',
      'workflow.footnoteEnd': '(synthèse, pas à chaque trade).',
      'workflow.meta.empty': 'Checklist : pas encore commencée (facultatif).',
      'workflow.meta.ready': 'Checklist : {done}/{total} — prête. Passez à « Nouveau trade ».',
      'workflow.meta.partial': 'Checklist : {done}/{total} points cochés.',
      'chart.week': 'Semaine',
      'chart.all': 'Tout',
      'chart.equity': "Courbe d'équité",
      'trades.weekTitle': 'Trades de la semaine',
      'trades.empty': 'Aucun trade enregistré. Utilisez l’étape « Nouveau trade » dans le guide ci-dessus.',
      'terms.title': "Conditions d'utilisation",
      'terms.welcome': 'Bienvenue sur {appName}. En utilisant ce site, vous acceptez les points suivants :',
      'terms.check': "J'ai lu et j'accepte les conditions d'utilisation",
      'terms.continue': 'Continuer',
      'cookies.title': 'Ce site utilise des cookies',
      'cookies.text': 'Nous utilisons des cookies pour le bon fonctionnement du site. Les cookies d’analyse ne sont activés que si vous acceptez.',
      'cookies.refuse': 'Refuser',
      'cookies.accept': 'Accepter',
      'confirm.title': 'Confirmation',
      'confirm.cancel': 'Annuler',
      'confirm.ok': 'Confirmer',
      'profile.modalTitle': 'Choisir un profil',
      'profile.modalIntro': 'Chaque profil possède ses propres trades et statistiques.',
      'profile.createLabel': 'Créer un nouveau profil',
      'profile.createPlaceholder': 'Votre prénom ou pseudo',
      'profile.createBtn': 'Créer et continuer',
      'profile.cancel': 'Annuler',
      'bottom.home': 'Accueil',
      'bottom.trades': 'Trades',
      'bottom.sync': 'Sync',
      'bottom.menu': 'Menu'
    },
    en: {
      'app.name': 'My Trading Journal',
      'meta.title': 'My Trading Journal',
      'splash.loading': 'Loading journal…',
      'nav.dashboard': 'Dashboard',
      'nav.profile': 'Trader profile',
      'nav.newTrade': 'New trade',
      'nav.trades': 'History',
      'nav.weekly': 'Weekly review',
      'nav.checklist': 'Checklist',
      'nav.notes': 'Notes',
      'nav.sync': 'Mobile sync',
      'nav.analyzer': 'Analyzer',
      'analyzer.title': 'Trade analyzer',
      'analyzer.intro': 'Upload a chart screenshot before trading. The analyzer identifies structure, key levels and entry points per timeframe.',
      'analyzer.asset': 'Asset (optional)',
      'analyzer.market': 'Market',
      'analyzer.timeframes': 'Timeframes to analyze',
      'analyzer.notes': 'Notes / context (optional)',
      'analyzer.upload': 'Chart screenshot',
      'analyzer.dropzone': 'Click, drag & drop or paste (Ctrl+V) a screenshot',
      'analyzer.run': 'Analyze chart',
      'analyzer.clear': 'Clear',
      'analyzer.apiNote': 'Requires Vercel deployment with OPENAI_API_KEY configured.',
      'analyzer.confidence': 'Confidence',
      'analyzer.applyTrade': 'Use for new trade',
      'analyzer.disclaimer': 'Indicative analysis — not investment advice. Always verify your plan and risk management.',
      'analyzer.result.title': 'Summary',
      'analyzer.result.timeframes': 'Plans per timeframe',
      'analyzer.result.scenarios': 'Scenarios',
      'analyzer.result.primary': 'Primary scenario',
      'analyzer.result.alternative': 'Alternative scenario',
      'analyzer.result.warnings': 'Risks & warnings',
      'analyzer.result.checklist': 'Pre-entry checklist',
      'analyzer.levels.supports': 'Supports',
      'analyzer.levels.resistances': 'Resistances',
      'analyzer.history.title': 'Analysis history',
      'analyzer.history.clear': 'Clear history',
      'analyzer.history.empty': 'No saved analyses.',
      'analyzer.history.confirmClear': 'Clear all analysis history?',
      'analyzer.toast.imageRequired': 'Select an image (PNG, JPG…)',
      'analyzer.toast.imageReady': 'Screenshot ready — run analysis',
      'analyzer.toast.imageError': 'Could not load image',
      'analyzer.toast.needHttp': 'Analyzer requires HTTP/HTTPS (not file://)',
      'analyzer.toast.done': 'Analysis complete',
      'analyzer.status.analyzing': 'Analyzing… (15–45 s)',
      'analyzer.status.error': 'Analysis failed',
      'analyzer.toast.applied': 'Form pre-filled from analysis',
      'nav.closeMenu': 'Close menu',
      'nav.openMenu': 'Open menu',
      'nav.changeProfile': 'Switch profile',
      'persist.note': 'Data saved automatically on this device',
      'btn.exportWord': 'Export Word (.docx)',
      'btn.exportPdf': 'Export PDF (.pdf)',
      'btn.print': 'Print',
      'toast.pdfModule': 'PDF export module not loaded',
      'toast.pdfGenerating': 'Generating PDF report…',
      'toast.pdfDone': 'PDF report downloaded',
      'toast.pdfError': 'PDF export failed. Internet required (first time).',
      'saveIndicator.local': 'Data stored locally',
      'saveIndicator.saved': 'Saved automatically',
      'period.currentWeek': 'Current week',
      'workflow.title': 'How to log a trade?',
      'workflow.lead': 'Complete the checklist before opening a position. Log the trade after (or during) the trade — that is the main journal step. Personal notes are optional and do not replace the trade form.',
      'workflow.step1.title': 'Pre-trade checklist',
      'workflow.step1.desc': 'Check your discipline before taking a position. Not required to save a trade.',
      'workflow.step1.open': 'Open checklist',
      'workflow.step2.title': 'New trade',
      'workflow.step2.desc': 'Log the trade here: result, plan, emotions, screenshots. Do this after the checklist (if you use it).',
      'workflow.step2.hint': ' Use the + button at the bottom of the screen.',
      'workflow.step2.btn': '+ New trade',
      'workflow.step3.title': 'Personal notes',
      'workflow.step3.desc': 'General reflections on your trading (not a specific trade — use the form above for that).',
      'workflow.step3.open': 'Open notes',
      'workflow.footnote': 'At week end:',
      'workflow.weekly': 'Weekly review',
      'workflow.footnoteEnd': '(summary, not per trade).',
      'workflow.meta.empty': 'Checklist: not started yet (optional).',
      'workflow.meta.ready': 'Checklist: {done}/{total} — ready. Go to « New trade ».',
      'workflow.meta.partial': 'Checklist: {done}/{total} items checked.',
      'chart.week': 'Week',
      'chart.all': 'All',
      'chart.equity': 'Equity curve',
      'trades.weekTitle': 'Trades this week',
      'trades.empty': 'No trades yet. Use the « New trade » step in the guide above.',
      'terms.title': 'Terms of use',
      'terms.welcome': 'Welcome to {appName}. By using this site, you agree to the following:',
      'terms.check': 'I have read and accept the terms of use',
      'terms.continue': 'Continue',
      'cookies.title': 'This site uses cookies',
      'cookies.text': 'We use cookies for the site to work properly. Analytics cookies are only enabled if you accept.',
      'cookies.refuse': 'Decline',
      'cookies.accept': 'Accept',
      'confirm.title': 'Confirmation',
      'confirm.cancel': 'Cancel',
      'confirm.ok': 'Confirm',
      'profile.modalTitle': 'Choose a profile',
      'profile.modalIntro': 'Each profile has its own trades and statistics.',
      'profile.createLabel': 'Create a new profile',
      'profile.createPlaceholder': 'Your first name or nickname',
      'profile.createBtn': 'Create and continue',
      'profile.cancel': 'Cancel',
      'bottom.home': 'Home',
      'bottom.trades': 'Trades',
      'bottom.sync': 'Sync',
      'bottom.menu': 'Menu'
    }
  };

  const SUPPORTED = Object.keys(MESSAGES);
  let locale = 'fr';

  function detectLocale() {
    const list = navigator.languages?.length
      ? navigator.languages
      : [navigator.language || 'fr'];
    for (const raw of list) {
      const code = String(raw).split('-')[0].toLowerCase();
      if (SUPPORTED.includes(code)) return code;
    }
    return 'fr';
  }

  function t(key, vars) {
    let str = MESSAGES[locale]?.[key] ?? MESSAGES.fr[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  }

  function applyDom() {
    document.documentElement.lang = locale;
    document.title = t('meta.title');

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (key) el.innerHTML = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.title = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (key) el.setAttribute('aria-label', t(key));
    });

    const welcome = document.querySelector('[data-i18n-html="terms.welcome"]');
    if (welcome) welcome.innerHTML = t('terms.welcome', { appName: `<strong>${t('app.name')}</strong>` });
  }

  function init() {
    locale = detectLocale();
    try {
      localStorage.setItem('tradingJournalPro_locale', locale);
    } catch { /* ignore */ }
    applyDom();
    global.dispatchEvent(new CustomEvent('i18n-ready', { detail: { locale } }));
  }

  global.I18n = {
    t,
    init,
    applyDom,
    getLocale: () => locale,
    getAppName: () => t('app.name')
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
