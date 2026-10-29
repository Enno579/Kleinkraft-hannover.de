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
    },
    addEventListener: function (type, fn) {
      (el._listeners[type] = el._listeners[type] || []).push(fn);
    },
    appendChild: function (child) {
      el.children.push(child);
      return child;
    },
    closest: function () {
      return null;
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
    location: { pathname: '/' },
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

['index.html', 'datenschutz.html', 'impressum.html'].forEach(function (file) {
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

console.log('');
console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
