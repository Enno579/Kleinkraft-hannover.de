/**
 * Kleinkraft tracking configuration (Phase 1).
 *
 * Fill gtmId (GTM-XXXXXXX) and/or ga4Id (G-XXXXXXXX) when they exist.
 * Until then, loaders stay inactive and the existing Google Ads gtag remains
 * the only conversion path.
 *
 * migrateAdsConversionToGtm MUST stay false until a GTM Ads conversion tag
 * is configured and tested — otherwise leads would fire twice.
 */
window.KLEINKRAFT_TRACKING = {
  gtmId: '',
  ga4Id: '',
  adsId: 'AW-328006841',
  adsConversionSendTo: 'AW-328006841/0NTKCJzv5cgCENs5s5wB',
  migrateAdsConversionToGtm: false,
  consentCookieDays: 180,
  attributionCookieDays: 90,
};
