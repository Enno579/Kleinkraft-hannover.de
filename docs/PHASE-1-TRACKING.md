# Phase 1 – Tracking-Vorbereitung (nicht live)

Branch: `feat/phase-1-consent-gtm-ga4`  
Stand: Entwurf. Nicht auf `main` mergen und nicht production-deployen, bevor es ausdrücklich freigegeben ist.

## Was vorbereitet ist

- Consent-Banner mit Google Consent Mode v2 (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`).
- Bestehendes Google-Ads-`gtag` (`AW-328006841`) bleibt aktiv. Consent-Defaults stehen **davor**.
- GTM- und GA4-Loader in `public/tracking.js` – laden nur bei gültiger ID.
- Attribution (UTM, GCLID, WBRAID, GBRAID) in First-Party-Cookie; Snapshot geht an `/api/contact` **nur** bei Marketing-Consent.
- `generate_lead` im `dataLayer` nach erfolgreichem Formular – für späteres GA4/GTM (`lead_id` wenn die API sie liefert).
- Google-Ads-Conversion bleibt in `public/contact-form.js`, solange `migrateAdsConversionToGtm` `false` ist.
- `public/engagement.js`: Scroll-Tiefe und aktive Verweildauer → `dataLayer` (`scroll_depth`, `engagement_time`) **nur** bei Analytics-Consent. Keine PII, keine GA4-IDs.
- Lead-Liste: siehe `docs/LEAD-LISTE.md`. Live-Append nur mit Env; ohne Env `sheet_status: skipped_missing_config` (kein stiller Erfolg). Sheet-Setup **fehlt noch**.

## Engagement vs. GA4 Enhanced Measurement

Eigene Events nur mit Analytics-Consent. Wenn GTM/GA4 später live gehen: **Enhanced Measurement** für Scrolls und Engagement-Time im GA4-Tag **deaktivieren**, sonst Doppelzählung mit `scroll_depth` / `engagement_time`.

## IDs eintragen

Datei: `public/tracking-config.js`

```js
gtmId: 'GTM-XXXXXXX',
ga4Id: 'G-XXXXXXXX',
migrateAdsConversionToGtm: false, // erst nach GTM-Test auf true
```

Solange die Felder leer sind, wird kein GTM/GA4-Container geladen.

## GTM einrichten (später, ohne Doppel-Conversions)

1. Container anlegen, ID hier eintragen.
2. Consent Mode v2 im Container berücksichtigen (Default denied kommt von der Website).
3. GA4 Configuration Tag + Event `generate_lead`.
4. **Kein** Google-Ads-Conversion-Tag auf `generate_lead` setzen, solange `migrateAdsConversionToGtm` false ist.
5. Erst nach Test: Flag auf `true`, dann GTM-Ads-Conversion aktivieren, danach das direkte `gtag('event', 'conversion')` in `contact-form.js` entfernen (eigene Phase).

## Testhinweis

Keine echten Kundendaten verwenden. Formular nur mit fiktiven Angaben oder gar nicht gegen Production testen.
