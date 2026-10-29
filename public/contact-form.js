(function () {
  'use strict';

  var GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-328006841/0NTKCJzv5cgCENs5s5wB';
  var conversionFired = false;
  var ALLOWED_PRODUCT_LINES = {
    anker_dachanlage: 'Anker-Dachanlage',
    klassische_photovoltaik: 'Klassische Photovoltaik',
  };

  var SUCCESS_MESSAGE_HTML =
    '<div class="contact-form__feedback-icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 6L9 17l-5-5"/>' +
    '</svg></div>' +
    '<div class="contact-form__feedback-body">' +
    '<p class="contact-form__feedback-lead">Vielen herzlichen Dank für Ihre Kontaktaufnahme.</p>' +
    '<p class="contact-form__feedback-sub">Enno Scharf wird sich direkt persönlich innerhalb der nächsten 24 Stunden bei Ihnen melden.</p>' +
    '</div>';

  function isValidPhone(raw) {
    var s = String(raw || '').trim();
    if (!s || s.length > 40) return false;
    if (!/^[+0-9()/\.\-\s]+$/.test(s)) return false;
    var digits = s.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }

  function allowedProductLine(value) {
    var v = String(value || '').trim();
    return Object.prototype.hasOwnProperty.call(ALLOWED_PRODUCT_LINES, v) ? v : '';
  }

  window.KleinkraftContact = {
    isValidPhone: isValidPhone,
    allowedProductLine: allowedProductLine,
  };

  function consentChoice() {
    var consent =
      window.KleinkraftConsent && typeof window.KleinkraftConsent.get === 'function'
        ? window.KleinkraftConsent.get()
        : null;
    return {
      analytics: !!(consent && consent.analytics),
      marketing: !!(consent && consent.marketing),
    };
  }

  function attributionSnapshot(marketingGranted) {
    if (!marketingGranted) return null;
    if (!window.KleinkraftAttribution || typeof window.KleinkraftAttribution.get !== 'function') {
      return null;
    }
    return window.KleinkraftAttribution.get() || null;
  }

  function engagementSnapshot(analyticsGranted) {
    if (!analyticsGranted) return null;
    if (!window.KleinkraftEngagement || typeof window.KleinkraftEngagement.getSnapshot !== 'function') {
      return null;
    }
    return window.KleinkraftEngagement.getSnapshot() || null;
  }

  function hasAnalyticsConsent() {
    return consentChoice().analytics;
  }

  function pushGenerateLead(leadId) {
    if (!hasAnalyticsConsent()) return;
    window.dataLayer = window.dataLayer || [];
    var payload = {
      event: 'generate_lead',
      lead_event_source: 'contact_form',
    };
    if (leadId) payload.lead_id = leadId;
    window.dataLayer.push(payload);
  }

  function trackGoogleAdsConversion() {
    if (conversionFired) return;
    conversionFired = true;

    var tracking = window.KLEINKRAFT_TRACKING || {};
    if (tracking.migrateAdsConversionToGtm) {
      return;
    }

    if (typeof gtag !== 'function') return;
    gtag('event', 'conversion', {
      send_to: tracking.adsConversionSendTo || GOOGLE_ADS_CONVERSION_SEND_TO,
      value: 1.0,
      currency: 'EUR',
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initContactForm() {
    var contactForm = document.getElementById('contactForm');
    if (!contactForm || contactForm.dataset.bound === 'true') return;
    contactForm.dataset.bound = 'true';

    var submitBtn = contactForm.querySelector('button[type="submit"]');
    var formFeedback = document.getElementById('formFeedback');

    if (!formFeedback) {
      formFeedback = document.createElement('div');
      formFeedback.id = 'formFeedback';
      formFeedback.className = 'contact-form__feedback';
      formFeedback.setAttribute('role', 'status');
      formFeedback.hidden = true;

      if (submitBtn && submitBtn.nextSibling) {
        contactForm.insertBefore(formFeedback, submitBtn.nextSibling);
      } else if (submitBtn) {
        submitBtn.insertAdjacentElement('afterend', formFeedback);
      } else {
        contactForm.appendChild(formFeedback);
      }
    }

    function fieldWrap(el) {
      if (!el) return null;
      var node = el.parentNode;
      while (node && node !== contactForm) {
        if (node.className && String(node.className).indexOf('field') !== -1) return node;
        node = node.parentNode;
      }
      return el.parentNode;
    }

    function setFieldError(name, message) {
      var field = contactForm.querySelector('[name="' + name + '"]');
      var wrap = fieldWrap(field);
      if (!field || !wrap) return;
      wrap.classList.add('field--error');
      field.setAttribute('aria-invalid', 'true');
      var errId = name + '-error';
      var err = document.getElementById(errId);
      if (!err) {
        err = document.createElement('p');
        err.id = errId;
        err.className = 'field__error';
        wrap.appendChild(err);
      }
      err.textContent = message;
      field.setAttribute('aria-describedby', errId);
    }

    function clearFieldErrors() {
      var wraps = contactForm.querySelectorAll('.field--error');
      for (var i = 0; i < wraps.length; i++) {
        wraps[i].classList.remove('field--error');
      }
      var errs = contactForm.querySelectorAll('.field__error');
      for (var j = 0; j < errs.length; j++) {
        errs[j].textContent = '';
      }
      var invalids = contactForm.querySelectorAll('[aria-invalid="true"]');
      for (var k = 0; k < invalids.length; k++) {
        invalids[k].removeAttribute('aria-invalid');
      }
    }

    function revealFeedback() {
      formFeedback.hidden = false;
      formFeedback.classList.remove('is-visible');
      window.requestAnimationFrame(function () {
        formFeedback.classList.add('is-visible');
      });
    }

    function showSuccessFeedback() {
      formFeedback.className = 'contact-form__feedback contact-form__feedback--success';
      formFeedback.innerHTML = SUCCESS_MESSAGE_HTML;
      formFeedback.setAttribute('role', 'status');
      revealFeedback();
    }

    function showErrorFeedback(message) {
      formFeedback.className = 'contact-form__feedback contact-form__feedback--error';
      formFeedback.innerHTML =
        '<p class="contact-form__feedback-error-text">' + escapeHtml(message) + '</p>';
      formFeedback.setAttribute('role', 'alert');
      revealFeedback();
    }

    function clearFormFeedback() {
      formFeedback.innerHTML = '';
      formFeedback.className = 'contact-form__feedback';
      formFeedback.classList.remove('is-visible');
      formFeedback.hidden = true;
      formFeedback.setAttribute('role', 'status');
    }

    function getField(name) {
      var field = contactForm.querySelector('[name="' + name + '"]');
      return field ? String(field.value || '').trim() : '';
    }

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();
      clearFormFeedback();
      clearFieldErrors();

      var vorname = getField('vorname');
      var nachname = getField('nachname');
      var email = getField('email');
      var telefon = getField('telefon');
      var productLine = allowedProductLine(
        getField('product_line') || contactForm.getAttribute('data-product-line') || '',
      );

      var hasError = false;
      if (!vorname) {
        setFieldError('vorname', 'Bitte Vorname angeben.');
        hasError = true;
      }
      if (!nachname) {
        setFieldError('nachname', 'Bitte Nachname angeben.');
        hasError = true;
      }
      if (!email) {
        setFieldError('email', 'Bitte E-Mail angeben.');
        hasError = true;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setFieldError('email', 'Bitte eine gültige E-Mail-Adresse eingeben.');
        hasError = true;
      }
      if (!telefon) {
        setFieldError(
          'telefon',
          'Telefon ist Pflicht. Bitte eine erreichbare Nummer angeben (z. B. +49 156 78444101).',
        );
        hasError = true;
      } else if (!isValidPhone(telefon)) {
        setFieldError(
          'telefon',
          'Bitte eine gültige Telefonnummer angeben (8–15 Ziffern, international möglich).',
        );
        hasError = true;
      }
      if (!productLine) {
        setFieldError(
          'product_line',
          'Bitte wählen, welches Anliegen Sie betrifft: Anker SOLIX auf dem Hausdach oder Photovoltaik mit Speicher.',
        );
        hasError = true;
      }

      if (hasError) {
        showErrorFeedback('Bitte die markierten Pflichtfelder prüfen – Telefon und Angebotslinie sind erforderlich.');
        var firstErr = contactForm.querySelector('.field--error input, .field--error select');
        if (firstErr && typeof firstErr.focus === 'function') firstErr.focus();
        return;
      }

      var btn = contactForm.querySelector('button[type="submit"]');
      var originalText = btn ? btn.textContent : '';
      if (btn) {
        btn.textContent = 'Wird gesendet…';
        btn.disabled = true;
      }

      var choice = consentChoice();
      var formData = {
        vorname: vorname,
        nachname: nachname,
        email: email,
        telefon: telefon,
        jahresverbrauch: getField('jahresverbrauch'),
        wohnsituation: getField('wohnsituation'),
        montageort: getField('montageort'),
        finanzierung_interesse: getField('finanzierung_interesse'),
        nachricht: getField('nachricht'),
        product_line: productLine,
        landing_page: (window.location && window.location.pathname) || '/',
        marketing_consent: choice.marketing,
        analytics_consent: choice.analytics,
      };
      if (choice.marketing) {
        var attr = attributionSnapshot(true);
        if (attr) formData.attribution = attr;
      }
      if (choice.analytics) {
        var eng = engagementSnapshot(true);
        if (eng) formData.engagement = eng;
      }

      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            pushGenerateLead(result.data.lead_id);
            trackGoogleAdsConversion();
            contactForm.reset();
            if (contactForm.getAttribute('data-product-line')) {
              var hidden = contactForm.querySelector('[name="product_line"]');
              if (hidden) hidden.value = contactForm.getAttribute('data-product-line');
            }
            showSuccessFeedback();
          } else {
            showErrorFeedback(
              result.data.error || 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.',
            );
          }
        })
        .catch(function () {
          showErrorFeedback(
            'Die Anfrage konnte nicht gesendet werden. Bitte prüfe deine Internetverbindung und versuche es erneut.',
          );
        })
        .finally(function () {
          if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
          }
        });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initContactForm);
    } else {
      initContactForm();
    }
  }
})();
