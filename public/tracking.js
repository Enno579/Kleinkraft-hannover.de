/**
 * Loads GTM when gtmId is set. Consent Mode v2 defaults (consent.js) MUST
 * already have run — HTML order: tracking-config → consent.js → Ads gtag →
 * this file (defer). Does not install a Google Ads conversion tag (that
 * would duplicate the existing gtag conversion in contact-form.js).
 *
 * ga4Id is intentionally unused while GTM is active. GA4 Measurement ID
 * G-3TN9G4651W is configured inside the GTM container, not via gtag('config','G-…').
 */
(function () {
  'use strict';

  function cfg() {
    return window.KLEINKRAFT_TRACKING || {};
  }

  function isGtmId(value) {
    return /^GTM-[A-Z0-9]+$/i.test(String(value || '').trim());
  }

  function isGa4Id(value) {
    return /^G-[A-Z0-9]+$/i.test(String(value || '').trim());
  }

  function loadGtm(id) {
    if (window.__kleinkraftGtmLoaded) return;
    window.__kleinkraftGtmLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(id);
    document.head.appendChild(script);
  }

  function ensureGtagLoader() {
    if (document.querySelector('script[src*="googletagmanager.com/gtag/js"]')) return;
    var adsId = cfg().adsId || 'AW-328006841';
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(adsId);
    document.head.appendChild(script);
  }

  function loadGa4Direct(id) {
    if (window.__kleinkraftGa4Loaded) return;
    window.__kleinkraftGa4Loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function () {
        window.dataLayer.push(arguments);
      };
    ensureGtagLoader();
    window.gtag('config', id, { anonymize_ip: true });
  }

  function boot() {
    var tracking = cfg();
    var gtmId = String(tracking.gtmId || '').trim();
    var ga4Id = String(tracking.ga4Id || '').trim();

    // Prefer GTM. Direct GA4 gtag G- must not run alongside the container.
    if (isGtmId(gtmId)) {
      loadGtm(gtmId);
      return;
    }

    if (isGa4Id(ga4Id)) {
      loadGa4Direct(ga4Id);
    }
  }

  boot();
})();
