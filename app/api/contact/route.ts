import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const TO_EMAIL = 'Ennosch93@gmail.com';
const SUBJECT = 'Neue Beratungsanfrage über kleinkraft-hannover.de';
const DEFAULT_FROM = 'Kleinkraft Hannover <kontakt@kleinkraft-hannover.de>';

const WOHNSITUATION_LABELS: Record<string, string> = {
  mieter: 'Mieter',
  eigentuemer: 'Eigentümer',
};

const MONTAGEORT_LABELS: Record<string, string> = {
  balkon: 'Balkon',
  dach: 'Dach',
  garage: 'Garage',
  garten: 'Garten',
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

function buildEmailHtml(data: Required<Pick<ContactPayload, 'vorname' | 'nachname' | 'email'>> & ContactPayload): string {
  const rows = [
    ['Vorname', data.vorname],
    ['Nachname', data.nachname],
    ['E-Mail', data.email],
    ['Telefon', data.telefon || '–'],
    ['Jahresstromverbrauch (kWh)', data.jahresverbrauch || '–'],
    ['Wohnsituation', labelFor(data.wohnsituation, WOHNSITUATION_LABELS)],
    ['Montageort', labelFor(data.montageort, MONTAGEORT_LABELS)],
    ['Interesse an Finanzierung', labelFor(data.finanzierung_interesse, FINANZIERUNG_LABELS)],
    ['Nachricht', data.nachricht || '–'],
  ];

  const body = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;vertical-align:top;">${escapeHtml(label)}</td>` +
        `<td style="padding:8px 12px;">${escapeHtml(value).replace(/\n/g, '<br>')}</td></tr>`
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
      { status: 500 }
    );
  }

  let payload: ContactPayload;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Ungültige Anfrage. Bitte Formular erneut absenden.' },
      { status: 400 }
    );
  }

  const vorname = payload.vorname?.trim() ?? '';
  const nachname = payload.nachname?.trim() ?? '';
  const email = payload.email?.trim() ?? '';

  if (!vorname || !nachname || !email) {
    return NextResponse.json(
      { error: 'Bitte Vorname, Nachname und E-Mail ausfüllen.' },
      { status: 400 }
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: 'Bitte eine gültige E-Mail-Adresse eingeben.' },
      { status: 400 }
    );
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: TO_EMAIL,
    replyTo: email,
    subject: SUBJECT,
    html: buildEmailHtml({
      vorname,
      nachname,
      email,
      telefon: payload.telefon?.trim(),
      jahresverbrauch: payload.jahresverbrauch?.trim(),
      wohnsituation: payload.wohnsituation,
      montageort: payload.montageort,
      finanzierung_interesse: payload.finanzierung_interesse,
      nachricht: payload.nachricht?.trim(),
    }),
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json(
      { error: 'Die Anfrage konnte nicht gesendet werden. Bitte später erneut versuchen oder uns direkt kontaktieren.' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true });
}
