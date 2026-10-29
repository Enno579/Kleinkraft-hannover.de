import { randomUUID } from 'crypto';
import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import {
  allowedProductLine,
  appendLeadToSheet,
  sanitizeAttribution,
  sanitizeEngagement,
  type AppendLeadResult,
} from '../../../lib/leads/sheet';
import { isValidPhone } from '../../../lib/leads/phone';
import { DEFAULT_LEAD_STATUS, PRODUCT_LINES } from '../../../lib/leads/status';

const TO_EMAIL = 'Ennosch93@gmail.com';
const DEFAULT_FROM = 'Kleinkraft Hannover <kontakt@kleinkraft-hannover.de>';

const WOHNSITUATION_LABELS: Record<string, string> = {
  eigentuemer: 'Hauseigentümer',
  unklar: 'Noch unklar',
};

const MONTAGEORT_LABELS: Record<string, string> = {
  dach: 'Hausdach',
  garage: 'Garagendach',
  beides: 'Haus- und Garagendach',
  unklar: 'Noch unklar',
};

const FINANZIERUNG_LABELS: Record<string, string> = {
  ja: 'Ja',
  nein: 'Nein',
  vielleicht: 'Vielleicht',
};

type ContactPayload = {
  vorname?: string;
  nachname?: string;
  email?: string;
  telefon?: string;
  jahresverbrauch?: string;
  wohnsituation?: string;
  montageort?: string;
  finanzierung_interesse?: string;
  nachricht?: string;
  product_line?: string;
  landing_page?: string;
  marketing_consent?: boolean;
  analytics_consent?: boolean;
  attribution?: unknown;
  engagement?: unknown;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelFor(value: string | undefined, labels: Record<string, string>): string {
  if (!value) return '–';
  return labels[value] ?? value;
}

function buildSubject(vorname: string, nachname: string, email: string, leadId: string): string {
  const who = vorname && nachname ? `${vorname} ${nachname}` : email;
  return `Neue Beratungsanfrage – ${who} – ${leadId}`;
}

function buildEmailHtml(
  data: Required<Pick<ContactPayload, 'vorname' | 'nachname' | 'email'>> &
    ContactPayload & { lead_id: string; status: string },
): string {
  const rows: Array<[string, string]> = [
    ['Lead-ID', data.lead_id],
    ['Status', data.status],
    ['Vorname', data.vorname],
    ['Nachname', data.nachname],
    ['E-Mail', data.email],
    ['Telefon', data.telefon || '–'],
    ['Jahresstromverbrauch (kWh)', data.jahresverbrauch || '–'],
    ['Wohnsituation', labelFor(data.wohnsituation, WOHNSITUATION_LABELS)],
    ['Montageort', labelFor(data.montageort, MONTAGEORT_LABELS)],
    ['Interesse an Finanzierung', labelFor(data.finanzierung_interesse, FINANZIERUNG_LABELS)],
    [
      'Angebotslinie',
      data.product_line && data.product_line in PRODUCT_LINES
        ? `${data.product_line} (${PRODUCT_LINES[data.product_line as keyof typeof PRODUCT_LINES]})`
        : data.product_line || '–',
    ],
    ['Landingpage', data.landing_page || '–'],
    ['Nachricht', data.nachricht || '–'],
  ];

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 12px;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`,
    )
    .join('');

  return `
    <h2>Neue Beratungsanfrage</h2>
    <table style="border-collapse:collapse;width:100%;max-width:600px;">
      ${body}
    </table>
  `;
}

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Kontakt-API ist erreichbar. POST zum Absenden des Formulars.',
    endpoint: '/api/contact',
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'E-Mail-Versand ist derzeit nicht konfiguriert. Bitte später erneut versuchen.' },
      { status: 500 },
    );
  }

  let payload: ContactPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Ungültige Anfrage. Bitte Formular erneut absenden.' },
      { status: 400 },
    );
  }

  const vorname = payload.vorname?.trim() ?? '';
  const nachname = payload.nachname?.trim() ?? '';
  const email = payload.email?.trim() ?? '';
  const telefon = payload.telefon?.trim() ?? '';
  const productLine = allowedProductLine(payload.product_line);

  if (!vorname || !nachname || !email || !telefon) {
    return NextResponse.json(
      { error: 'Bitte Vorname, Nachname, E-Mail und Telefon ausfüllen.' },
      { status: 400 },
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Bitte eine gültige E-Mail-Adresse eingeben.' },
      { status: 400 },
    );
  }

  if (!isValidPhone(telefon)) {
    return NextResponse.json(
      {
        error:
          'Bitte eine erreichbare Telefonnummer angeben (international, z. B. +49 156 78444101 oder 0156 78444101).',
      },
      { status: 400 },
    );
  }

  if (!productLine) {
    return NextResponse.json(
      { error: 'Bitte eine Angebotslinie wählen (Anker-Dachanlage oder Klassische Photovoltaik).' },
      { status: 400 },
    );
  }

  const leadId = randomUUID();
  const createdAt = new Date().toISOString();
  const marketingConsent = payload.marketing_consent === true;
  const analyticsConsent = payload.analytics_consent === true;
  const landingPage = payload.landing_page ? String(payload.landing_page).trim().slice(0, 500) : '';
  const attribution = sanitizeAttribution(payload.attribution, marketingConsent);
  const engagement = sanitizeEngagement(payload.engagement, analyticsConsent);

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: TO_EMAIL,
    replyTo: email,
    subject: buildSubject(vorname, nachname, email, leadId),
    html: buildEmailHtml({
      lead_id: leadId,
      status: DEFAULT_LEAD_STATUS,
      vorname,
      nachname,
      email,
      telefon,
      jahresverbrauch: payload.jahresverbrauch?.trim(),
      wohnsituation: payload.wohnsituation,
      montageort: payload.montageort,
      finanzierung_interesse: payload.finanzierung_interesse,
      nachricht: payload.nachricht?.trim(),
      product_line: productLine || undefined,
      landing_page: landingPage || undefined,
    }),
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json(
      { error: 'Die Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen oder uns direkt kontaktieren.' },
      { status: 502 },
    );
  }

  let sheet: AppendLeadResult = {
    ok: false,
    skipped: true,
    sheet_status: 'skipped_missing_config',
  };

  try {
    sheet = await appendLeadToSheet({
      lead_id: leadId,
      created_at: createdAt,
      status: DEFAULT_LEAD_STATUS,
      vorname,
      nachname,
      email,
      telefon,
      jahresverbrauch: payload.jahresverbrauch?.trim(),
      wohnsituation: payload.wohnsituation,
      montageort: payload.montageort,
      finanzierung_interesse: payload.finanzierung_interesse,
      nachricht: payload.nachricht?.trim(),
      product_line: productLine || undefined,
      landing_page: landingPage || undefined,
      marketing_consent: marketingConsent,
      analytics_consent: analyticsConsent,
      attribution,
      engagement,
    });
  } catch (sheetErr) {
    console.error('[leads] appendLeadToSheet failed (e-mail already sent):', sheetErr);
    sheet = {
      ok: false,
      skipped: false,
      sheet_status: 'error',
      sheet_error: 'sheets_append_failed',
    };
  }

  const sheetOk =
    sheet.sheet_status === 'appended' || sheet.sheet_status === 'skipped_duplicate_lead_id';
  const body: {
    success: true;
    lead_id: string;
    sheet_ok: boolean;
    sheet_status: string;
    sheet_error?: string;
  } = {
    success: true,
    lead_id: leadId,
    sheet_ok: sheetOk,
    sheet_status: sheet.sheet_status,
  };
  if (sheet.sheet_status === 'error') {
    body.sheet_error = sheet.sheet_error || 'sheets_append_failed';
  }

  return NextResponse.json(body);
}
