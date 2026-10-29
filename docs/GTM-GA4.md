# GTM + GA4 (Container-Pfad)

Branch: `feat/gtm-ga4-via-container`

Nur Property **Kleinkraft Hannover** für **www.kleinkraft-hannover.de**:
- GTM: **GTM-MR53Q3RK**
- GA4: **G-3TN9G4651W** (nur im GTM-Container, `ga4Id` im Code bleibt leer)

Keine andere GA4-Property / Measurement-ID (insbesondere nicht die Dezember-Start-Property einer anderen Domain).

Ads-gtag **AW-328006841** bleibt. `migrateAdsConversionToGtm: false`.

## Lade-Reihenfolge (Consent vor GTM)

In `public/index.html`, `datenschutz.html`, `impressum.html`:

1. `tracking-config.js`
2. `consent.js` — Consent Mode v2 **default denied** (`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`)
3. Google Ads `gtag/js?id=AW-328006841` + `gtag('config','AW-328006841')`
4. (Body, defer) `tracking.js` — lädt `gtm.js?id=GTM-MR53Q3RK` und pusht `gtm.js`

Accept / Ablehnen / erneutes Speichern (Widerruf): `gtag('consent','update', …)` in `consent.js`.

## dataLayer-Events im Code

| Event | Quelle | Wann | GTM-GA4-Event-Tag nötig? |
| --- | --- | --- | --- |
| `gtm.js` | `public/tracking.js` | GTM-Snippet | Nein — Container-Init. GA4 **Configuration** Tag: Trigger **Initialization – All Pages** (oder All Pages). |
| `generate_lead` | `public/contact-form.js` | nach erfolgreichem `/api/contact` | **Ja** — GA4 Event Tag, Event-Name `generate_lead`. Parameter: `lead_event_source`, optional `lead_id`. **Keine** E-Mail, Name, Nachricht, Telefon. |
| `scroll_depth` | `public/engagement.js` | 25/50/75/100 %, nur Analytics-Consent | **Ja**, wenn ihr die eigenen Scroll-Events in GA4 wollt. Parameter: `percent`, `scroll_depth`. |
| `engagement_time` | `public/engagement.js` | 10/30/60 s aktiv, nur Analytics-Consent | **Ja**, analog. Parameter: `engagement_time_msec`, `engagement_time_sec`. |

Zusätzlich landet **gtag** im dataLayer (keine eigenen Event-Namen): `consent` default/update, `js`, `config` für AW-328006841, Ads-`conversion` aus `contact-form.js`.

**Wichtig:** Ein GA4-Tag mit Trigger „Initialization – All Pages“ sendet **keine** Custom Events (`generate_lead`, `scroll_depth`, `engagement_time`) automatisch weiter. Dafür je Event ein **GA4 Event Tag** (Trigger: Custom Event mit dem jeweiligen `event`-Namen).

## Warnung: Enhanced Measurement vs. Leads

In GA4 **Enhanced Measurement** `form_start` / `form_submit` **deaktivieren** — oder diese Events **nicht** als Leads werten. Lead-Event ist ausschließlich `generate_lead` nach erfolgreichem API-Response.

Enhanced Measurement Scroll / Engagement-Time ebenfalls deaktivieren, sonst Doppelzählung mit `scroll_depth` / `engagement_time`.

## Noch in GTM einzustellen (nicht im Code, nicht publishen in diesem PR)

1. **Container noch nicht veröffentlichen**, bis Preview der Website geprüft ist.
2. GA4 Configuration Tag: Measurement ID **G-3TN9G4651W**, Trigger Initialization All Pages. Consent Mode im Tag berücksichtigen (Website setzt Default denied).
3. GA4 Event Tags für `generate_lead`, optional `scroll_depth` und `engagement_time`.
4. **Kein** Google-Ads-Conversion-Tag auf `generate_lead`, solange `migrateAdsConversionToGtm` false ist.
5. Kein zweites GA4-gtag `G-` auf der Website (Code: `ga4Id` leer).
