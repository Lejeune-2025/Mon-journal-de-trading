/**
 * Vercel Web Analytics — chargé uniquement si le script existe (évite les 404).
 * Activer dans : Vercel Dashboard → projet → Analytics → Enable.
 * @see https://vercel.com/docs/analytics/quickstart
 */
(function () {
  'use strict';

  const INSIGHTS_SCRIPT = '/_vercel/insights/script.js';

  function isProductionHost() {
    const { protocol, hostname } = location;
    if (protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return false;
    }
    return true;
  }

  window.trackJournalSection = function (section) {
    if (typeof window.va !== 'function' || !section) return;
    window.va('event', {
      name: 'section_view',
      data: { section: String(section) }
    });
  };

  if (!isProductionHost()) return;

  fetch(INSIGHTS_SCRIPT, { method: 'HEAD', cache: 'no-store' })
    .then((res) => {
      if (!res.ok) return;

      window.va = window.va || function () {
        (window.vaq = window.vaq || []).push(arguments);
      };

      const script = document.createElement('script');
      script.defer = true;
      script.src = INSIGHTS_SCRIPT;
      document.head.appendChild(script);
    })
    .catch(() => { /* Hors Vercel ou analytics désactivé */ });
})();
