# Lead-Liste (Google Sheets)

Stand: Branch `feat/gtm-ga4-via-container`. Code schreibt **lokal und auf Vercel** per Sheets API v4 REST + JWT (`google-auth-library`), **sobald** die Env-Variablen gesetzt sind. Sheet-Setup siehe unten. **Kein Production-Merge** in diesem GTM-Schritt.

Tracking und Lead-Liste kommen **vor** den zwei Landingpages. Landingpages und Kampagnen-Aktivierung sind **nicht** Teil dieses Pakets.

Microsoft Clarity: **nicht** vorgesehen.

## Was der Code tut (ohne dein Google-Konto)

- Jede erfolgreiche Kontakt-E-Mail (Resend) bekommt eine Server-`lead_id` (UUID). Die ID steht in **Betreff und Body** der Mail.
- Danach versucht der Server `appendLeadToSheet()`.
- **Ohne** Env: E-Mail kann trotzdem rausgehen. API-Antwort ist `200` mit `success: true`, `lead_id`, `sheet_ok: false`, `sheet_status: skipped_missing_config`. Server-Log: `[leads] Google Sheets not configured …`. Es wird **nicht** so getan, als stünde der Lead in der Tabelle.
- **Mit** Env: JWT → `GET` letzte Zeilen (Dedup) → `POST …/values/{range}:append`. Erfolg: `sheet_ok: true`, `sheet_status: appended`.
- Append-Fehler **nach** Mail: weiterhin `200 success: true` + `lead_id` + `sheet_ok: false` + `sheet_status: error` + `sheet_error` (ohne Private Key).

Zwei Absenden im Formular = **zwei** `lead_id`s = **zwei** Zeilen. Der Client erzeugt keine Lead-ID; der Server macht bei jedem POST eine neue UUID. Dedup gilt nur:

- dieselbe `lead_id` im **selben** Handler/Isolate (kein doppeltes Append in einem Request);
- optionales Nachlesen der letzten 200 Zeilen in Spalte `lead_id`, falls dieselbe ID noch einmal käme.

## Angebote (für `product_line`)

| Wert | Bedeutung |
| --- | --- |
| `pv_classic` | Angebot A: klassische PV-Komplettanlagen mit Speicher |
| `anker_solix` | Angebot B: premium Anker SOLIX Dach/Garage für Eigenheim; Ziel-Komplettpreis 8.000–13.000 EUR; **keine** günstigen Balkon-Sets |

`product_line` ist optional (aktuelles Kontaktformular sendet es nur, wenn `data-product-line` oder ein Hidden-Field gesetzt ist).

## Vertriebsstatus

Pipeline (eine Spalte `status`, Default bei neuer Anfrage: **Neue Anfrage**):

1. Neue Anfrage
2. Kontakt aufgenommen
3. Qualifizierter Interessent
4. Beratungstermin vereinbart
5. Angebot erstellt
6. **Auftrag abgeschlossen** *oder* **Auftrag verloren**

Optionale interne Felder (nicht automatisch nach Google Ads/GA4):

- `auftragswert`
- `deckungsbeitrag` — **nur intern**, niemals automatisch an Google senden
- Zeitstempel je Status (`ts_*`)

Planungsnotizen (nicht in dieser Tabelle, keine Ads-Aktivierung): Budget ~1.200 EUR/Monat, Geo Hannover ~20 km.

## Spalten (exakt wie `SHEET_COLUMNS` in `lib/leads/sheet.ts`)

Reihenfolge **von links nach rechts**, Zeile 1 = Kopfzeile. Default-Tab und Range: **`Leads!A1`**.

| # | Spalte | Pflicht bei Insert | Hinweis |
| --- | --- | --- | --- |
| 1 | `lead_id` | ja | Server-UUID |
| 2 | `created_at` | ja | ISO-Zeit |
| 3 | `status` | ja | Default `Neue Anfrage` |
| 4 | `vorname` | ja | Formulardaten |
| 5 | `nachname` | ja | Formulardaten |
| 6 | `email` | ja | Formulardaten |
| 7 | `telefon` | nein | |
| 8 | `jahresverbrauch` | nein | |
| 9 | `wohnsituation` | nein | |
| 10 | `montageort` | nein | |
| 11 | `finanzierung_interesse` | nein | |
| 12 | `nachricht` | nein | |
| 13 | `product_line` | nein | `pv_classic` / `anker_solix` |
| 14 | `offer_label` | nein | Lesbare Bezeichnung A/B |
| 15 | `landing_page` | nein | Pfad der Absendeseite |
| 16 | `campaign` | nein | Kopie von `utm_campaign`, nur mit Marketing-Consent |
| 17 | `utm_source` | nein | nur bei `marketing_consent=true` |
| 18 | `utm_medium` | nein | nur bei Marketing-Consent |
| 19 | `utm_campaign` | nein | nur bei Marketing-Consent |
| 20 | `utm_content` | nein | nur bei Marketing-Consent |
| 21 | `utm_term` | nein | nur bei Marketing-Consent |
| 22 | `gclid` | nein | nur bei Marketing-Consent |
| 23 | `wbraid` | nein | nur bei Marketing-Consent |
| 24 | `gbraid` | nein | nur bei Marketing-Consent |
| 25 | `gad_source` | nein | nur bei Marketing-Consent |
| 26 | `referrer` | nein | nur bei Marketing-Consent |
| 27 | `first_touch_at` | nein | nur bei Marketing-Consent |
| 28 | `last_touch_at` | nein | nur bei Marketing-Consent |
| 29 | `marketing_consent` | ja | `true` / `false` |
| 30 | `analytics_consent` | ja | `true` / `false` |
| 31 | `scroll_depth_percent` | nein | nur bei Analytics-Consent; keine PII |
| 32 | `engagement_time_msec` | nein | nur bei Analytics-Consent; keine PII |
| 33 | `auftragswert` | nein | später manuell; leer beim Insert |
| 34 | `deckungsbeitrag` | nein | intern, nie auto an Google; leer beim Insert |
| 35 | `ts_neue_anfrage` | ja beim Insert | gesetzt auf `created_at` |
| 36 | `ts_kontakt_aufgenommen` | nein | leer bis Statuswechsel |
| 37 | `ts_qualifizierter_interessent` | nein | leer bis Statuswechsel |
| 38 | `ts_beratungstermin_vereinbart` | nein | leer bis Statuswechsel |
| 39 | `ts_angebot_erstellt` | nein | leer bis Statuswechsel |
| 40 | `ts_auftrag_abgeschlossen` | nein | leer bis Statuswechsel |
| 41 | `ts_auftrag_verloren` | nein | leer bis Statuswechsel |

**Google-Ads-Klickkosten gehören nicht in diese Tabelle.** Später eigener Join (z. B. über `gclid` / Kampagne) gegen Kostenberichte. Kein Feld `ads_click_cost` schreiben.

Besuchsdaten (UTM/GCLID) werden dem Lead **nur** zugeordnet, wenn Marketing-Consent gesetzt ist. Engagement-Snapshot nur bei Analytics-Consent.

Wenn der Tab leer ist, schreibt der Code zuerst diese Kopfzeile und dann den Lead. Trotzdem die Kopfzeile selbst anlegen — dann siehst du sofort, ob Freigabe und API stimmen.

## Env-Variablen (Namen only — niemals Keys ins Repo oder in den Chat)

Nur diese Namen (kein `*_SECRET`, kein JSON-Blob in einer Env):

| Name | Pflicht | Inhalt |
| --- | --- | --- |
| `GOOGLE_SHEETS_ID` | ja | Spreadsheet-ID aus der URL (`https://docs.google.com/spreadsheets/d/`**DIESE_ID**`/edit`) |
| `GOOGLE_SHEETS_RANGE` | nein | Default `Leads!A1` (Tab muss **Leads** heißen, sonst Range anpassen) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | ja | `client_email` aus der JSON-Keydatei (`…@….iam.gserviceaccount.com`) |
| `GOOGLE_PRIVATE_KEY` | ja | `private_key` aus derselben JSON, inkl. `-----BEGIN PRIVATE KEY-----`. Zeilenumbrüche als `\n`; der Code ersetzt `\\n` → echte Newlines. |

Nicht committen: `.env`, `.env.local`, JSON-Keydateien. `.env.example` enthält nur Namen.

Lokal (ohne Vercel): dieselben Namen in `.env.local` (liegt in `.gitignore`).

### Vercel Preview vs Production

- **Production**-Env gilt für Deployments von **`main`** (bzw. Production-Branch).
- **Preview**-Env gilt für Preview-Deployments (PRs, andere Branches).
- Wenn du die API auf einem **Preview**-Deployment testest, müssen die Sheet-Variablen **auch unter Preview** gesetzt sein. Nur Production zu füllen reicht dafür nicht.
- Production-Env **jetzt nicht** setzen, solange nicht nach `main` gemerged und die Sheet-Prüfung durch ist.

## Persönliche Einrichtung (du klickst — kein GCP-Projekt wird hier angelegt)

Keine bezahlten GCP-Extras, keine Billing-Aktivierung nötig für Sheets API + Service Account auf dem kostenlosen Kontingent. Wenn Google Billing verlangt: **abbrechen** und nicht fortfahren.

### 1. Google Sheet anlegen

1. [Google Tabellen](https://sheets.google.com) öffnen, mit dem Konto anmelden, das die Lead-Liste besitzen soll.
2. **Leere Tabelle** erstellen.
3. Datei umbenennen, z. B. `Kleinkraft Leads`.
4. Unten den Tab in **`Leads`** umbenennen (Rechtsklick auf „Tabelle1“ → Umbenennen).
5. In Zeile 1 die 41 Kopfzellen aus der Spaltentabelle oben einfügen (`lead_id` in A1, `created_at` in B1, … `ts_auftrag_verloren` in AO1).
6. URL kopieren und die **Spreadsheet-ID** merken (zwischen `/d/` und `/edit`). Das ist `GOOGLE_SHEETS_ID`. **Keine** Keys ins Chatfenster legen; ID der Tabelle ist kein Private Key, aber intern behandeln.

### 2. Google-Cloud-Projekt (bestehendes nutzen oder kostenloses anlegen)

1. [Google Cloud Console](https://console.cloud.google.com/) öffnen.
2. Oben Projekt wählen **oder** neu: Projektauswahl → **Neues Projekt** → Name z. B. `kleinkraft-leads` → **Erstellen**.
3. **Kein** Billing-Konto verknüpfen, **keine** bezahlten APIs (BigQuery, Maps, AI) aktivieren.

### 3. Google Sheets API einschalten

1. In der Console: **APIs und Dienste** → **Bibliothek**.
2. Suche **Google Sheets API**.
3. **Aktivieren** (kostenlos im Rahmen der API, ohne extra Produktkauf).
4. Nicht die Google Drive API extra buchen, sofern nicht nötig. Teilen der Datei (Schritt 5) reicht für Append.

### 4. Service Account ohne bezahlte Extras

1. **APIs und Dienste** → **Anmeldedaten**.
2. **+ Anmeldedaten erstellen** → **Dienstkonto**.
3. Name z. B. `kleinkraft-sheets` → **Erstellen und fortfahren**.
4. Rollen: für Sheets-Append reicht später die **Freigabe der Tabelle**. In IAM **keine** Owner/Billing-Rollen vergeben. Wenn die Console eine Rolle verlangt: **Viewer** am Projekt oder Schritt überspringen, falls erlaubt → **Fertig**.
5. Dienstkonto in der Liste anklicken → Reiter **Schlüssel** → **Schlüssel hinzufügen** → **JSON** → **Erstellen**.
6. Die JSON-Datei landet lokal. **Nicht** ins Git-Repo, **nicht** in den Chat.
7. Aus der JSON nur übernehmen:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (Anführungszeichen der JSON weglassen; `\n` so lassen, wie in der Datei, oder den Key in Vercel in Anführungszeichen mit `\n` einfügen)

### 5. Tabelle mit dem Service Account teilen (Bearbeiter)

1. Google Sheet öffnen → **Teilen**.
2. Die **`client_email`** des Dienstkontos einfügen (endet auf `iam.gserviceaccount.com`).
3. Rolle **Bearbeiter** (Editor), nicht nur Leser.
4. Häkchen „Benachrichtigung senden“ kann aus — das ist keine Person.
5. **Senden** / **Teilen**.

Ohne diesen Schritt liefert die API 403, Mail geht trotzdem raus (`sheet_ok: false`).

### 6. Env setzen (lokal prüfen, Vercel Preview nur zum Test)

**Lokal**

1. `.env.local` anlegen (nicht committen).
2. `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` eintragen; optional `GOOGLE_SHEETS_RANGE=Leads!A1`.
3. `npm run dev`, Formular mit **fiktiven** Daten absenden.
4. Prüfen: Mail mit Lead-ID; neue Zeile im Tab `Leads`; API-JSON `sheet_status: appended`.

**Vercel** (erst wenn du Preview testen willst — nicht Production/`main`)

1. Vercel-Projekt → **Settings** → **Environment Variables**.
2. Jeden Namen einzeln anlegen.
3. Environment-Häkchen: für Branch-Tests **Preview** (und ggf. Development). **Production** erst nach Sheet-Verifikation und ausdrücklichem Merge.
4. Nach dem Setzen: neues Preview-Deployment, sonst sieht die alte Lambda die Vars nicht.

### 7. Verifikation (Muss vor PR nach `main`)

1. Testzeile mit Fantasienamen, nicht mit echten Kundendaten.
2. Sheet: eine Datenzeile, `lead_id` identisch mit Mail-Betreff.
3. Zweites Absenden: **zweite** Zeile (andere `lead_id`) — das ist erwartet.
4. Logs: kein `skipped_missing_config`.
5. Bei Fehler: Freigabe Editor, Tabname `Leads`, Sheets API aktiv, Private Key mit Newlines, richtige Env-Umgebung (Preview vs Production).

## GA4 / GTM

Website lädt GTM `GTM-MR5303RK`. `ga4Id` im Code bleibt leer; **G-3TN9G4651W** nur im Container. Details: `docs/GTM-GA4.md`.

| Stück | Status |
| --- | --- |
| GTM-Container-ID (`gtmId`) | `GTM-MR5303RK` — Loader in `tracking.js` |
| GA4 Measurement-ID im Code (`ga4Id`) | **leer** — kein direktes gtag `G-` |
| GTM GA4 Configuration + Event-Tags | **im Container anlegen** (nicht im Code) |
| GTM-Tag `generate_lead` → GA4 | **noch nötig** in GTM |
| GTM Google-Ads-Conversion-Tag | **nicht** setzen, solange `migrateAdsConversionToGtm` false |
| Microsoft Clarity | **nein** |

`generate_lead` im `dataLayer` enthält nur `event`, `lead_event_source`, optional `lead_id` — **keine** E-Mail, keinen Namen, keine Nachricht, kein Telefon.

## Nicht in diesem Paket

- Microsoft Clarity, Looker Studio, Offline-Conversion-Upload
- Landingpages / Kampagnen-Go-Live
- Live-Calls nach Google Sheets in automatisierten Tests
- Merge nach `main` / Production-Deploy
