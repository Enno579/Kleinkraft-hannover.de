/** Sales pipeline statuses for the lead sheet. Deckungsbeitrag is internal-only. */

export const LEAD_STATUSES = [
  'Neue Anfrage',
  'Kontakt aufgenommen',
  'Qualifizierter Interessent',
  'Beratungstermin vereinbart',
  'Angebot erstellt',
  'Auftrag abgeschlossen',
  'Auftrag verloren',
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const DEFAULT_LEAD_STATUS: LeadStatus = 'Neue Anfrage';

export const PRODUCT_LINES = {
  pv_classic: 'Angebot A – klassische PV-Komplettanlage mit Speicher',
  anker_solix: 'Angebot B – Anker SOLIX Dach/Garage (Zielpreis 8.000–13.000 EUR)',
} as const;

export type ProductLine = keyof typeof PRODUCT_LINES;

export const STATUS_TIMESTAMP_KEYS = [
  'ts_neue_anfrage',
  'ts_kontakt_aufgenommen',
  'ts_qualifizierter_interessent',
  'ts_beratungstermin_vereinbart',
  'ts_angebot_erstellt',
  'ts_auftrag_abgeschlossen',
  'ts_auftrag_verloren',
] as const;

export function timestampKeyForStatus(status: LeadStatus): (typeof STATUS_TIMESTAMP_KEYS)[number] {
  switch (status) {
    case 'Neue Anfrage':
      return 'ts_neue_anfrage';
    case 'Kontakt aufgenommen':
      return 'ts_kontakt_aufgenommen';
    case 'Qualifizierter Interessent':
      return 'ts_qualifizierter_interessent';
    case 'Beratungstermin vereinbart':
      return 'ts_beratungstermin_vereinbart';
    case 'Angebot erstellt':
      return 'ts_angebot_erstellt';
    case 'Auftrag abgeschlossen':
      return 'ts_auftrag_abgeschlossen';
    case 'Auftrag verloren':
      return 'ts_auftrag_verloren';
  }
}
