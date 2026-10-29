/**
 * Local GTM/GA4 wiring tests. Mocks Google loaders — no network, no form posts.
 * Run: node scripts/gtm-ga4.local.test.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  console.log('PASS  ' + name);
}

function fail(name, detail) {
  failed += 1;
  console.log('FAIL  ' + name + ' — ' + detail);
}

function assert(name, cond, detail) {
  if (cond) ok(name);
  else fail(name, detail || 'assertion failed');
}

function readPublic(name) {
  return fs.readFileSync(path.join(PUBLIC, name), 'utf8');
}

function scriptOrder(html) {
  const srcs = [];
  const re = /<script\b([^>]*)>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    const src = /src="([^"]+)"/.exec(attrs);
    srcs.push(src ? src[1] : '(inline)');
  }
  return srcs;
}

function indexOfSrc(order, needle) {
  return order.findIndex(function (s) {
    return s.indexOf(needle) !== -1;
  });
}

function makeEl(tag) {
  const el = {
    tagName: String(tag).toUpperCase(),
    children: [],
    attributes: {},
    dataset: {},
    className: '',
    id: '',
    hidden: false,
    src: '',
    async: false,
    innerHTML: '',
    textContent: '',
    value: undefined,
    disabled: false,
    checked: false,
    _listeners: {},
    style: {},
    classList: {
      add: function () {},
      remove: function () {},
    },
    querySelector: function (sel) {
      return queryOne(el, sel);
    },
    querySelectorAll: function (sel) {
      return queryAll(el, sel);
    },
    getAttribute: function (n) {
      return el.attributes[n] != null ? el.attributes[n] : null;
    },
    setAttribute: function (n, v) {
      el.attributes[n] = String(v);
      if (n === 'id') el.id = String(v);
      if (n === 'name') el.name = String(v);
      if (n === 'type') el.type = String(v);
    },
    addEventListener: function (type, fn) {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    },
    appendChild: function (child) {
      child.parentNode = el;
      el.children.push(child);
      return child;
    },
    insertBefore: function (child, ref) {
      child.parentNode = el;
      const idx = el.children.indexOf(ref);
      if (idx === -1) el.children.push(child);
      else el.children.splice(idx, 0, child);
      return child;
    },
    insertAdjacentElement: function (_pos, node) {
      if (el.parentNode) return el.parentNode.appendChild(node);
      return node;
    },
    closest: function () {
      return null;
    },
    reset: function () {
      walk(el, []).forEach(function (node) {
        if (node.tagName === 'INPUT' || node.tagName === 'SELECT' || node.tagName === 'TEXTAREA') {
          node.value = '';
        }
      });
    },
  };
  return el;
}

function walk(node, acc) {
  acc.push(node);
  (node.children || []).forEach(function (c) {
    walk(c, acc);
  });
  return acc;
}

function matches(el, sel) {
  if (sel.indexOf('script[src*="') === 0) {
    const needle = sel.slice('script[src*="'.length, sel.lastIndexOf('"'));
    return el.tagName === 'SCRIPT' && String(el.src || '').indexOf(needle) !== -1;
  }
  if (sel.charAt(0) === '#') return el.id === sel.slice(1);
  if (sel === 'button[type="submit"]') {
    return el.tagName === 'BUTTON' && el.attributes.type === 'submit';
  }
  const nameMatch = /^\[name="([^"]+)"\]$/.exec(sel);
  if (nameMatch) return el.attributes.name === nameMatch[1];
  return false;
}

function queryAll(root, sel) {
  return walk(root, []).filter(function (n) {
    return matches(n, sel);
  });
}

function queryOne(root, sel) {
  const all = queryAll(root, sel);
  return all.length ? all[0] : null;
}

function createWindow() {
  const head = makeEl('head');
  const body = makeEl('body');
  const documentElement = makeEl('html');
  documentElement.appendChild(head);
  documentElement.appendChild(body);

  const document = {
    head: head,
    body: body,
    documentElement: documentElement,
    readyState: 'complete',
    cookie: '',
    hidden: false,
    visibilityState: 'visible',
    createElement: function (tag) {
      return makeEl(tag);
    },
    getElementById: function (id) {
      return queryOne(documentElement, '#' + id);
    },
    querySelector: function (sel) {
      return queryOne(documentElement, sel);
    },
    querySelectorAll: function (sel) {
      return queryAll(documentElement, sel);
    },
    addEventListener: function (type, fn) {
      (document._listeners[type] = document._listeners[type] || []).push(fn);
    },
    dispatchEvent: function (event) {
      const list = (document._listeners[event.type] || []).slice();
      list.forEach(function (fn) {
        fn(event);
      });
    },
    _listeners: {},
  };

  const window = {
    document: document,
    dataLayer: [],
    KLEINKRAFT_TRACKING: undefined,
    location: { pathname: '/', href: 'http://localhost/' },
    requestAnimationFrame: function (cb) {
      cb();
    },
    fetch: function () {
      return Promise.reject(new Error('fetch not mocked'));
    },
    pageYOffset: 0,
    innerHeight: 800,
    addEventListener: function () {},
    setInterval: function () {
      return 1;
    },
    clearInterval: function () {},
    CustomEvent: function (type, init) {
      return { type: type, detail: (init && init.detail) || {} };
    },
  };
  window.window = window;
  document.defaultView = window;
  return window;
}

function runScript(window, source, filename) {
  const sandbox = {
    window: window,
    document: window.document,
    console: console,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Promise: Promise,
    fetch: function () {
      return window.fetch.apply(window, arguments);
    },
    gtag: window.gtag,
    encodeURIComponent: encodeURIComponent,
    decodeURIComponent: decodeURIComponent,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: filename });
  return sandbox;
}

function gtmScripts(window) {
  return window.document.head.children.filter(function (el) {
    return el.tagName === 'SCRIPT' && String(el.src).indexOf('/gtm.js?id=') !== -1;
  });
}

function ga4GtagConfigs(dataLayer) {
  return dataLayer.filter(function (item) {
    if (!item) return false;
    if (item.event) return false;
    const args = item.length != null ? Array.prototype.slice.call(item) : null;
    if (!args) return false;
    return args[0] === 'config' && String(args[1] || '').indexOf('G-') === 0;
  });
}

function consentCommands(dataLayer, command) {
  return dataLayer.filter(function (item) {
    const args = item && item.length != null ? Array.prototype.slice.call(item) : null;
    return args && args[0] === 'consent' && args[1] === command;
  });
}

// --- static file checks ---

const configSrc = readPublic('tracking-config.js');
assert(
  'gtmId is GTM-MR53Q3RK',
  /gtmId:\s*'GTM-MR53Q3RK'/.test(configSrc),
  configSrc.match(/gtmId:\s*'[^']*'/)[0],
);
assert('ga4Id is empty string', /ga4Id:\s*''/.test(configSrc));
assert('G-3TN9G4651W only in comments', configSrc.indexOf('G-3TN9G4651W') !== -1);
assert(
  'ga4Id line is not a G- measurement id',
  !/ga4Id:\s*'G-/.test(configSrc),
);
const FORBIDDEN_GA4 = 'G-D7QK7952J4';
function walkFiles(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (ent) {
    if (ent.name === 'node_modules' || ent.name === '.next' || ent.name === '.git' || ent.name === 'tests') {
      return;
    }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, acc);
    else acc.push(full);
  });
  return acc;
}
const oldIdHits = [];
walkFiles(ROOT, []).forEach(function (file) {
  if (path.relative(ROOT, file) === path.join('scripts', 'gtm-ga4.local.test.cjs')) return;
  const text = fs.readFileSync(file, 'utf8');
  if (text.indexOf(FORBIDDEN_GA4) === -1) return;
  String(text)
    .split(/\n/)
    .forEach(function (line, i) {
      if (line.indexOf(FORBIDDEN_GA4) === -1) return;
      oldIdHits.push(path.relative(ROOT, file) + ':' + (i + 1));
    });
});
assert('old GA4 G-D7QK7952J4 is not mapped anywhere', oldIdHits.length === 0, oldIdHits.join(', '));
assert('migrateAdsConversionToGtm is false', /migrateAdsConversionToGtm:\s*false/.test(configSrc));
assert('Ads id stays AW-328006841', /adsId:\s*'AW-328006841'/.test(configSrc));

const contactSrc = readPublic('contact-form.js');
assert(
  'generate_lead has no email/name/message/phone keys',
  /event:\s*'generate_lead'/.test(contactSrc) &&
    !/payload\.(email|vorname|nachname|nachricht|telefon|phone|name)\s*=/.test(contactSrc),
);
const adsFnMatch = contactSrc.match(
  /function trackGoogleAdsConversion\([^)]*\) \{[\s\S]*?\n  \}/,
);
assert(
  'generate_lead is not nested in Ads conversion / gtag early-return',
  /pushGenerateLead\(result\.data\.lead_id\)/.test(contactSrc) &&
    adsFnMatch &&
    adsFnMatch[0].indexOf('pushGenerateLead') === -1,
);
assert(
  'contact form does not navigate or reload on success',
  !/location\.(href|assign|replace|reload)/.test(contactSrc) &&
    !/history\.(pushState|replaceState)/.test(contactSrc) &&
    !/target\s*=\s*['"]_blank['"]/.test(contactSrc),
);
assert(
  'index form has no action/target navigation',
  !/<form[^>]*id="contactForm"[^>]*(action=|target=)/.test(readPublic('index.html')),
);

['index.html', 'anker-dachanlage.html', 'photovoltaik-speicher.html'].forEach(function (file) {
  const html = readPublic(file);
  assert(
    file + ' title/description without Balkonkraftwerk or Steckersolar',
    !/Balkonkraftwerk|Steckersolar|Balkonkraft/i.test(html.match(/<title>[^<]+/)[0] + (html.match(/name="description" content="[^"]+"/) || [''])[0]),
  );
  assert(
    file + ' requires telefon in markup',
    /name="telefon"[^>]*required|required[^>]*name="telefon"/.test(html) && /Telefon/.test(html),
  );
  assert(
    file + ' has product_line field',
    /name="product_line"/.test(html),
  );
});

assert(
  'canonical homepage',
  /rel="canonical" href="https:\/\/www\.kleinkraft-hannover\.de\/"/.test(readPublic('index.html')),
);
assert(
  'canonical anker page',
  /rel="canonical" href="https:\/\/www\.kleinkraft-hannover\.de\/anker-dachanlage"/.test(
    readPublic('anker-dachanlage.html'),
  ),
);
assert(
  'canonical classic page',
  /rel="canonical" href="https:\/\/www\.kleinkraft-hannover\.de\/photovoltaik-speicher"/.test(
    readPublic('photovoltaik-speicher.html'),
  ),
);
assert('sitemap lists both offers', /anker-dachanlage/.test(readPublic('sitemap.xml')) && /photovoltaik-speicher/.test(readPublic('sitemap.xml')));
assert('robots.txt has sitemap', /Sitemap: https:\/\/www\.kleinkraft-hannover\.de\/sitemap.xml/.test(readPublic('robots.txt')));

assert(
  'anker landing has no link to photovoltaik-speicher',
  !/href=["']\/photovoltaik-speicher/.test(readPublic('anker-dachanlage.html')),
);
assert(
  'pv landing has no link to anker-dachanlage',
  !/href=["']\/anker-dachanlage/.test(readPublic('photovoltaik-speicher.html')),
);
assert(
  'homepage has no offer-landing hrefs',
  !/href=["']\/anker-dachanlage/.test(readPublic('index.html')) &&
    !/href=["']\/photovoltaik-speicher/.test(readPublic('index.html')),
);
assert(
  'legal pages have no offer-landing hrefs',
  !/href=["']\/anker-dachanlage/.test(readPublic('impressum.html')) &&
    !/href=["']\/photovoltaik-speicher/.test(readPublic('impressum.html')) &&
    !/href=["']\/anker-dachanlage/.test(readPublic('datenschutz.html')) &&
    !/href=["']\/photovoltaik-speicher/.test(readPublic('datenschutz.html')),
);
assert(
  'pv H1 is visitor-friendly without Klassische PV-Anlage',
  /<h1[^>]*>Photovoltaik mit Speicher für dein Zuhause in Hannover<\/h1>/.test(
    readPublic('photovoltaik-speicher.html'),
  ) && !/Klassische PV-Anlage/.test(readPublic('photovoltaik-speicher.html')),
);
assert(
  'anker H1 is independent Anker SOLIX headline',
  /<h1[^>]*>Anker SOLIX mit Speicher für dein Zuhause in Hannover<\/h1>/.test(
    readPublic('anker-dachanlage.html'),
  ),
);
assert(
  'both landings use Hannover hero photo',
  /src="hannover\.jpg"/.test(readPublic('anker-dachanlage.html')) &&
    /src="hannover\.jpg"/.test(readPublic('photovoltaik-speicher.html')) &&
    /src="hannover\.jpg"/.test(readPublic('index.html')),
);
assert(
  'anker form stays anker_dachanlage',
  /data-product-line="anker_dachanlage"/.test(readPublic('anker-dachanlage.html')) &&
    /name="product_line"[^>]*value="anker_dachanlage"/.test(readPublic('anker-dachanlage.html')),
);
assert(
  'pv form stays klassische_photovoltaik internally',
  /data-product-line="klassische_photovoltaik"/.test(readPublic('photovoltaik-speicher.html')) &&
    /name="product_line"[^>]*value="klassische_photovoltaik"/.test(readPublic('photovoltaik-speicher.html')),
);
assert(
  'anker logo stays on anker landing',
  /class="nav__logo"[^>]*href="\/anker-dachanlage"|href="\/anker-dachanlage"[^>]*class="nav__logo"/.test(
    readPublic('anker-dachanlage.html'),
  ),
);
assert(
  'pv logo stays on pv landing',
  /class="nav__logo"[^>]*href="\/photovoltaik-speicher"|href="\/photovoltaik-speicher"[^>]*class="nav__logo"/.test(
    readPublic('photovoltaik-speicher.html'),
  ),
);

['index.html', 'datenschutz.html', 'impressum.html', 'anker-dachanlage.html', 'photovoltaik-speicher.html'].forEach(function (file) {
  const html = readPublic(file);
  const order = scriptOrder(html);
  const iConfig = indexOfSrc(order, 'tracking-config.js');
  const iConsent = indexOfSrc(order, 'consent.js');
  const iAds = indexOfSrc(order, 'gtag/js?id=AW-328006841');
  const iTracking = indexOfSrc(order, 'tracking.js');
  assert(
    file + ' consent before Ads gtag before tracking.js',
    iConfig !== -1 &&
      iConsent !== -1 &&
      iAds !== -1 &&
      iTracking !== -1 &&
      iConfig < iConsent &&
      iConsent < iAds &&
      iAds < iTracking,
    JSON.stringify(order),
  );
  assert(file + ' has no GTM snippet besides tracking.js', html.indexOf('gtm.js?id=') === -1);
  assert(file + ' has no gtag G-3TN9', html.indexOf('G-3TN9G4651W') === -1);
});

const engagementSrc = readPublic('engagement.js');
assert(
  'scroll/engagement gated on analytics consent',
  engagementSrc.indexOf('hasAnalyticsConsent') !== -1 &&
    engagementSrc.indexOf("pushEvent('scroll_depth'") !== -1 &&
    engagementSrc.indexOf("pushEvent('engagement_time'") !== -1,
);

// --- mocked runtime ---

const win = createWindow();
runScript(win, configSrc, 'tracking-config.js');
runScript(win, readPublic('consent.js'), 'consent.js');

const defaults = consentCommands(win.dataLayer, 'default');
assert('consent default fired before GTM', defaults.length === 1);
const denied = defaults[0][2];
assert(
  'all four CM v2 defaults denied',
  denied.ad_storage === 'denied' &&
    denied.ad_user_data === 'denied' &&
    denied.ad_personalization === 'denied' &&
    denied.analytics_storage === 'denied',
  JSON.stringify(denied),
);

const gtmEventBefore = win.dataLayer.some(function (i) {
  return i && i.event === 'gtm.js';
});
assert('no gtm.js event before tracking.js', !gtmEventBefore);

runScript(win, readPublic('tracking.js'), 'tracking.js');

const gtm = gtmScripts(win);
assert('exactly one GTM script', gtm.length === 1, 'count=' + gtm.length);
assert(
  'GTM script id is GTM-MR53Q3RK',
  gtm[0] && gtm[0].src.indexOf('id=GTM-MR53Q3RK') !== -1,
  gtm[0] && gtm[0].src,
);
assert(
  'gtm.js dataLayer event once',
  win.dataLayer.filter(function (i) {
    return i && i.event === 'gtm.js';
  }).length === 1,
);
assert('no direct GA4 gtag config G-', ga4GtagConfigs(win.dataLayer).length === 0);
assert('__kleinkraftGa4Loaded is not set', !win.__kleinkraftGa4Loaded);

runScript(win, readPublic('tracking.js'), 'tracking.js');
assert('second tracking.js does not add another GTM script', gtmScripts(win).length === 1);
assert(
  'second tracking.js does not push another gtm.js',
  win.dataLayer.filter(function (i) {
    return i && i.event === 'gtm.js';
  }).length === 1,
);

win.KleinkraftConsent.get = function () {
  return { analytics: true, marketing: true };
};
win.gtag('consent', 'update', {
  analytics_storage: 'granted',
  ad_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
});
assert('consent update still uses gtag', consentCommands(win.dataLayer, 'update').length >= 1);

win.gtag('consent', 'update', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});
assert(
  'reject/revoke still gtag consent update',
  consentCommands(win.dataLayer, 'update').length >= 2,
);

const bothWin = createWindow();
runScript(bothWin, configSrc, 'tracking-config.js');
bothWin.KLEINKRAFT_TRACKING.ga4Id = 'G-3TN9G4651W';
runScript(bothWin, readPublic('tracking.js'), 'tracking.js');
assert(
  'GTM wins: filled ga4Id does not load direct G-',
  gtmScripts(bothWin).length === 1 && ga4GtagConfigs(bothWin.dataLayer).length === 0,
);

function generateLeadEvents(dataLayer) {
  return (dataLayer || []).filter(function (item) {
    return item && item.event === 'generate_lead';
  });
}

function adsConversionCommands(dataLayer) {
  return (dataLayer || []).filter(function (item) {
    const args = item && item.length != null ? Array.prototype.slice.call(item) : null;
    return args && args[0] === 'event' && args[1] === 'conversion';
  });
}

function makeField(name, value) {
  const el = makeEl('input');
  el.setAttribute('name', name);
  el.value = value;
  return el;
}

function mountContactForm(window) {
  const form = makeEl('form');
  form.id = 'contactForm';
  form.setAttribute('id', 'contactForm');
  ['vorname', 'nachname', 'email'].forEach(function (name) {
    const val = name === 'email' ? 'test@example.com' : 'Test';
    form.appendChild(makeField(name, val));
  });
  form.appendChild(makeField('telefon', '015678444101'));
  form.appendChild(makeField('product_line', 'anker_dachanlage'));
  form.appendChild(makeField('nachricht', 'Hallo'));
  const btn = makeEl('button');
  btn.setAttribute('type', 'submit');
  btn.textContent = 'Senden';
  form.appendChild(btn);
  window.document.body.appendChild(form);
  return form;
}

function submitForm(form) {
  const event = { preventDefault: function () {} };
  (form._listeners.submit || []).forEach(function (fn) {
    fn(event);
  });
}

function deferredFetch(result) {
  let resolve;
  const promise = new Promise(function (res) {
    resolve = res;
  });
  function fetchMock() {
    return promise.then(function () {
      return {
        ok: result.ok !== false,
        json: function () {
          return Promise.resolve(result.data);
        },
      };
    });
  }
  return { fetchMock: fetchMock, resolve: resolve };
}

function waitTicks(n) {
  let p = Promise.resolve();
  for (let i = 0; i < (n || 6); i++) {
    p = p.then(function () {
      return new Promise(function (resolve) {
        setImmediate(resolve);
      });
    });
  }
  return p;
}

function setupFormWindow(opts) {
  const window = createWindow();
  window.KLEINKRAFT_TRACKING = {
    gtmId: 'GTM-MR53Q3RK',
    ga4Id: '',
    adsId: 'AW-328006841',
    adsConversionSendTo: 'AW-328006841/0NTKCJzv5cgCENs5s5wB',
    migrateAdsConversionToGtm: !!opts.migrateAds,
  };
  window.KleinkraftConsent = {
    get: function () {
      return { analytics: !!opts.analytics, marketing: !!opts.marketing };
    },
  };
  window.dataLayer = [];
  if (opts.withGtag) {
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
  }
  const pending = deferredFetch(
    opts.api || { ok: true, data: { success: true, lead_id: 'lead-1' } },
  );
  window.__fetchCalls = 0;
  window.__lastFetchBody = null;
  window.fetch = function () {
    window.__fetchCalls += 1;
    window.__lastFetchBody = arguments[1] && arguments[1].body;
    return pending.fetchMock.apply(null, arguments);
  };
  const form = mountContactForm(window);
  runScript(window, readPublic('contact-form.js'), 'contact-form.js');
  return { window: window, form: form, resolveFetch: pending.resolve };
}

async function runFormTests() {
  const beforeApi = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  submitForm(beforeApi.form);
  assert(
    'generate_lead is not pushed before API success',
    generateLeadEvents(beforeApi.window.dataLayer).length === 0,
  );
  beforeApi.resolveFetch();
  await waitTicks(8);
  const leadAfter = generateLeadEvents(beforeApi.window.dataLayer);
  assert(
    'analytics granted + marketing denied → generate_lead once',
    leadAfter.length === 1,
    'count=' + leadAfter.length,
  );
  const lead = leadAfter[0] || {};
  assert(
    'generate_lead payload has source and lead_id only',
    lead.event === 'generate_lead' &&
      lead.lead_event_source === 'contact_form' &&
      lead.lead_id === 'lead-1' &&
      lead.email == null &&
      lead.vorname == null &&
      lead.nachname == null &&
      lead.nachricht == null &&
      lead.telefon == null &&
      lead.phone == null &&
      lead.name == null,
    JSON.stringify(lead),
  );

  const noGtag = setupFormWindow({ analytics: true, marketing: false, withGtag: false });
  submitForm(noGtag.form);
  noGtag.resolveFetch();
  await waitTicks(8);
  assert(
    'generate_lead still fires without gtag when analytics granted',
    generateLeadEvents(noGtag.window.dataLayer).length === 1,
  );
  assert(
    'Ads conversion skipped when gtag missing',
    adsConversionCommands(noGtag.window.dataLayer).length === 0,
  );

  const noAnalytics = setupFormWindow({ analytics: false, marketing: true, withGtag: true });
  submitForm(noAnalytics.form);
  noAnalytics.resolveFetch();
  await waitTicks(8);
  assert(
    'analytics denied → no generate_lead',
    generateLeadEvents(noAnalytics.window.dataLayer).length === 0,
  );
  assert(
    'Ads conversion still uses gtag when present (consent mode)',
    adsConversionCommands(noAnalytics.window.dataLayer).length === 1,
  );

  const adsOk = setupFormWindow({ analytics: true, marketing: true, withGtag: true });
  submitForm(adsOk.form);
  adsOk.resolveFetch();
  await waitTicks(8);
  assert(
    'API success with both consents → one generate_lead',
    generateLeadEvents(adsOk.window.dataLayer).length === 1,
  );
  assert(
    'API success with gtag → one Ads conversion',
    adsConversionCommands(adsOk.window.dataLayer).length === 1,
  );

  const migrated = setupFormWindow({
    analytics: true,
    marketing: true,
    withGtag: true,
    migrateAds: true,
  });
  submitForm(migrated.form);
  migrated.resolveFetch();
  await waitTicks(8);
  assert(
    'migrateAdsConversionToGtm true still pushes generate_lead',
    generateLeadEvents(migrated.window.dataLayer).length === 1,
  );
  assert(
    'migrateAdsConversionToGtm true skips Ads gtag conversion',
    adsConversionCommands(migrated.window.dataLayer).length === 0,
  );

  const apiFail = setupFormWindow({
    analytics: true,
    marketing: false,
    withGtag: true,
    api: { ok: false, data: { success: false, error: 'nope' } },
  });
  submitForm(apiFail.form);
  apiFail.resolveFetch();
  await waitTicks(8);
  assert(
    'failed API does not push generate_lead',
    generateLeadEvents(apiFail.window.dataLayer).length === 0,
  );

  const invalid = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  invalid.form.querySelector('[name="email"]').value = '';
  submitForm(invalid.form);
  invalid.resolveFetch();
  await waitTicks(8);
  assert(
    'invalid form does not push generate_lead',
    generateLeadEvents(invalid.window.dataLayer).length === 0,
  );

  const noPhone = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  noPhone.form.querySelector('[name="telefon"]').value = '';
  submitForm(noPhone.form);
  assert('missing phone does not call /api/contact', noPhone.window.__fetchCalls === 0);
  assert(
    'missing phone does not push generate_lead',
    generateLeadEvents(noPhone.window.dataLayer).length === 0,
  );

  const badPhone = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  badPhone.form.querySelector('[name="telefon"]').value = 'abc';
  submitForm(badPhone.form);
  assert('invalid phone does not call /api/contact', badPhone.window.__fetchCalls === 0);

  const badLine = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  badLine.form.querySelector('[name="product_line"]').value = 'anker_solix';
  submitForm(badLine.form);
  assert('invalid product_line does not call /api/contact', badLine.window.__fetchCalls === 0);

  const intlOk = setupFormWindow({ analytics: true, marketing: false, withGtag: true });
  intlOk.form.querySelector('[name="telefon"]').value = '+49 156 78444101';
  intlOk.form.querySelector('[name="product_line"]').value = 'klassische_photovoltaik';
  submitForm(intlOk.form);
  assert('valid international phone starts API call', intlOk.window.__fetchCalls === 1);
  var posted = JSON.parse(intlOk.window.__lastFetchBody || '{}');
  assert(
    'POST body keeps phone and product_line',
    posted.telefon === '+49 156 78444101' && posted.product_line === 'klassische_photovoltaik',
    JSON.stringify(posted),
  );
  intlOk.resolveFetch();
  await waitTicks(8);
  assert(
    'valid phone+product_line still generate_lead once',
    generateLeadEvents(intlOk.window.dataLayer).length === 1,
  );

  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
}

runFormTests().catch(function (err) {
  fail('form tests threw', err && err.stack ? err.stack : String(err));
  console.log('');
  console.log(passed + ' passed, ' + failed + ' failed');
  process.exit(1);
});
