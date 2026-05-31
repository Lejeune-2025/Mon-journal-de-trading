/**
 * Vercel Web Analytics — actif uniquement en production HTTPS (déploiement Vercel).
 * Activer dans : Vercel Dashboard → projet → Analytics → Enable.
 * @see https://vercel.com/docs/analytics/quickstart
 */
(function () {
  'use strict';

  function isProductionHost() {
    const { protocol, hostname } = location;
    if (protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
      return false;
    }
    return true;
  }

  if (!isProductionHost()) return;

  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.appendChild(script);

  /** Suivi des « pages » internes (SPA sans changement d’URL). */
  window.trackJournalSection = function (section) {
    if (typeof window.va !== 'function' || !section) return;
    window.va('event', {
      name: 'section_view',
      data: { section: String(section) }
    });
  };
})();
