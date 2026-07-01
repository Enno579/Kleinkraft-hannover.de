(function () {
  'use strict';

  var GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-328006841/0NTKCJzv5cgCENs5s5wB';
  var conversionFired = false;

  var SUCCESS_MESSAGE_HTML =
    '<div class="contact-form__feedback-icon" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 6L9 17l-5-5"/>' +
    '</svg></div>' +
    '<div class="contact-form__feedback-body">' +
    '<p class="contact-form__feedback-lead">Vielen herzlichen Dank für Ihre Kontaktaufnahme.</p>' +
    '<p class="contact-form__feedback-sub">Enno Scharf wird sich direkt persönlich innerhalb der nächsten 24 Stunden bei Ihnen melden.</p>' +
    '</div>';

  function trackGoogleAdsConversion() {
    if (conversionFired) return;
    if (typeof gtag !== 'function') return;
    conversionFired = true;
    gtag('event', 'conversion', {
      send_to: GOOGLE_ADS_CONVERSION_SEND_TO,
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

      var vorname = getField('vorname');
      var nachname = getField('nachname');
      var email = getField('email');

      if (!vorname || !nachname || !email) {
        showErrorFeedback('Bitte fülle Vorname, Nachname und E-Mail aus.');
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showErrorFeedback('Bitte gib eine gültige E-Mail-Adresse ein.');
        return;
      }

      var btn = contactForm.querySelector('button[type="submit"]');
      var originalText = btn ? btn.textContent : '';
      if (btn) {
        btn.textContent = 'Wird gesendet…';
        btn.disabled = true;
      }

      var formData = {
        vorname: vorname,
        nachname: nachname,
        email: email,
        telefon: getField('telefon'),
        jahresverbrauch: getField('jahresverbrauch'),
        wohnsituation: getField('wohnsituation'),
        montageort: getField('montageort'),
        finanzierung_interesse: getField('finanzierung_interesse'),
        nachricht: getField('nachricht'),
      };

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
            contactForm.reset();
            showSuccessFeedback();
            trackGoogleAdsConversion();
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initContactForm);
  } else {
    initContactForm();
  }
})();
