/**
 * Conditions d'utilisation (1ère visite) + consentement cookies.
 */
(function (global) {
  'use strict';

  const TERMS_VERSION = '1.0';
  const TERMS_KEY = 'tradingJournalPro_terms';
  const COOKIES_KEY = 'tradingJournalPro_cookies';

  let readyResolve;
  let readyDone = false;
  const whenReady = new Promise((resolve) => { readyResolve = resolve; });

  function readJson(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function hasAcceptedTerms() {
    const t = readJson(TERMS_KEY);
    return Boolean(t?.accepted && t?.version === TERMS_VERSION);
  }

  function isAcceptedChoice(choice) {
    return choice === 'all' || choice === 'accepted';
  }

  function isRefusedChoice(choice) {
    return choice === 'essential' || choice === 'refused';
  }

  function hasCookieChoice() {
    const c = readJson(COOKIES_KEY);
    return isAcceptedChoice(c?.choice) || isRefusedChoice(c?.choice);
  }

  function hasAnalyticsConsent() {
    return isAcceptedChoice(readJson(COOKIES_KEY)?.choice);
  }

  function getStatus() {
    const terms = readJson(TERMS_KEY);
    const cookies = readJson(COOKIES_KEY);
    return {
      termsAccepted: hasAcceptedTerms(),
      cookieChoice: cookies?.choice || null,
      cookieAt: cookies?.at || null,
      analyticsEnabled: hasAnalyticsConsent()
    };
  }

  function saveTerms() {
    localStorage.setItem(TERMS_KEY, JSON.stringify({
      accepted: true,
      version: TERMS_VERSION,
      at: new Date().toISOString()
    }));
  }

  function saveCookies(accepted) {
    const choice = accepted ? 'accepted' : 'refused';
    localStorage.setItem(COOKIES_KEY, JSON.stringify({
      choice,
      at: new Date().toISOString()
    }));
    updateConsentDisplay();
    if (accepted && global.JournalAnalytics?.load) {
      global.JournalAnalytics.load();
    }
  }

  function updateConsentDisplay() {
    const el = document.getElementById('cookieConsentStatus');
    if (!el) return;
    const c = readJson(COOKIES_KEY);
    if (!c?.choice) {
      el.hidden = true;
      return;
    }
    const date = c.at ? new Date(c.at).toLocaleString('fr-FR') : '';
    const label = isAcceptedChoice(c.choice)
      ? 'Cookies acceptés (analytics Vercel actifs)'
      : 'Cookies refusés (pas d’analytics Vercel)';
    el.textContent = `${label}${date ? ` — ${date}` : ''}`;
    el.hidden = false;
  }

  function setBodyLock(on) {
    document.body.classList.toggle('legal-open', on);
    document.body.classList.toggle('modal-open', on);
  }

  function finish() {
    if (readyDone) return;
    readyDone = true;
    setBodyLock(false);
    setCookiesActive(false);
    document.body.classList.remove('legal-pending');
    updateConsentDisplay();
    readyResolve();
  }

  function hideTermsOverlay(overlay, backdrop) {
    document.body.classList.remove('terms-active');
    if (overlay) {
      overlay.classList.remove('legal-visible');
      overlay.hidden = true;
    }
    if (backdrop) {
      backdrop.classList.remove('consent-backdrop--open');
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
    }
  }

  function showTermsModal() {
    const overlay = document.getElementById('termsOverlay');
    const backdrop = document.getElementById('termsBackdrop');
    const check = document.getElementById('termsAcceptCheck');
    const btn = document.getElementById('termsAcceptBtn');
    if (!overlay || !check || !btn) {
      finish();
      return;
    }

    setBodyLock(true);
    document.body.classList.add('terms-active');
    overlay.hidden = false;
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }
    requestAnimationFrame(() => {
      overlay.classList.add('legal-visible');
      backdrop?.classList.add('consent-backdrop--open');
    });

    check.addEventListener('change', () => {
      btn.disabled = !check.checked;
    });

    btn.addEventListener('click', () => {
      if (!check.checked) return;
      saveTerms();
      hideTermsOverlay(overlay, backdrop);
      setBodyLock(false);
      if (hasCookieChoice()) finish();
      else showCookieBanner();
    });
  }

  function setCookiesActive(on) {
    document.body.classList.toggle('cookies-active', on);
  }

  function hideCookieBanner(banner, backdrop) {
    setCookiesActive(false);
    const panel = banner?.querySelector('.cookie-banner-panel');
    banner?.classList.remove('cookie-banner--open');
    backdrop?.classList.remove('consent-backdrop--open');
    const done = () => {
      if (banner) banner.hidden = true;
      if (backdrop) {
        backdrop.hidden = true;
        backdrop.setAttribute('aria-hidden', 'true');
      }
    };
    if (panel) panel.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 520);
  }

  function showCookieBanner(reopenOnly) {
    const banner = document.getElementById('cookieBanner');
    const backdrop = document.getElementById('cookieBackdrop');
    if (!banner) {
      if (!reopenOnly) finish();
      return;
    }

    hideTermsOverlay(
      document.getElementById('termsOverlay'),
      document.getElementById('termsBackdrop')
    );
    setBodyLock(false);
    setCookiesActive(true);

    const close = (accepted) => {
      saveCookies(accepted);
      hideCookieBanner(banner, backdrop);
      if (!reopenOnly) finish();
    };

    if (!banner.dataset.bound) {
      banner.dataset.bound = '1';
      banner.addEventListener('click', (e) => {
        if (e.target.closest('#cookieRefuse')) {
          e.preventDefault();
          close(false);
        }
        if (e.target.closest('#cookieAccept')) {
          e.preventDefault();
          close(true);
        }
      });
    }

    banner.hidden = false;
    if (backdrop) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }
    requestAnimationFrame(() => {
      banner.classList.add('cookie-banner--open');
      backdrop?.classList.add('consent-backdrop--open');
    });
  }

  function init() {
    document.body.classList.add('legal-pending');
    updateConsentDisplay();

    if (!hasAcceptedTerms()) {
      showTermsModal();
      return;
    }

    if (!hasCookieChoice()) {
      showCookieBanner();
      return;
    }

    if (hasAnalyticsConsent() && global.JournalAnalytics?.load) {
      global.JournalAnalytics.load();
    }
    finish();
  }

  global.LegalConsent = {
    whenReady: () => whenReady,
    hasAnalyticsConsent,
    getStatus,
    openCookiePreferences: () => showCookieBanner(true),
    resetForDev: () => {
      localStorage.removeItem(TERMS_KEY);
      localStorage.removeItem(COOKIES_KEY);
      location.reload();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
