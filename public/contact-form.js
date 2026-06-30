(function () {
  'use strict';

  var GOOGLE_ADS_CONVERSION_SEND_TO = 'AW-328006841/';

  function trackGoogleAdsConversion() {
    if (typeof gtag !== 'function') return;
    var sendTo = GOOGLE_ADS_CONVERSION_SEND_TO;
    if (!sendTo || sendTo.length <= 'AW-328006841/'.length) return;
    gtag('event', 'conversion', { send_to: sendTo });
  }

  function initContactForm() {
    var contactForm = document.getElementById('contactForm');
    if (!contactForm || contactForm.dataset.bound === 'true') return;
    contactForm.dataset.bound = 'true';

    var formFeedback = document.getElementById('formFeedback');
    if (!formFeedback) {
      formFeedback = document.createElement('p');
      formFeedback.className = 'contact-form__note';
      formFeedback.id = 'formFeedback';
      formFeedback.setAttribute('role', 'status');
      formFeedback.hidden = true;
      var submitBtn = contactForm.querySelector('button[type="submit"]');
      if (submitBtn) {
        contactForm.insertBefore(formFeedback, submitBtn);
      } else {
        contactForm.appendChild(formFeedback);
      }
    }

    function showFormFeedback(message, isError) {
      formFeedback.textContent = message;
      formFeedback.hidden = false;
      formFeedback.setAttribute('role', isError ? 'alert' : 'status');
    }

    function clearFormFeedback() {
      formFeedback.textContent = '';
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
        showFormFeedback('Bitte fülle Vorname, Nachname und E-Mail aus.', true);
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormFeedback('Bitte gib eine gültige E-Mail-Adresse ein.', true);
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
            showFormFeedback('Vielen Dank! Wir melden uns schnellstmöglich bei dir.', false);
            trackGoogleAdsConversion();
          } else {
            showFormFeedback(
              result.data.error || 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es später erneut.',
              true,
            );
          }
        })
        .catch(function () {
          showFormFeedback(
            'Die Anfrage konnte nicht gesendet werden. Bitte prüfe deine Internetverbindung und versuche es erneut.',
            true,
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
