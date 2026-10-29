import { JWT } from 'google-auth-library';
import { DEFAULT_LEAD_STATUS, timestampKeyForStatus, type LeadStatus, type ProductLine } from './status';

/**
 * Google Sheets lead list via Sheets API v4 REST + service-account JWT.
 *
 * Without GOOGLE_SHEETS_ID + credentials this module does NOT write and does
 * not pretend the row is in the sheet (skipped_missing_config).
 *
 * Ads click costs are NOT stored here (placeholder for a later cost-data join).
 */

const ATTRIBUTION_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'wbraid',
  'gbraid',
  'gad_source',
  'landing_page',
  'referrer',
  'first_touch_at',
  'last_touch_at',
] as const;

export type AttributionSnapshot = Partial<Record<(typeof ATTRIBUTION_KEYS)[number], string>>;

export type EngagementSnapshot = {
  scroll_depth_percent?: number;
  engagement_time_msec?: number;
};

export type LeadSheetInput = {
  lead_id: string;
  created_at: string;
  status: LeadStatus;
  vorname: string;
  nachname: string;
  email: string;
  telefon?: string;
  jahresverbrauch?: string;
  wohnsituation?: string;
  montageort?: string;
  finanzierung_interesse?: string;
  nachricht?: string;
  product_line?: string;
  landing_page?: string;
  marketing_consent: boolean;
  analytics_consent: boolean;
  attribution?: AttributionSnapshot | null;
  engagement?: EngagementSnapshot | null;
};

export const SHEET_COLUMNS = [
  'lead_id',
  'created_at',
  'status',
  'vorname',
  'nachname',
  'email',
  'telefon',
  'jahresverbrauch',
  'wohnsituation',
  'montageort',
  'finanzierung_interesse',
  'nachricht',
  'product_line',
  'offer_label',
  'landing_page',
  'campaign',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'gclid',
  'wbraid',
  'gbraid',
  'gad_source',
  'referrer',
  'first_touch_at',
  'last_touch_at',
  'marketing_consent',
  'analytics_consent',
  'scroll_depth_percent',
  'engagement_time_msec',
  'auftragswert',
  'deckungsbeitrag',
  'ts_neue_anfrage',
  'ts_kontakt_aufgenommen',
  'ts_qualifizierter_interessent',
  'ts_beratungstermin_vereinbart',
  'ts_angebot_erstellt',
  'ts_auftrag_abgeschlossen',
  'ts_auftrag_verloren',
  // ads_click_cost: NOT stored. Placeholder for a later Google Ads cost-data join.
] as const;

export const DEFAULT_SHEETS_RANGE = 'Leads!A1';
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEDUPE_LOOKBACK_ROWS = 200;

const PRODUCT_LINE_LABELS: Record<string, string> = {
  pv_classic: 'A – klassische PV komplett mit Speicher',
  anker_solix: 'B – Anker SOLIX Dach/Garage (8.000–13.000 EUR)',
};

/** Same-request / same-isolate: do not append the same lead_id twice in one handler. */
const appendedOrAttemptedLeadIds = new Set<string>();

function clip(value: unknown, max = 500): string {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

export function sanitizeAttribution(
  raw: unknown,
  marketingConsent: boolean,
): AttributionSnapshot | null {
  if (!marketingConsent || !raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: AttributionSnapshot = {};
  let has = false;
  for (const key of ATTRIBUTION_KEYS) {
    const value = clip(src[key]);
    if (value) {
      out[key] = value;
      has = true;
    }
  }
  return has ? out : null;
}

export function sanitizeEngagement(
  raw: unknown,
  analyticsConsent: boolean,
): EngagementSnapshot | null {
  if (!analyticsConsent || !raw || typeof raw !== 'object') return null;
  const src = raw as Record<string, unknown>;
  const out: EngagementSnapshot = {};
  const depth = Number(src.scroll_depth_percent);
  const time = Number(src.engagement_time_msec);
  if (Number.isFinite(depth)) {
    out.scroll_depth_percent = Math.min(100, Math.max(0, Math.round(depth)));
  }
  if (Number.isFinite(time) && time >= 0) {
    out.engagement_time_msec = Math.round(time);
  }
  return out.scroll_depth_percent != null || out.engagement_time_msec != null ? out : null;
}

export function allowedProductLine(value: unknown): ProductLine | '' {
  const v = clip(value, 40);
  if (v === 'pv_classic' || v === 'anker_solix') return v;
  return '';
}

export type ServiceAccountCreds = { email: string; key: string };

/** PEM / PKCS#8 as Google and Vercel actually deliver it (quotes, `\n`, real newlines). */
export function normalizePrivateKey(raw: string): string {
  let key = raw.replace(/^\uFEFF/, '').trim();
  if (key.length >= 2) {
    const start = key[0];
    const end = key[key.length - 1];
    if ((start === '"' && end === '"') || (start === "'" && end === "'")) {
      key = key.slice(1, -1).trim();
    }
  }
  // Literal \n / \r from JSON or a single-line env value. No-op when the PEM
  // already has real newlines (PKCS#8 base64 never contains a backslash).
  for (let i = 0; i < 2; i++) {
    if (!/\\[nr]/.test(key)) break;
    key = key.replace(/\\n/g, '\n').replace(/\\r/g, '\r');
  }
  return key.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

export function parseServiceAccountJson(raw: string): ServiceAccountCreds | null {
  try {
    const parsed = JSON.parse(raw) as { client_email?: unknown; private_key?: unknown };
    const email = typeof parsed.client_email === 'string' ? parsed.client_email.trim() : '';
    const key = typeof parsed.private_key === 'string' ? normalizePrivateKey(parsed.private_key) : '';
    if (!email || !key) return null;
    return { email, key };
  } catch {
    return null;
  }
}

export function readServiceAccountCreds(env: NodeJS.ProcessEnv = process.env): ServiceAccountCreds | null {
  const email = env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || '';
  const keyRaw = env.GOOGLE_PRIVATE_KEY?.trim() || '';
  if (!email || !keyRaw) return null;
  return { email, key: normalizePrivateKey(keyRaw) };
}

export function sheetsRange(env: NodeJS.ProcessEnv = process.env): string {
  return env.GOOGLE_SHEETS_RANGE?.trim() || DEFAULT_SHEETS_RANGE;
}

export function isSheetsConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const sheetId = env.GOOGLE_SHEETS_ID?.trim();
  if (!sheetId) return false;
  return !!readServiceAccountCreds(env);
}

export function buildLeadSheetRow(input: LeadSheetInput): string[] {
  const status: LeadStatus = input.status || DEFAULT_LEAD_STATUS;
  const created = input.created_at;
  const attr = input.marketing_consent ? input.attribution || null : null;
  const eng = input.analytics_consent ? input.engagement || null : null;
  const productLine = allowedProductLine(input.product_line);
  const landing =
    clip(input.landing_page) ||
    (attr && attr.landing_page) ||
    '';
  const ts: Record<string, string> = {
    ts_neue_anfrage: '',
    ts_kontakt_aufgenommen: '',
    ts_qualifizierter_interessent: '',
    ts_beratungstermin_vereinbart: '',
    ts_angebot_erstellt: '',
    ts_auftrag_abgeschlossen: '',
    ts_auftrag_verloren: '',
  };
  ts[timestampKeyForStatus(status)] = created;

  const byKey: Record<(typeof SHEET_COLUMNS)[number], string> = {
    lead_id: input.lead_id,
    created_at: created,
    status,
    vorname: clip(input.vorname, 120),
    nachname: clip(input.nachname, 120),
    email: clip(input.email, 200),
    telefon: clip(input.telefon, 40),
    jahresverbrauch: clip(input.jahresverbrauch, 40),
    wohnsituation: clip(input.wohnsituation, 40),
    montageort: clip(input.montageort, 40),
    finanzierung_interesse: clip(input.finanzierung_interesse, 40),
    nachricht: clip(input.nachricht, 4000),
    product_line: productLine,
    offer_label: productLine ? PRODUCT_LINE_LABELS[productLine] : '',
    landing_page: landing,
    campaign: attr?.utm_campaign || '',
    utm_source: attr?.utm_source || '',
    utm_medium: attr?.utm_medium || '',
    utm_campaign: attr?.utm_campaign || '',
    utm_content: attr?.utm_content || '',
    utm_term: attr?.utm_term || '',
    gclid: attr?.gclid || '',
    wbraid: attr?.wbraid || '',
    gbraid: attr?.gbraid || '',
    gad_source: attr?.gad_source || '',
    referrer: attr?.referrer || '',
    first_touch_at: attr?.first_touch_at || '',
    last_touch_at: attr?.last_touch_at || '',
    marketing_consent: input.marketing_consent ? 'true' : 'false',
    analytics_consent: input.analytics_consent ? 'true' : 'false',
    scroll_depth_percent: eng?.scroll_depth_percent != null ? String(eng.scroll_depth_percent) : '',
    engagement_time_msec: eng?.engagement_time_msec != null ? String(eng.engagement_time_msec) : '',
    auftragswert: '',
    deckungsbeitrag: '',
    ts_neue_anfrage: ts.ts_neue_anfrage,
    ts_kontakt_aufgenommen: ts.ts_kontakt_aufgenommen,
    ts_qualifizierter_interessent: ts.ts_qualifizierter_interessent,
    ts_beratungstermin_vereinbart: ts.ts_beratungstermin_vereinbart,
    ts_angebot_erstellt: ts.ts_angebot_erstellt,
    ts_auftrag_abgeschlossen: ts.ts_auftrag_abgeschlossen,
    ts_auftrag_verloren: ts.ts_auftrag_verloren,
  };

  return SHEET_COLUMNS.map((col) => byKey[col]);
}

export type SheetStatus =
  | 'appended'
  | 'skipped_missing_config'
  | 'skipped_duplicate_lead_id'
  | 'error';

export type AppendLeadResult = {
  ok: boolean;
  skipped: boolean;
  sheet_status: SheetStatus;
  sheet_error?: string;
};

function publicSheetError(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as Error).message === 'string') {
    return clip((err as Error).message, 300).replace(/-----BEGIN[\s\S]*?PRIVATE KEY-----/g, '[redacted]');
  }
  return 'sheets_append_failed';
}

async function getAccessToken(creds: ServiceAccountCreds): Promise<string> {
  const jwt = new JWT({
    email: creds.email,
    key: creds.key,
    scopes: [SHEETS_SCOPE],
  });
  const token = await jwt.getAccessToken();
  const value = typeof token === 'string' ? token : token?.token;
  if (!value) throw new Error('sheets_auth_no_token');
  return value;
}

function valuesUrl(spreadsheetId: string, range: string, suffix = ''): string {
  const encodedRange = encodeURIComponent(range);
  return (
    'https://sheets.googleapis.com/v4/spreadsheets/' +
    encodeURIComponent(spreadsheetId) +
    '/values/' +
    encodedRange +
    suffix
  );
}

async function sheetsJson(
  token: string,
  url: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  return { ok: res.ok, status: res.status, body };
}

function leadIdAlreadyPresent(values: unknown, leadId: string): boolean {
  if (!Array.isArray(values)) return false;
  const start = Math.max(0, values.length - DEDUPE_LOOKBACK_ROWS);
  for (let i = start; i < values.length; i++) {
    const row = values[i];
    if (Array.isArray(row) && String(row[0] || '') === leadId) return true;
  }
  return false;
}

function needsHeaderRow(values: unknown): boolean {
  if (!Array.isArray(values) || values.length === 0) return true;
  const first = values[0];
  return !(Array.isArray(first) && String(first[0] || '') === 'lead_id');
}

/**
 * Append a lead row via Sheets API v4. Throws only on unexpected bugs;
 * network/API failures return sheet_status error.
 */
export async function appendLeadToSheet(
  input: LeadSheetInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<AppendLeadResult> {
  const row = buildLeadSheetRow(input);

  if (!isSheetsConfigured(env)) {
    console.info(
      '[leads] Google Sheets not configured (GOOGLE_SHEETS_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY missing). Skipping append. sheet_status=skipped_missing_config lead_id=' +
        input.lead_id,
    );
    return { ok: false, skipped: true, sheet_status: 'skipped_missing_config' };
  }

  if (appendedOrAttemptedLeadIds.has(input.lead_id)) {
    console.info(
      '[leads] Same lead_id already handled in this isolate — skip second append. lead_id=' + input.lead_id,
    );
    return { ok: true, skipped: true, sheet_status: 'skipped_duplicate_lead_id' };
  }
  appendedOrAttemptedLeadIds.add(input.lead_id);

  const spreadsheetId = env.GOOGLE_SHEETS_ID!.trim();
  const range = sheetsRange(env);
  const creds = readServiceAccountCreds(env);
  if (!creds) {
    console.info(
      '[leads] Google Sheets credentials unreadable. Skipping append. sheet_status=skipped_missing_config lead_id=' +
        input.lead_id,
    );
    return { ok: false, skipped: true, sheet_status: 'skipped_missing_config' };
  }

  try {
    const token = await getAccessToken(creds);
    const getUrl = valuesUrl(spreadsheetId, range);
    const existing = await sheetsJson(token, getUrl);
    if (!existing.ok) {
      throw new Error('sheets_read_http_' + existing.status);
    }

    const values = existing.body.values;
    if (leadIdAlreadyPresent(values, input.lead_id)) {
      console.info('[leads] lead_id already in sheet lookback — skip append. lead_id=' + input.lead_id);
      return { ok: true, skipped: true, sheet_status: 'skipped_duplicate_lead_id' };
    }

    const payloadRows: string[][] = needsHeaderRow(values)
      ? [(SHEET_COLUMNS as readonly string[]).slice(), row]
      : [row];

    const appendUrl =
      valuesUrl(spreadsheetId, range, ':append') +
      '?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
    const appended = await sheetsJson(token, appendUrl, {
      method: 'POST',
      body: JSON.stringify({ values: payloadRows, majorDimension: 'ROWS' }),
    });
    if (!appended.ok) {
      throw new Error('sheets_append_http_' + appended.status);
    }

    console.info('[leads] Google Sheets append ok. lead_id=' + input.lead_id);
    return { ok: true, skipped: false, sheet_status: 'appended' };
  } catch (err) {
    const sheet_error = publicSheetError(err);
    console.error('[leads] Google Sheets append failed. lead_id=' + input.lead_id, sheet_error);
    return { ok: false, skipped: false, sheet_status: 'error', sheet_error };
  }
}
