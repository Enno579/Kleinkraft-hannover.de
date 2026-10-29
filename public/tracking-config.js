/**
 * Kleinkraft tracking configuration.
 *
 * Property Kleinkraft Hannover (www.kleinkraft-hannover.de):
 * GTM container GTM-MR53Q3RK loads via public/tracking.js (after Consent Mode
 * v2 defaults in consent.js). GA4 Measurement ID G-3TN9G4651W lives in GTM
 * only — ga4Id MUST stay empty so tracking.js does NOT load gtag G- directly.
 *
 * migrateAdsConversionToGtm MUST stay false until a GTM Ads conversion tag
 * is configured and tested — otherwise leads would fire twice. Ads remains
 * AW-328006841 via the existing gtag snippet.
 */
window.KLEINKRAFT_TRACKING = {
  gtmId: 'GTM-MR53Q3RK',
  ga4Id: '',
  adsId: 'AW-328006841',
  adsConversionSendTo: 'AW-328006841/0NTKCJzv5cgCENs5s5wB',
  migrateAdsConversionToGtm: false,
  consentCookieDays: 180,
  attributionCookieDays: 90,
};
