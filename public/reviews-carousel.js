(function () {
  'use strict';

  function initReviewsCarousel() {
    var carousel = document.getElementById('reviewsCarousel');
    var viewport = document.getElementById('reviewsViewport');
    var track = document.getElementById('reviewsTrack');
    var dotsContainer = document.getElementById('reviewsDots');
    var prevBtn = document.getElementById('reviewsPrev');
    var nextBtn = document.getElementById('reviewsNext');

    if (!carousel || !viewport || !track || !dotsContainer) return;

    var cards = track.querySelectorAll('.review-card');
    if (!cards.length) return;

    var page = 0;
    var perView = 1;
    var totalPages = 1;
    var autoplayMs = 5200;
    var autoplayTimer = null;
    var resizeTimer = null;
    var touchStartX = 0;
    var touchDeltaX = 0;

    function getPerView() {
      if (window.innerWidth >= 1024) return 3;
      if (window.innerWidth >= 640) return 2;
      return 1;
    }

    function getGap() {
      return window.innerWidth >= 1024 ? 24 : window.innerWidth >= 640 ? 21.6 : 20;
    }

    function buildDots() {
      dotsContainer.innerHTML = '';
      for (var i = 0; i < totalPages; i++) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'reviews-carousel__dot' + (i === page ? ' is-active' : '');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Bewertungsgruppe ' + (i + 1));
        dot.setAttribute('aria-selected', i === page ? 'true' : 'false');
        dot.dataset.page = String(i);
        dot.addEventListener('click', function () {
          goToPage(parseInt(this.dataset.page, 10));
          restartAutoplay();
        });
        dotsContainer.appendChild(dot);
      }
    }

    function updateActiveCards() {
      var start = page * perView;
      var end = start + perView;
      cards.forEach(function (card, index) {
        if (index >= start && index < end) {
          card.classList.add('is-active');
        } else {
          card.classList.remove('is-active');
        }
      });
    }

    function applyLayout() {
      perView = getPerView();
      totalPages = Math.max(1, Math.ceil(cards.length / perView));
      if (page >= totalPages) page = 0;

      var gap = getGap();
      var viewportWidth = viewport.offsetWidth;
      var cardWidth = (viewportWidth - gap * (perView - 1)) / perView;

      cards.forEach(function (card) {
        card.style.width = cardWidth + 'px';
      });

      var offset = page * perView * (cardWidth + gap);
      track.style.transform = 'translate3d(-' + offset + 'px, 0, 0)';

      buildDots();
      updateActiveCards();
    }

    function goToPage(nextPage) {
      page = (nextPage + totalPages) % totalPages;
      applyLayout();
    }

    function nextPage() {
      goToPage(page + 1);
    }

    function prevPage() {
      goToPage(page - 1);
    }

    function startAutoplay() {
      stopAutoplay();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      autoplayTimer = window.setInterval(nextPage, autoplayMs);
    }

    function stopAutoplay() {
      if (autoplayTimer) {
        window.clearInterval(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function restartAutoplay() {
      stopAutoplay();
      startAutoplay();
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        prevPage();
        restartAutoplay();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        nextPage();
        restartAutoplay();
      });
    }

    carousel.addEventListener('mouseenter', stopAutoplay);
    carousel.addEventListener('mouseleave', startAutoplay);
    carousel.addEventListener('focusin', stopAutoplay);
    carousel.addEventListener('focusout', startAutoplay);

    viewport.addEventListener('touchstart', function (e) {
      touchStartX = e.changedTouches[0].clientX;
      touchDeltaX = 0;
      track.classList.add('is-dragging');
      stopAutoplay();
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
      touchDeltaX = e.changedTouches[0].clientX - touchStartX;
    }, { passive: true });

    viewport.addEventListener('touchend', function () {
      track.classList.remove('is-dragging');
      if (Math.abs(touchDeltaX) > 50) {
        if (touchDeltaX < 0) nextPage();
        else prevPage();
      } else {
        applyLayout();
      }
      restartAutoplay();
    });

    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(applyLayout, 120);
    });

    applyLayout();
    startAutoplay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReviewsCarousel);
  } else {
    initReviewsCarousel();
  }
})();
