/**
 * First-party capture of UTM parameters and Google Ads click IDs.
 * Backend: contact-form sends a snapshot to /api/contact only when marketing
 * consent is granted. No test payloads with real leads.
 *
 * Consent model: Google Advanced Consent Mode v2 (not Basic) — gtag may already
 * be loaded with default denied. This script does not delay or unload gtag.
 *
 * Persist/read mapping: utm_*, gclid, wbraid, gbraid, gad_source require
 * explicit marketing consent (banner "Marketing (Google Ads)"), not analytics.
 * On marketing revoke/deny, delete kleinkraft_attribution cookie + sessionStorage.
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'kleinkraft_attribution';
  var CONSENT_EVENT = 'kleinkraft:consent';
  var KEYS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'gclid',
    'wbraid',
    'gbraid',
    'gad_source',
  ];

  function cfg() {
    return window.KLEINKRAFT_TRACKING || {};
  }

  function cookieDays() {
    var days = Number(cfg().attributionCookieDays);
    return days > 0 ? days : 90;
  }

  function hasMarketingConsent() {
    var consent =
      window.KleinkraftConsent && typeof window.KleinkraftConsent.get === 'function'
        ? window.KleinkraftConsent.get()
        : null;
    return !!(consent && consent.marketing);
  }

  function parseCookie() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    if (!match || !match[1]) return null;
    try {
      var parsed = JSON.parse(decodeURIComponent(match[1]));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function writeCookie(data) {
    var maxAge = cookieDays() * 24 * 60 * 60;
    document.cookie =
      COOKIE_NAME +
      '=' +
      encodeURIComponent(JSON.stringify(data)) +
      '; Max-Age=' +
      maxAge +
      '; Path=/; SameSite=Lax';
  }

  function writeSession(data) {
    try {
      window.sessionStorage.setItem(COOKIE_NAME, JSON.stringify(data));
    } catch (err) {
      /* private mode / blocked storage */
    }
  }

  function readSession() {
    try {
      var raw = window.sessionStorage.getItem(COOKIE_NAME);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (err) {
      return null;
    }
  }

  function clearStored() {
    document.cookie = COOKIE_NAME + '=; Max-Age=0; Path=/; SameSite=Lax';
    try {
      window.sessionStorage.removeItem(COOKIE_NAME);
    } catch (err) {
      /* private mode / blocked storage */
    }
  }

  function fromQuery() {
    var params = new URLSearchParams(window.location.search);
    var found = {};
    var hasValue = false;
    KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) {
        found[key] = String(value).slice(0, 500);
        hasValue = true;
      }
    });
    return hasValue ? found : null;
  }

  function mergeAttribution(existing, incoming) {
    var next = existing ? JSON.parse(JSON.stringify(existing)) : {};
    var now = new Date().toISOString();

    if (!next.first_touch_at) next.first_touch_at = now;
    if (!next.landing_page) {
      next.landing_page = window.location.pathname || '/';
    }
    if (!next.referrer && document.referrer) {
      try {
        var refHost = new URL(document.referrer).host;
        if (refHost !== window.location.host) next.referrer = document.referrer.slice(0, 500);
      } catch (err) {
        /* ignore invalid referrer */
      }
    }

    if (!incoming) {
      next.last_touch_at = next.last_touch_at || now;
      return next;
    }

    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (key) {
      if (incoming[key] && !next[key]) next[key] = incoming[key];
    });

    ['gclid', 'wbraid', 'gbraid', 'gad_source'].forEach(function (key) {
      if (incoming[key]) next[key] = incoming[key];
    });

    next.last_touch_at = now;
    return next;
  }

  function capture() {
    if (!hasMarketingConsent()) return null;
    var merged = mergeAttribution(parseCookie() || readSession(), fromQuery());
    writeCookie(merged);
    writeSession(merged);
    return merged;
  }

  function get() {
    if (!hasMarketingConsent()) return null;
    return parseCookie() || readSession() || null;
  }

  function applyAttributionForConsent(marketingGranted) {
    if (marketingGranted) {
      capture();
    } else {
      clearStored();
    }
  }

  window.KleinkraftAttribution = {
    capture: capture,
    get: get,
  };

  document.addEventListener(CONSENT_EVENT, function (event) {
    var detail = event && event.detail;
    applyAttributionForConsent(!!(detail && detail.marketing));
  });

  applyAttributionForConsent(hasMarketingConsent());
})();
