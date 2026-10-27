/**
 * First-party consent banner + Google Consent Mode v2.
 * Must load in <head> before any Google tag (gtag / GTM).
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'kleinkraft_consent';
  var EVENT_NAME = 'kleinkraft:consent';

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  var denied = {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: 'denied',
    security_storage: 'granted',
    wait_for_update: 500,
  };

  window.gtag('consent', 'default', denied);

  function cfg() {
    return window.KLEINKRAFT_TRACKING || {};
  }

  function cookieDays() {
    var days = Number(cfg().consentCookieDays);
    return days > 0 ? days : 180;
  }

  function readConsent() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    if (!match) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(match[1]));
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        analytics: !!parsed.analytics,
        marketing: !!parsed.marketing,
      };
    } catch (err) {
      return null;
    }
  }

  function writeConsent(choice) {
    var payload = encodeURIComponent(
      JSON.stringify({
        v: 1,
        analytics: !!choice.analytics,
        marketing: !!choice.marketing,
        ts: new Date().toISOString(),
      }),
    );
    var maxAge = cookieDays() * 24 * 60 * 60;
    document.cookie =
      COOKIE_NAME + '=' + payload + '; Max-Age=' + maxAge + '; Path=/; SameSite=Lax';
  }

  function consentUpdate(choice) {
    window.gtag('consent', 'update', {
      analytics_storage: choice.analytics ? 'granted' : 'denied',
      ad_storage: choice.marketing ? 'granted' : 'denied',
      ad_user_data: choice.marketing ? 'granted' : 'denied',
      ad_personalization: choice.marketing ? 'granted' : 'denied',
    });
    document.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: {
          analytics: !!choice.analytics,
          marketing: !!choice.marketing,
        },
      }),
    );
  }

  function applyChoice(choice, persist) {
    if (persist) writeConsent(choice);
    consentUpdate(choice);
  }

  function hideBanner() {
    var banner = document.getElementById('kleinkraftConsent');
    if (banner) banner.hidden = true;
    document.body.classList.remove('has-consent-banner');
  }

  function showBanner() {
    var banner = document.getElementById('kleinkraftConsent');
    if (!banner) return;
    banner.hidden = false;
    document.body.classList.add('has-consent-banner');
    var analytics = document.getElementById('consentAnalytics');
    var marketing = document.getElementById('consentMarketing');
    var stored = readConsent();
    if (analytics) analytics.checked = !!(stored && stored.analytics);
    if (marketing) marketing.checked = !!(stored && stored.marketing);
  }

  function currentFormChoice() {
    var analytics = document.getElementById('consentAnalytics');
    var marketing = document.getElementById('consentMarketing');
    return {
      analytics: !!(analytics && analytics.checked),
      marketing: !!(marketing && marketing.checked),
    };
  }

  function buildBanner() {
    if (document.getElementById('kleinkraftConsent')) return;

    var banner = document.createElement('div');
    banner.id = 'kleinkraftConsent';
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'true');
    banner.setAttribute('aria-labelledby', 'consentTitle');
    banner.innerHTML =
      '<div class="consent-banner__inner">' +
      '<div class="consent-banner__copy">' +
      '<p class="consent-banner__title" id="consentTitle">Datenschutz &amp; Cookies</p>' +
      '<p class="consent-banner__text">Wir nutzen technisch notwendige Cookies, damit diese Website funktioniert. Statistik (Google Analytics 4) und Marketing (Google Ads / Tag Manager) setzen wir nur mit Ihrer Einwilligung. Details in der <a href="datenschutz.html">Datenschutzerklärung</a>.</p>' +
      '<div class="consent-banner__toggles">' +
      '<label class="consent-banner__toggle"><input type="checkbox" checked disabled> Technisch notwendig</label>' +
      '<label class="consent-banner__toggle"><input type="checkbox" id="consentAnalytics"> Statistik (GA4)</label>' +
      '<label class="consent-banner__toggle"><input type="checkbox" id="consentMarketing"> Marketing (Google Ads)</label>' +
      '</div>' +
      '</div>' +
      '<div class="consent-banner__actions">' +
      '<button type="button" class="consent-banner__btn consent-banner__btn--ghost" data-consent="reject">Nur notwendige</button>' +
      '<button type="button" class="consent-banner__btn consent-banner__btn--ghost" data-consent="save">Auswahl speichern</button>' +
      '<button type="button" class="consent-banner__btn consent-banner__btn--primary" data-consent="accept">Alle akzeptieren</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(banner);

    document.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-open-consent]');
      if (opener) {
        event.preventDefault();
        showBanner();
      }
    });

    banner.addEventListener('click', function (event) {
      var button = event.target.closest('[data-consent]');
      if (!button) return;
      var action = button.getAttribute('data-consent');
      var choice = { analytics: false, marketing: false };
      if (action === 'accept') {
        choice = { analytics: true, marketing: true };
      } else if (action === 'save') {
        choice = currentFormChoice();
      }
      applyChoice(choice, true);
      hideBanner();
    });
  }

  window.KleinkraftConsent = {
    open: showBanner,
    get: readConsent,
  };

  function init() {
    buildBanner();
    var stored = readConsent();
    if (stored) {
      applyChoice(stored, false);
      hideBanner();
    } else {
      showBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
