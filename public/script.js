(function () {
  'use strict';

  /* ---- Utilities ---- */

  var prefersReducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function formatEuro(value) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(Math.round(value));
  }

  function parseNum(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var val = parseFloat(el.value);
    return isNaN(val) ? fallback : val;
  }

  function parseIntField(id, fallback) {
    var el = document.getElementById(id);
    if (!el) return fallback;
    var val = parseInt(el.value, 10);
    return isNaN(val) ? fallback : val;
  }

  function formatCounter(value) {
    return new Intl.NumberFormat('de-DE').format(Math.round(value));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateNumber(el, target, duration, formatter) {
    if (!el || prefersReducedMotion) {
      if (el) el.textContent = formatter(target);
      return;
    }

    var start = parseFloat(el.dataset.currentValue);
    if (isNaN(start)) start = 0;
    var from = start;
    var startTime = null;

    function frame(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var current = from + (target - from) * easeOutCubic(progress);
      el.textContent = formatter(current);
      el.dataset.currentValue = String(current);

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatter(target);
        el.dataset.currentValue = String(target);
      }
    }

    requestAnimationFrame(frame);
  }

  function formatEuroMonthly(value) {
    return new Intl.NumberFormat('de-DE', {
      maximumFractionDigits: 0
    }).format(Math.round(value));
  }

  function formatEuroRate(value) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  }

  function animateEuroMonthly(el, target, duration) {
    animateNumber(el, target, duration, formatEuroMonthly);
  }

  function animateEuro(el, target, duration) {
    animateNumber(el, target, duration, function (v) {
      return formatEuro(v);
    });
  }

  function runStatCounters(root) {
    if (!root) return;
    root.querySelectorAll('.stat-counter[data-target]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(target)) return;
      animateNumber(el, target, 1400, formatCounter);
    });
  }

  /* ---- Calculator (pure math) ---- */

  var ANLAGENPREIS = 8000;
  var SYSTEM_KW = 4;
  var YIELD_KWH_PER_KWP = 950;
  var SELF_CONSUMPTION_LOW = 0.70;
  var SELF_CONSUMPTION_HIGH = 0.75;
  var YEARS = 20;
  var INTEREST_RATE = 0.057;

  function calcWithoutPV(consumption, pricePerKwh, grundgebuehr, increasePct, years) {
    var total = 0;
    var price = pricePerKwh;
    var grund = grundgebuehr;
    var factor = 1 + increasePct / 100;
    var yearOne = 0;

    for (var y = 1; y <= years; y++) {
      var yearCost = consumption * price + grund;
      if (y === 1) yearOne = yearCost;
      total += yearCost;
      price *= factor;
      grund *= factor;
    }

    return {
      total: total,
      yearOne: yearOne,
      avgMonthly: total / (years * 12)
    };
  }

  function calcGridElectricity(consumption, selfKwh, pricePerKwh, grundgebuehr, increasePct, years) {
    var total = 0;
    var price = pricePerKwh;
    var grund = grundgebuehr;
    var factor = 1 + increasePct / 100;
    var gridKwh = Math.max(0, consumption - selfKwh);

    for (var y = 1; y <= years; y++) {
      total += gridKwh * price + grund;
      price *= factor;
      grund *= factor;
    }

    return total;
  }

  function calcYearlyWithPV(consumption, selfKwh, pricePerKwh, grundgebuehr, increasePct, years, anlagenpreis, finEnabled, finanzierungJahre, monthlyRate) {
    var total = 0;
    var gridTotal = 0;
    var financeTotal = 0;
    var price = pricePerKwh;
    var grund = grundgebuehr;
    var factor = 1 + increasePct / 100;
    var gridKwh = Math.max(0, consumption - selfKwh);

    for (var y = 1; y <= years; y++) {
      var gridCost = gridKwh * price + grund;
      var finCost = 0;
      if (finEnabled && y <= finanzierungJahre) {
        finCost = monthlyRate * 12;
      } else if (!finEnabled && y === 1) {
        finCost = anlagenpreis;
      }
      var yearCost = gridCost + finCost;
      gridTotal += gridCost;
      financeTotal += finCost;
      total += yearCost;
      price *= factor;
      grund *= factor;
    }

    return {
      total: total,
      gridTotal: gridTotal,
      financeTotal: financeTotal,
      gridKwh: gridKwh,
      avgMonthly: total / (years * 12)
    };
  }

  function calcAnnuityMonthly(principal, years, annualRate) {
    if (principal <= 0 || years <= 0) return 0;
    if (annualRate <= 0) return principal / (years * 12);

    var r = annualRate / 12;
    var n = years * 12;
    var factor = Math.pow(1 + r, n);
    return principal * (r * factor) / (factor - 1);
  }

  function calcFinancing(anlagenpreis, finanzierungJahre, enabled) {
    if (!enabled) {
      return {
        total: anlagenpreis,
        monthlyRate: 0,
        totalPayments: anlagenpreis,
        enabled: false
      };
    }

    var monthlyRate = calcAnnuityMonthly(anlagenpreis, finanzierungJahre, INTEREST_RATE);
    var totalPayments = monthlyRate * finanzierungJahre * 12;

    return {
      total: totalPayments,
      monthlyRate: monthlyRate,
      totalPayments: totalPayments,
      enabled: true,
      finanzierungJahre: finanzierungJahre
    };
  }

  function calcWithPV(consumption, pricePerKwh, grundgebuehr, increasePct, years, anlagenpreis, finanzierungEnabled, finanzierungJahre) {
    var annualProduction = SYSTEM_KW * YIELD_KWH_PER_KWP;
    var selfLow = annualProduction * SELF_CONSUMPTION_LOW;
    var selfHigh = annualProduction * SELF_CONSUMPTION_HIGH;
    var selfMid = (selfLow + selfHigh) / 2;

    var finance = calcFinancing(anlagenpreis, finanzierungJahre, finanzierungEnabled);

    var stromLow = calcGridElectricity(consumption, selfHigh, pricePerKwh, grundgebuehr, increasePct, years);
    var stromHigh = calcGridElectricity(consumption, selfLow, pricePerKwh, grundgebuehr, increasePct, years);
    var stromMid = calcGridElectricity(consumption, selfMid, pricePerKwh, grundgebuehr, increasePct, years);

    var yearlyMid = calcYearlyWithPV(
      consumption, selfMid, pricePerKwh, grundgebuehr, increasePct, years,
      anlagenpreis, finanzierungEnabled, finanzierungJahre, finance.monthlyRate
    );

    var yearlyLow = calcYearlyWithPV(
      consumption, selfHigh, pricePerKwh, grundgebuehr, increasePct, years,
      anlagenpreis, finanzierungEnabled, finanzierungJahre, finance.monthlyRate
    );

    var yearlyHigh = calcYearlyWithPV(
      consumption, selfLow, pricePerKwh, grundgebuehr, increasePct, years,
      anlagenpreis, finanzierungEnabled, finanzierungJahre, finance.monthlyRate
    );

    return {
      stromMid: stromMid,
      stromLow: stromLow,
      stromHigh: stromHigh,
      finance: finance,
      totalMid: yearlyMid.total,
      totalLow: yearlyLow.total,
      totalHigh: yearlyHigh.total,
      avgMonthlyMid: yearlyMid.avgMonthly,
      avgMonthlyLow: yearlyLow.avgMonthly,
      avgMonthlyHigh: yearlyHigh.avgMonthly,
      reststromMid: yearlyMid.gridKwh,
      reststromLow: Math.max(0, consumption - selfHigh),
      reststromHigh: Math.max(0, consumption - selfLow),
      selfLowPct: Math.round(SELF_CONSUMPTION_LOW * 100),
      selfHighPct: Math.round(SELF_CONSUMPTION_HIGH * 100),
      annualProduction: annualProduction
    };
  }

  /* ---- Navigation ---- */

  if (typeof document !== 'undefined') {

  var nav = document.getElementById('nav');
  var navToggle = document.getElementById('navToggle');
  var navMobile = document.getElementById('navMobile');
  var heroImg = document.getElementById('heroImg');
  var trustVisual = document.getElementById('trustVisual');
  var trustParallaxLayers = trustVisual
    ? trustVisual.querySelectorAll('.enno-trust__parallax[data-parallax]')
    : [];
  var trustMouseX = 0;
  var trustMouseY = 0;
  var trustHovering = false;

  if (trustVisual && !prefersReducedMotion && window.matchMedia('(hover: hover)').matches) {
    trustVisual.addEventListener('mouseenter', function () { trustHovering = true; });
    trustVisual.addEventListener('mouseleave', function () {
      trustHovering = false;
      trustMouseX = 0;
      trustMouseY = 0;
      applyTrustParallax(0);
    });
    trustVisual.addEventListener('mousemove', function (e) {
      var rect = trustVisual.getBoundingClientRect();
      trustMouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      trustMouseY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      applyTrustParallax();
    });
  }

  var trustScrollDelta = 0;

  function applyTrustParallax(scrollDelta) {
    if (scrollDelta !== undefined) trustScrollDelta = scrollDelta;
    if (!trustVisual || !trustParallaxLayers.length) return;
    trustParallaxLayers.forEach(function (layer) {
      var speed = parseFloat(layer.getAttribute('data-parallax')) || 0;
      var scrollY = trustScrollDelta * (speed / 28);
      var hoverX = trustHovering ? trustMouseX * speed * 0.08 : 0;
      var hoverY = trustHovering ? trustMouseY * speed * 0.06 : 0;
      layer.style.transform = 'translate3d(' + hoverX.toFixed(2) + 'px, ' + (scrollY + hoverY).toFixed(2) + 'px, 0)';
    });
  }
  var navLinks = document.querySelectorAll('.nav__links a[href^="#"]');
  var sectionNavMap = [];

  document.querySelectorAll('main section[id], main .hannover-strip[id]').forEach(function (section) {
    var id = section.getAttribute('id');
    if (!id) return;
    var link = document.querySelector('.nav__links a[href="#' + id + '"]');
    if (link) sectionNavMap.push({ id: id, el: section, link: link });
  });

  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('nav--scrolled', window.scrollY > 40);

    if (!prefersReducedMotion && heroImg) {
      var offset = Math.min(window.scrollY * 0.22, 120);
      var scale = 1.06 + Math.min(window.scrollY * 0.00008, 0.04);
      heroImg.style.transform = 'scale(' + scale.toFixed(4) + ') translateY(' + offset.toFixed(1) + 'px)';
    }

    if (!prefersReducedMotion && trustVisual && trustParallaxLayers.length) {
      var trustRect = trustVisual.getBoundingClientRect();
      var viewH = window.innerHeight;
      if (trustRect.bottom > 0 && trustRect.top < viewH) {
        var trustCenter = trustRect.top + trustRect.height * 0.5;
        var viewCenter = viewH * 0.5;
        var trustDelta = (viewCenter - trustCenter) * 0.12;
        applyTrustParallax(trustDelta);
      }
    }

    if (sectionNavMap.length) {
      var scrollPos = window.scrollY + (nav ? nav.offsetHeight : 0) + 80;
      var current = sectionNavMap[0];

      sectionNavMap.forEach(function (item) {
        if (item.el.offsetTop <= scrollPos) current = item;
      });

      navLinks.forEach(function (link) { link.classList.remove('is-active'); });
      if (current && current.link) current.link.classList.add('is-active');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (navToggle && navMobile) {
    navToggle.addEventListener('click', function () {
      var open = navMobile.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open);
      navMobile.setAttribute('aria-hidden', !open);
    });

    navMobile.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navMobile.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navMobile.setAttribute('aria-hidden', 'true');
      });
    });
  }

  /* ---- Scroll reveal ---- */

  var reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  var staggerGroups = document.querySelectorAll('.reveal-stagger');
  if (staggerGroups.length && 'IntersectionObserver' in window) {
    var staggerObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          entry.target.querySelectorAll('.reveal-stagger__item').forEach(function (item) {
            item.classList.add('is-visible');
          });
          staggerObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );
    staggerGroups.forEach(function (el) { staggerObserver.observe(el); });
  } else {
    staggerGroups.forEach(function (el) {
      el.classList.add('is-visible');
      el.querySelectorAll('.reveal-stagger__item').forEach(function (item) {
        item.classList.add('is-visible');
      });
    });
  }

  var trustSection = document.getElementById('beratung');
  var trustCountersStarted = false;
  if (trustSection && 'IntersectionObserver' in window) {
    var trustObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || trustCountersStarted) return;
          trustCountersStarted = true;
          runStatCounters(trustSection);
          trustObserver.unobserve(trustSection);
        });
      },
      { threshold: 0.25 }
    );
    trustObserver.observe(trustSection);
  } else if (trustSection) {
    runStatCounters(trustSection);
  }

  function getTooltipHtml(key) {
    var src = document.getElementById('tooltip-' + key);
    return src ? src.innerHTML : '';
  }

  function initCalcTooltips() {
    var layer = document.getElementById('calcTooltipLayer');
    var tooltip = document.getElementById('calcTooltip');
    if (!layer || !tooltip) return;

    var activeBtn = null;
    var pinnedBtn = null;
    var supportsHover = window.matchMedia('(hover: hover)').matches;

    function setExpanded(btn, expanded) {
      if (!btn) return;
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    function hideTooltip() {
      tooltip.classList.remove('is-visible');
      layer.hidden = true;
      tooltip.innerHTML = '';
      if (activeBtn) {
        activeBtn.classList.remove('is-active');
        setExpanded(activeBtn, false);
        activeBtn = null;
      }
      pinnedBtn = null;
    }

    function positionTooltip(btn) {
      var rect = btn.getBoundingClientRect();
      var tipRect = tooltip.getBoundingClientRect();
      var left = rect.left + rect.width / 2 - tipRect.width / 2;
      var top = rect.bottom + 10;

      left = Math.max(12, Math.min(left, window.innerWidth - tipRect.width - 12));

      if (top + tipRect.height > window.innerHeight - 12) {
        top = rect.top - tipRect.height - 10;
      }

      tooltip.style.left = left + 'px';
      tooltip.style.top = top + 'px';
    }

    function showTooltip(btn, pin) {
      var key = btn.getAttribute('data-tooltip');
      var html = getTooltipHtml(key);
      if (!html) return;

      if (activeBtn && activeBtn !== btn) {
        activeBtn.classList.remove('is-active');
        setExpanded(activeBtn, false);
      }

      activeBtn = btn;
      activeBtn.classList.add('is-active');
      setExpanded(activeBtn, true);
      pinnedBtn = pin ? btn : null;

      tooltip.innerHTML = html;
      layer.hidden = false;
      tooltip.classList.add('is-visible');

      positionTooltip(btn);
      window.requestAnimationFrame(function () {
        positionTooltip(btn);
      });
    }

    document.querySelectorAll('.calc__info[data-tooltip]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (pinnedBtn === btn) hideTooltip();
        else showTooltip(btn, true);
      });

      btn.addEventListener('mouseenter', function () {
        if (supportsHover && !pinnedBtn) showTooltip(btn, false);
      });

      btn.addEventListener('mouseleave', function () {
        if (supportsHover && pinnedBtn !== btn) hideTooltip();
      });

      btn.addEventListener('focus', function () {
        if (!supportsHover) showTooltip(btn, true);
      });

      btn.addEventListener('blur', function () {
        if (!supportsHover && pinnedBtn === btn) hideTooltip();
      });
    });

    layer.addEventListener('click', hideTooltip);

    document.addEventListener('click', function (e) {
      if (layer.hidden) return;
      if (e.target.closest('.calc__info[data-tooltip]')) return;
      if (e.target.closest('#calcTooltip')) return;
      hideTooltip();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideTooltip();
    });

    window.addEventListener('scroll', function () {
      if (!pinnedBtn) hideTooltip();
    }, { passive: true });

    window.addEventListener('resize', function () {
      if (activeBtn) positionTooltip(activeBtn);
    });
  }

  function updateFinancingUI(finanzierungJahre) {
    var toggle = document.getElementById('finanzierungAn');
    var field = document.getElementById('finanzierungField');
    var label = document.getElementById('finanzierungLabel');
    var anlageLabel = document.getElementById('lineAnlageLabel');
    var enabled = toggle && toggle.checked;
    var years = finanzierungJahre || 20;

    if (field) field.hidden = !enabled;
    if (label) label.textContent = enabled ? 'Finanzierung ein' : 'Finanzierung aus';
    if (anlageLabel) {
      anlageLabel.textContent = enabled
        ? 'Finanzierung (' + years + ' J.)'
        : 'Anlagenpreis (einmalig)';
    }
  }

  function updateCalculator(animate) {
    var consumption = parseNum('verbrauch', 4000);
    var pricePerKwh = parseNum('strompreis', 0.30);
    var grundgebuehr = parseNum('grundgebuehr', 120);
    var increasePct = parseNum('steigerung', 4);
    var anlagenpreis = parseNum('anlagenpreis', ANLAGENPREIS);
    var finanzierungJahre = parseIntField('finanzierung', 20);
    var finToggle = document.getElementById('finanzierungAn');
    var finEnabled = finToggle ? finToggle.checked : false;

    updateFinancingUI(finanzierungJahre);

    var ohne = calcWithoutPV(consumption, pricePerKwh, grundgebuehr, increasePct, YEARS);
    var mit = calcWithPV(
      consumption, pricePerKwh, grundgebuehr, increasePct, YEARS,
      anlagenpreis, finEnabled, finanzierungJahre
    );

    var gridAvgMonthly = mit.stromMid / (YEARS * 12);
    var monthlyMitDisplay = finEnabled
      ? mit.avgMonthlyMid
      : gridAvgMonthly;
    var diffMonthly = ohne.avgMonthly - monthlyMitDisplay;
    var diffTotal = ohne.total - mit.totalMid;

    var elMonthlyOhne = document.getElementById('monthlyOhne');
    var elMonthlyMit = document.getElementById('monthlyMit');
    var elMonthlyDiff = document.getElementById('monthlyDiff');
    var elMonthlyDiffPrefix = document.getElementById('monthlyDiffPrefix');
    var elMonthlyDiffSub = document.getElementById('monthlyDiffSub');
    var elSavings20y = document.getElementById('savings20y');
    var elOhne = document.getElementById('resultOhne');
    var elMit = document.getElementById('resultMit');
    var elMitSub = document.getElementById('resultMitSub');
    var elDetailOhne = document.getElementById('detailOhne');
    var elDetailMit = document.getElementById('detailMit');
    var elRangeText = document.getElementById('resultRangeText');
    var elMonthlyRange = document.getElementById('resultMonthlyRange');
    var lineOhneStrom = document.getElementById('lineOhneStrom');
    var lineReststrom = document.getElementById('lineReststrom');
    var lineMitStrom = document.getElementById('lineMitStrom');
    var lineMitAnlage = document.getElementById('lineMitAnlage');
    var finNote = document.getElementById('finNote');
    var finMonthly = document.getElementById('finMonthly');
    var finTotal = document.getElementById('finTotal');
    var finYears = document.getElementById('finYears');
    var calcResults = document.getElementById('calcResults');
    var calcBattle = document.getElementById('calcBattle');
    var meterOhne = document.getElementById('meterOhne');
    var meterMit = document.getElementById('meterMit');
    var battleTotalOhne = document.getElementById('battleTotalOhne');
    var battleTotalMit = document.getElementById('battleTotalMit');
    var battleTagMit = document.getElementById('battleTagMit');
    var battleLabelMit = document.getElementById('battleLabelMit');
    var monthlyMitSub = document.getElementById('monthlyMitSub');

    if (elMonthlyOhne) {
      if (animate) animateEuroMonthly(elMonthlyOhne, ohne.avgMonthly, 900);
      else elMonthlyOhne.textContent = formatEuroMonthly(ohne.avgMonthly);
    }
    if (elMonthlyMit) {
      if (animate) animateEuroMonthly(elMonthlyMit, monthlyMitDisplay, 900);
      else elMonthlyMit.textContent = formatEuroMonthly(monthlyMitDisplay);
    }
    if (elMonthlyDiff) {
      if (diffMonthly > 0) {
        if (animate) animateEuroMonthly(elMonthlyDiff, diffMonthly, 1100);
        else elMonthlyDiff.textContent = formatEuroMonthly(diffMonthly);
        elMonthlyDiff.classList.add('is-positive');
        if (elMonthlyDiffPrefix) elMonthlyDiffPrefix.textContent = '';
        if (elMonthlyDiffSub) elMonthlyDiffSub.textContent = 'weniger';
      } else {
        elMonthlyDiff.textContent = formatEuroMonthly(Math.abs(diffMonthly));
        elMonthlyDiff.classList.remove('is-positive');
        if (elMonthlyDiffPrefix) elMonthlyDiffPrefix.textContent = '';
        if (elMonthlyDiffSub) elMonthlyDiffSub.textContent = 'mehr';
      }
    }

    if (elOhne) {
      if (animate) animateEuro(elOhne, ohne.total, 900);
      else elOhne.textContent = formatEuro(ohne.total);
    }
    if (lineOhneStrom) lineOhneStrom.textContent = formatEuro(ohne.total);
    if (elDetailOhne) elDetailOhne.textContent = 'Jahr 1: ' + formatEuro(ohne.yearOne);

    if (elMit) {
      if (animate) animateEuro(elMit, mit.totalMid, 900);
      else elMit.textContent = formatEuro(mit.totalMid);
    }
    if (elMitSub) {
      elMitSub.textContent = finEnabled
        ? 'Ø Reststrom + Finanzierungsrate über 20 Jahre'
        : 'Ø Reststrom (Anlagenpreis einmalig, siehe Details)';
    }
    if (lineReststrom) {
      lineReststrom.textContent =
        '~' + formatCounter(Math.round(mit.reststromMid)) + ' kWh/Jahr' +
        ' (' + formatCounter(Math.round(mit.reststromLow)) + '–' +
        formatCounter(Math.round(mit.reststromHigh)) + ')';
    }
    if (lineMitStrom) {
      lineMitStrom.textContent = formatEuro(mit.stromMid) +
        ' (' + formatEuro(mit.stromLow) + ' – ' + formatEuro(mit.stromHigh) + ')';
    }
    if (lineMitAnlage) lineMitAnlage.textContent = formatEuro(mit.finance.total);

    if (elDetailMit) {
      elDetailMit.textContent =
        SYSTEM_KW + '.000 W · 8,1 kWh Speicher · ~' +
        Math.round(mit.annualProduction) + ' kWh Erzeugung/Jahr';
    }

    if (finNote) {
      if (mit.finance.enabled) {
        finNote.hidden = false;
        if (finMonthly) finMonthly.textContent = formatEuroRate(mit.finance.monthlyRate);
        if (finTotal) finTotal.textContent = formatEuro(mit.finance.totalPayments);
        if (finYears) finYears.textContent = String(mit.finance.finanzierungJahre);
      } else {
        finNote.hidden = true;
      }
    }

    if (elRangeText) {
      elRangeText.textContent =
        mit.selfLowPct + '–' + mit.selfHighPct + ' % der Erzeugung';
    }

    if (elMonthlyRange) {
      elMonthlyRange.textContent =
        '~' + formatEuroMonthly(mit.avgMonthlyLow) + '–' + formatEuroMonthly(mit.avgMonthlyHigh) + ' € / Monat';
    }

    if (elSavings20y) {
      if (diffTotal > 0) {
        if (animate) animateEuro(elSavings20y, diffTotal, 1100);
        else elSavings20y.textContent = formatEuro(diffTotal);
        elSavings20y.classList.add('is-positive');
        elSavings20y.classList.remove('is-negative');
      } else {
        elSavings20y.textContent = formatEuro(Math.abs(diffTotal)) + ' (kein Potenzial)';
        elSavings20y.classList.remove('is-positive');
        elSavings20y.classList.add('is-negative');
      }
    }

    if (calcBattle) {
      var maxMonthly = Math.max(ohne.avgMonthly, monthlyMitDisplay, 1);
      var ohnePct = Math.min(100, Math.round((ohne.avgMonthly / maxMonthly) * 100));
      var mitPct = Math.min(100, Math.round((monthlyMitDisplay / maxMonthly) * 100));

      if (meterOhne) meterOhne.style.width = ohnePct + '%';
      if (meterMit) meterMit.style.width = mitPct + '%';

      if (battleTotalOhne) {
        battleTotalOhne.innerHTML =
          '<strong>' + formatEuro(ohne.total) + '</strong> in 20 Jahren — verbrannt · am Ende <strong>null</strong>';
      }

      if (battleTotalMit) {
        battleTotalMit.innerHTML =
          '<strong>' + formatEuro(anlagenpreis) + '+</strong> Eigentum · <strong>deine PV-Anlage</strong> gehört dir';
      }

      if (battleTagMit) {
        battleTagMit.textContent = diffMonthly > 0 ? 'Du gewinnst.' : 'Du investierst.';
      }

      if (battleLabelMit) {
        battleLabelMit.textContent = finEnabled
          ? 'Monatlich mit PV — inkl. Finanzierungsrate'
          : 'Monatlich mit PV — Reststrom & Anlage';
      }

      if (monthlyMitSub) {
        monthlyMitSub.textContent = finEnabled
          ? 'Ø Reststrom + Finanzierung über 20 Jahre'
          : 'Ø Reststrom (Anlage einmalig, siehe Details)';
      }

      calcBattle.classList.add('is-live');
      if (animate) {
        calcBattle.classList.remove('is-pulse');
        window.requestAnimationFrame(function () {
          calcBattle.classList.add('is-pulse');
        });
        window.setTimeout(function () { calcBattle.classList.remove('is-pulse'); }, 1200);
      }
    }

    if (calcResults && animate) {
      calcResults.classList.add('is-updated');
      window.setTimeout(function () { calcResults.classList.remove('is-updated'); }, 1000);
    }
  }

  var calcForm = document.getElementById('calcForm');
  if (calcForm) {
    initCalcTooltips();

    calcForm.addEventListener('submit', function (e) {
      e.preventDefault();
      updateCalculator(true);
    });

    calcForm.querySelectorAll('input, select').forEach(function (input) {
      input.addEventListener('input', function () { updateCalculator(false); });
      input.addEventListener('change', function () { updateCalculator(false); });
    });

    updateCalculator(false);
  }

  /* ---- FAQ accordion ---- */

  document.querySelectorAll('.faq__item').forEach(function (item) {
    var summary = item.querySelector('.faq__q');
    if (!summary) return;

    if (item.hasAttribute('open')) item.classList.add('is-open');

    summary.addEventListener('click', function (e) {
      if (prefersReducedMotion) return;

      e.preventDefault();
      var willOpen = !item.classList.contains('is-open');

      document.querySelectorAll('.faq__item.is-open').forEach(function (openItem) {
        if (openItem !== item) {
          openItem.classList.remove('is-open');
          openItem.removeAttribute('open');
        }
      });

      item.classList.toggle('is-open', willOpen);
      if (willOpen) item.setAttribute('open', '');
      else item.removeAttribute('open');
    });
  });

  /* ---- Calc battle arena: scroll-trigger ---- */

  var calcBattleEl = document.getElementById('calcBattle');
  if (calcBattleEl) {
    function activateCalcBattle() {
      calcBattleEl.classList.add('is-live');
    }

    if ('IntersectionObserver' in window) {
      var calcBattleObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              activateCalcBattle();
              calcBattleObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.2, rootMargin: '0px 0px -40px 0px' }
      );
      calcBattleObserver.observe(calcBattleEl);
    } else {
      activateCalcBattle();
    }
  }

  /* ---- Contact form: see public/contact-form.js ---- */

  /* ---- YouTube embed (click-to-play with thumbnail) ---- */

  var YOUTUBE_VIDEO_ID = '9GIppt-UMN4';
  var videoEmbed = document.getElementById('videoEmbed');
  var videoPoster = document.getElementById('videoPoster');
  var videoIframe = document.getElementById('videoIframe');
  var videoFileNotice = document.getElementById('videoFileNotice');

  function buildYouTubeEmbedUrl(autoplay) {
    var origin = encodeURIComponent(location.origin);
    var url =
      'https://www.youtube.com/embed/' + YOUTUBE_VIDEO_ID +
      '?origin=' + origin +
      '&widget_referrer=' + origin;
    if (autoplay) url += '&autoplay=1';
    return url;
  }

  function playYouTubeVideo() {
    if (!videoEmbed || !videoIframe) return;

    if (location.protocol === 'file:') {
      if (videoFileNotice) videoFileNotice.hidden = false;
      return;
    }

    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

    videoIframe.src = buildYouTubeEmbedUrl(true);
    videoEmbed.classList.add('is-playing');
  }

  if (location.protocol === 'file:') {
    if (videoFileNotice) videoFileNotice.hidden = false;
  }

  if (videoPoster) {
    videoPoster.addEventListener('click', playYouTubeVideo);
  }

  /* ---- Footer year ---- */

  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- Smooth anchor offset for fixed nav ---- */

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (!target) return;
      e.preventDefault();
      var offset = (nav ? nav.offsetHeight : 0) + 16;
      var top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });

  } /* end document guard */

  /* ---- Exports for verification ---- */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      calcWithoutPV: calcWithoutPV,
      calcWithPV: calcWithPV,
      calcYearlyWithPV: calcYearlyWithPV,
      calcAnnuityMonthly: calcAnnuityMonthly,
      calcFinancing: calcFinancing,
      ANLAGENPREIS: ANLAGENPREIS,
      YEARS: YEARS,
      INTEREST_RATE: INTEREST_RATE
    };
  }

})();
