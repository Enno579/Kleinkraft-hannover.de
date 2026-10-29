/**
 * Source-level contact validation. No live POST, no Ads, no Sheets.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

let passed = 0;
let failed = 0;

function assert(name, cond, detail) {
  if (cond) {
    passed += 1;
    console.log('PASS  ' + name);
  } else {
    failed += 1;
    console.log('FAIL  ' + name + ' — ' + (detail || 'assertion failed'));
  }
}

const route = read('app/api/contact/route.ts');
const sheet = read('lib/leads/sheet.ts');
const status = read('lib/leads/status.ts');
const phone = read('lib/leads/phone.ts');
const cfg = read('next.config.ts');

assert('product lines are anker_dachanlage and klassische_photovoltaik', /anker_dachanlage/.test(status) && /klassische_photovoltaik/.test(status));
assert('old pv_classic not in PRODUCT_LINES', !/pv_classic/.test(status));
assert('allowedProductLine uses new values', /anker_dachanlage/.test(sheet) && /klassische_photovoltaik/.test(sheet));
assert('sheet columns still start with lead_id and include telefon then later product_line', /'lead_id'[\s\S]*'telefon'[\s\S]*'product_line'[\s\S]*'offer_label'/.test(sheet));
assert('route requires phone', /isValidPhone/.test(route) && /Telefon/.test(route));
assert('route requires product_line', /Anker SOLIX auf dem Hausdach oder Photovoltaik mit Speicher/.test(route));
assert('next config rewrites PV and legal pages', /photovoltaik-speicher\.html/.test(cfg) && /impressum\.html/.test(cfg));
assert('anker slug permanently redirects to homepage', /source: '\/anker-dachanlage'/.test(cfg) && /destination: '\/'/.test(cfg));
assert('homepage rewrite is beforeFiles not a client redirect', /beforeFiles/.test(cfg) && /source: '\/'/.test(cfg));
assert('no App Router redirect to /index.html', !fs.existsSync(path.join(ROOT, 'app/page.tsx')) || !/redirect\(\s*['"]\/index\.html['"]/.test(read('app/page.tsx')));
assert('preview X-Robots-Tag noindex', /VERCEL_ENV === 'preview'/.test(cfg) && /noindex/.test(cfg));
assert('permanent redirects for html slugs', /permanent: true/.test(cfg) && /anker-dachanlage.html/.test(cfg) && /source: '\/index\.html'/.test(cfg));
assert('tracking config unchanged GTM Q', /gtmId:\s*'GTM-MR53Q3RK'/.test(read('public/tracking-config.js')));
assert('ga4Id empty', /ga4Id:\s*''/.test(read('public/tracking-config.js')));
assert('migrateAdsConversionToGtm false', /migrateAdsConversionToGtm:\s*false/.test(read('public/tracking-config.js')));

const sandbox = { window: {}, console: console };
vm.createContext(sandbox);
vm.runInContext(read('public/contact-form.js'), sandbox, { filename: 'contact-form.js' });
const K = sandbox.window.KleinkraftContact;
assert('client phone helper exported', !!(K && K.isValidPhone && K.allowedProductLine));
assert('DE national phone ok', K.isValidPhone('0156 78444101'));
assert('international +49 ok', K.isValidPhone('+49 156 78444101'));
assert('US-style separators ok', K.isValidPhone('+1 (202) 555-0100'));
assert('too short rejected', !K.isValidPhone('12345'));
assert('letters rejected', !K.isValidPhone('call-me'));
assert('empty phone rejected', !K.isValidPhone(''));
assert('anker_dachanlage allowed', K.allowedProductLine('anker_dachanlage') === 'anker_dachanlage');
assert('klassische_photovoltaik allowed', K.allowedProductLine('klassische_photovoltaik') === 'klassische_photovoltaik');
assert('legacy anker_solix rejected', K.allowedProductLine('anker_solix') === '');

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
