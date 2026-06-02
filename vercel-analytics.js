/**
 * Vercel Web Analytics — chargé uniquement après consentement « Tout accepter ».
 */
(function () {
  'use strict';

  const INSIGHTS_SCRIPT = '/_vercel/insights/script.js';
  let loaded = false;

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

  function load() {
    if (loaded || !isProductionHost()) return;
    loaded = true;

    fetch(INSIGHTS_SCRIPT, { method: 'HEAD', cache: 'no-store' })
      .then((res) => {
        if (!res.ok) return;

        window.va = window.va || function () {
          (window.vaq = window.vaq || []).push(arguments);
        };

        const script = document.createElement('script');
        script.defer = true;
        script.src = INSIGHTS_SCRIPT;
        script.onload = () => {
          if (typeof window.va === 'function') {
            window.va('event', {
              name: 'cookie_consent',
              data: { choice: 'accepted' }
            });
          }
        };
        document.head.appendChild(script);
      })
      .catch(() => { /* Hors Vercel ou analytics désactivé */ });
  }

  window.JournalAnalytics = { load };
})();
