/**
 * First-party capture of UTM parameters and Google Ads click IDs.
 * Does not send data to a backend (Phase 2). No test payloads with real leads.
 */
(function () {
  'use strict';

  var COOKIE_NAME = 'kleinkraft_attribution';
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

  function parseCookie() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'));
    if (!match) return null;
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
    var merged = mergeAttribution(parseCookie(), fromQuery());
    writeCookie(merged);
    try {
      window.sessionStorage.setItem(COOKIE_NAME, JSON.stringify(merged));
    } catch (err) {
      /* private mode / blocked storage */
    }
    return merged;
  }

  function get() {
    return parseCookie() || null;
  }

  window.KleinkraftAttribution = {
    capture: capture,
    get: get,
  };

  capture();
})();
