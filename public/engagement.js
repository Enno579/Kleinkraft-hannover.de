/**
 * Consent-dependent scroll depth + active engagement duration.
 * Pushes dataLayer events only when analytics consent is granted.
 * No PII. Does not set or load GA4/GTM IDs.
 *
 * Event names are first-party (`scroll_depth`, `engagement_time`) so they
 * do not rely on GA4 Enhanced Measurement. When GTM/GA4 go live, disable
 * overlapping Enhanced Measurement (scrolls / engagement time) in the GA4
 * config tag to avoid duplicate metrics.
 */
(function () {
  'use strict';

  var CONSENT_EVENT = 'kleinkraft:consent';
  var SCROLL_MARKS = [25, 50, 75, 100];
  var TIME_MARKS_SEC = [10, 30, 60];
  var TICK_MS = 1000;

  var firedScroll = {};
  var firedTime = {};
  var activeMs = 0;
  var lastActiveAt = null;
  var pageFocused = true;
  var timer = null;
  var listenersBound = false;
  var maxScroll = 0;

  function hasAnalyticsConsent() {
    var consent =
      window.KleinkraftConsent && typeof window.KleinkraftConsent.get === 'function'
        ? window.KleinkraftConsent.get()
        : null;
    return !!(consent && consent.analytics);
  }

  function pushEvent(name, params) {
    if (!hasAnalyticsConsent()) return;
    window.dataLayer = window.dataLayer || [];
    var payload = { event: name };
    if (params) {
      for (var key in params) {
        if (Object.prototype.hasOwnProperty.call(params, key)) payload[key] = params[key];
      }
    }
    window.dataLayer.push(payload);
  }

  function docEl() {
    return document.documentElement || document.body;
  }

  function scrollPercent() {
    var el = docEl();
    var scrollTop = window.pageYOffset || (el && el.scrollTop) || 0;
    var view = window.innerHeight || (el && el.clientHeight) || 0;
    var height = Math.max((el && el.scrollHeight) || 0, (document.body && document.body.scrollHeight) || 0);
    var range = height - view;
    if (range <= 0) return 100;
    var pct = Math.round((scrollTop / range) * 100);
    if (pct < 0) return 0;
    if (pct > 100) return 100;
    return pct;
  }

  function pageIsActive() {
    if (document.visibilityState === 'hidden') return false;
    if (document.hidden) return false;
    return pageFocused;
  }

  function flushActive() {
    if (lastActiveAt == null) return;
    var now = Date.now();
    activeMs += Math.max(0, now - lastActiveAt);
    lastActiveAt = pageIsActive() && hasAnalyticsConsent() ? now : null;
  }

  function maybeScrollEvents() {
    if (!hasAnalyticsConsent()) return;
    var pct = scrollPercent();
    if (pct > maxScroll) maxScroll = pct;
    for (var i = 0; i < SCROLL_MARKS.length; i++) {
      var mark = SCROLL_MARKS[i];
      if (!firedScroll[mark] && maxScroll >= mark) {
        firedScroll[mark] = true;
        pushEvent('scroll_depth', { percent: mark, scroll_depth: mark });
      }
    }
  }

  function maybeTimeEvents() {
    if (!hasAnalyticsConsent()) return;
    flushActive();
    var sec = Math.floor(activeMs / 1000);
    for (var i = 0; i < TIME_MARKS_SEC.length; i++) {
      var mark = TIME_MARKS_SEC[i];
      if (!firedTime[mark] && sec >= mark) {
        firedTime[mark] = true;
        pushEvent('engagement_time', {
          engagement_time_msec: mark * 1000,
          engagement_time_sec: mark,
        });
      }
    }
  }

  function onScroll() {
    maybeScrollEvents();
  }

  function onVisibility() {
    if (pageIsActive() && hasAnalyticsConsent()) {
      if (lastActiveAt == null) lastActiveAt = Date.now();
    } else {
      flushActive();
      lastActiveAt = null;
    }
  }

  function onFocus() {
    pageFocused = true;
    onVisibility();
  }

  function onBlur() {
    pageFocused = false;
    onVisibility();
  }

  function tick() {
    if (!hasAnalyticsConsent()) return;
    if (pageIsActive() && lastActiveAt == null) lastActiveAt = Date.now();
    maybeTimeEvents();
  }

  function bind() {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
  }

  function startMeasuring() {
    bind();
    if (pageIsActive()) lastActiveAt = Date.now();
    if (timer == null) timer = window.setInterval(tick, TICK_MS);
    maybeScrollEvents();
  }

  function stopMeasuring() {
    flushActive();
    lastActiveAt = null;
    if (timer != null) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function onConsentChange() {
    if (hasAnalyticsConsent()) startMeasuring();
    else stopMeasuring();
  }

  function getSnapshot() {
    if (!hasAnalyticsConsent()) return null;
    flushActive();
    if (pageIsActive() && lastActiveAt == null) lastActiveAt = Date.now();
    var pct = scrollPercent();
    if (pct > maxScroll) maxScroll = pct;
    return {
      scroll_depth_percent: maxScroll,
      engagement_time_msec: activeMs,
    };
  }

  window.KleinkraftEngagement = {
    getSnapshot: getSnapshot,
  };

  document.addEventListener(CONSENT_EVENT, onConsentChange);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onConsentChange);
  } else {
    onConsentChange();
  }
})();
