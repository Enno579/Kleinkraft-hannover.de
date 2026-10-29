# Phase 1 – Tracking (GTM-Container)

Branch: `feat/gtm-ga4-via-container`  
Nicht auf Production mergen, GTM-Container nicht publishen, bis Preview geprüft ist. Vollständige Event-Liste und offene GTM-Schritte: `docs/GTM-GA4.md`.

## Was im Code steht

- Consent-Banner mit Google Consent Mode v2 (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) — Defaults **denied** in `consent.js` **vor** Ads-gtag und **vor** GTM (`tracking.js`).
- Google-Ads-`gtag` (`AW-328006841`) bleibt. `migrateAdsConversionToGtm: false`.
- GTM-Loader: `gtmId: 'GTM-MR53Q3RK'`. `ga4Id` bleibt **leer** (kein direktes `gtag` `G-`). Measurement-ID **G-3TN9G4651W** (Property **Kleinkraft Hannover**) nur in GTM.
- Attribution (UTM, GCLID, WBRAID, GBRAID) in First-Party-Cookie; Snapshot geht an `/api/contact` **nur** bei Marketing-Consent.
- `generate_lead` im `dataLayer` nach erfolgreichem Formular, nur bei Analytics-Consent (auch ohne Marketing). `lead_id` wenn die API sie liefert. Keine E-Mail, Name, Nachricht, Telefon im dataLayer. Unabhängig vom Ads-gtag.
- `public/engagement.js`: `scroll_depth`, `engagement_time` **nur** bei Analytics-Consent.

## Engagement vs. GA4 Enhanced Measurement

Eigene Events nur mit Analytics-Consent. In GA4 **Enhanced Measurement** für Scrolls, Engagement-Time **und** `form_start`/`form_submit` deaktivieren (oder Form-Events nicht als Leads zählen). Lead ist nur `generate_lead`.

## IDs

Datei: `public/tracking-config.js`

```js
gtmId: 'GTM-MR53Q3RK',
ga4Id: '', // G-3TN9G4651W nur in GTM
migrateAdsConversionToGtm: false, // erst nach GTM-Ads-Test auf true
```

## GTM einrichten (ohne Doppel-Conversions)

Siehe `docs/GTM-GA4.md`. Kurz:

1. GA4 Configuration Tag (G-3TN9G4651W), Initialization All Pages — **leitet Custom Events nicht automatisch weiter**.
2. GA4 Event Tags für `generate_lead` (pflicht), optional `scroll_depth` / `engagement_time`.
3. **Kein** Google-Ads-Conversion-Tag auf `generate_lead`, solange `migrateAdsConversionToGtm` false ist.
4. Consent Mode v2: Website setzt Default denied; GTM-Tags Consent-Settings prüfen.
5. Container erst nach Website-Preview publishen.

## Testhinweis

Keine echten Kundendaten verwenden. Formular nur mit fiktiven Angaben oder gar nicht gegen Production testen.
