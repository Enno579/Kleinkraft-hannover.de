/**
 * Source-level: without creds the module must skip (no live Sheets).
 * Does not import google-auth-library or call sheets.googleapis.com.
 */
const fs = require('fs');
const path = require('path');

const sheet = fs.readFileSync(path.join(__dirname, '../lib/leads/sheet.ts'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '../app/api/contact/route.ts'), 'utf8');

function assert(name, cond) {
  if (!cond) throw new Error('FAIL  ' + name);
  console.log('PASS  ' + name);
}

assert('skip status constant', sheet.indexOf("sheet_status: 'skipped_missing_config'") !== -1);
assert(
  'no silent ok on missing config',
  sheet.indexOf("ok: false, skipped: true, sheet_status: 'skipped_missing_config'") !== -1,
);
assert('config gate before JWT token', sheet.indexOf('isSheetsConfigured') < sheet.indexOf('getAccessToken'));
assert('live URL only after config check', /if \(!isSheetsConfigured\(env\)\)/.test(sheet));
assert('route surfaces skipped_missing_config', route.indexOf('skipped_missing_config') !== -1);
assert('route keeps success true after mail', route.indexOf('success: true') !== -1 && route.indexOf('sheet_ok') !== -1);

console.log('PASS  sheet skip without creds (no live Sheets call)');
