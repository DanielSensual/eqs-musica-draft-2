(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Hero banner video */
  const heroVideo = document.querySelector('.hero__video');
  if (heroVideo) {
    if (REDUCED) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    } else {
      heroVideo.play().catch(() => {});
    }
  }

  /* Scroll reveal */
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach((el) => revealObs.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('visible'));
  }

  /* Mobile drawer */
  const hamburger = document.querySelector('.hamburger');
  const drawer = document.querySelector('.mobile-drawer');
  const drawerLinks = drawer ? drawer.querySelectorAll('a') : [];
  const focusableSel =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  function trapFocus(container) {
    const nodes = [...container.querySelectorAll(focusableSel)].filter(
      (n) => n.offsetParent !== null || n === document.activeElement
    );
    if (!nodes.length) return () => {};
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    function onKey(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    container.addEventListener('keydown', onKey);
    first.focus();
    return () => container.removeEventListener('keydown', onKey);
  }

  let releaseTrap = null;

  function setDrawerOpen(open) {
    if (!drawer || !hamburger) return;
    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('drawer-open', open);
    if (open) {
      releaseTrap = trapFocus(drawer);
    } else if (releaseTrap) {
      releaseTrap();
      releaseTrap = null;
      hamburger.focus();
    }
  }

  if (hamburger && drawer) {
    hamburger.addEventListener('click', () => setDrawerOpen(!drawer.classList.contains('open')));
    drawerLinks.forEach((link) => link.addEventListener('click', () => setDrawerOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawerOpen(false);
    });
  }

  /* Language toggle */
  const LANG_KEY = 'eqs-lang';
  const langBtns = document.querySelectorAll('.lang-toggle__btn[data-lang]');
  let currentLang = 'en';
  let refreshWizardLang = function () {};

  function applyLang(lang) {
    const isEs = lang === 'es';
    currentLang = isEs ? 'es' : 'en';
    document.documentElement.lang = isEs ? 'es' : 'en';
    document.body.classList.toggle('lang-es', isEs);
    document.querySelectorAll('[data-en][data-es]').forEach((el) => {
      const text = isEs ? el.getAttribute('data-es') : el.getAttribute('data-en');
      if (text != null) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = text;
        } else if (el.tagName === 'OPTION') {
          el.textContent = text;
        } else {
          el.innerHTML = text;
        }
      }
    });
    langBtns.forEach((btn) => {
      const active = btn.getAttribute('data-lang') === lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch (_) {}
    refreshWizardLang();
  }

  langBtns.forEach((btn) => {
    btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang')));
  });

  const savedLang = (() => {
    try {
      return localStorage.getItem(LANG_KEY);
    } catch (_) {
      return null;
    }
  })();
  if (savedLang === 'es' || savedLang === 'en') applyLang(savedLang);

  /* Mini player */
  const miniPlayer = document.querySelector('.mini-player');
  const spotifySection = document.getElementById('spotify-section');
  const miniClose = document.querySelector('.mini-player__close');

  if (miniPlayer && spotifySection && 'IntersectionObserver' in window) {
    let dismissed = false;
    const playerObs = new IntersectionObserver(
      ([entry]) => {
        if (dismissed) return;
        if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
          miniPlayer.classList.add('active');
        }
      },
      { threshold: 0, rootMargin: '0px' }
    );
    playerObs.observe(spotifySection);
    if (miniClose) {
      miniClose.addEventListener('click', () => {
        dismissed = true;
        miniPlayer.classList.remove('active');
      });
    }
  } else if (miniClose && miniPlayer) {
    miniClose.addEventListener('click', () => miniPlayer.classList.remove('active'));
  }

  /* Smooth scroll */
  if (!REDUCED) {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener('click', (e) => {
        const id = anchor.getAttribute('href');
        if (!id || id === '#') return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (drawer && drawer.classList.contains('open')) setDrawerOpen(false);
      });
    });
  }

  /* Artist application wizard + AJAX submit */
  const appForm = document.querySelector('.application-form');
  if (appForm) {
    const steps = [...appForm.querySelectorAll('.wizard-step')];
    const track = appForm.querySelector('.wizard-progress__track');
    const label = appForm.querySelector('.wizard-progress__label');
    const backBtn = appForm.querySelector('.wizard-btn--back');
    const nextBtn = appForm.querySelector('.wizard-btn--next');
    const submitBtn = appForm.querySelector('.wizard-btn--submit');
    const errorBox = appForm.querySelector('.application-error');
    const genreError = appForm.querySelector('.genre-error');
    const successCard = document.querySelector('.application-success');
    let show = function () {};

    const I18N = {
      step: { en: 'Step', es: 'Paso' },
      of: { en: 'of', es: 'de' },
      sending: { en: 'Sending…', es: 'Enviando…' },
      noEndpoint: {
        en: 'The application form isn’t connected yet. Please email halvarez@eqsmusica.com in the meantime.',
        es: 'El formulario aún no está conectado. Por favor escribe a halvarez@eqsmusica.com mientras tanto.'
      },
      netErr: {
        en: 'Network error. Please check your connection and try again.',
        es: 'Error de red. Revisa tu conexión e intenta de nuevo.'
      },
      srvErr: {
        en: 'Something went wrong. Please try again.',
        es: 'Algo salió mal. Por favor intenta de nuevo.'
      }
    };
    const L = (key) => I18N[key][currentLang === 'es' ? 'es' : 'en'];

    function showError(msg) {
      if (!errorBox) return;
      errorBox.textContent = msg;
      errorBox.hidden = false;
    }
    function hideError() {
      if (errorBox) errorBox.hidden = true;
    }

    /* Live word counters (soft cap) */
    appForm.querySelectorAll('textarea[data-word-max]').forEach((ta) => {
      const group = ta.closest('.form-group');
      const out = group && group.querySelector('.word-counter__count');
      const wrap = group && group.querySelector('.word-counter');
      const max = parseInt(ta.getAttribute('data-word-max'), 10) || 500;
      const update = () => {
        const trimmed = ta.value.trim();
        const words = trimmed ? trimmed.split(/\s+/).length : 0;
        if (out) out.textContent = String(words);
        if (wrap) wrap.classList.toggle('is-over', words > max);
      };
      ta.addEventListener('input', update);
      update();
    });

    if (steps.length) {
      appForm.classList.add('js-wizard');
      const total = steps.length;
      let idx = 0;

      /* Build progress ticks */
      if (track) {
        steps.forEach(() => {
          const tick = document.createElement('span');
          tick.className = 'wizard-progress__tick';
          track.appendChild(tick);
        });
      }
      const ticks = track ? [...track.children] : [];

      function refreshLabel() {
        if (label) {
          const nameEl = steps[idx].querySelector('.wizard-step__name');
          const name = nameEl ? nameEl.textContent.trim() : '';
          label.textContent = L('step') + ' ' + (idx + 1) + ' ' + L('of') + ' ' + total + ' — ' + name;
        }
        ticks.forEach((t, i) => {
          t.classList.toggle('is-current', i === idx);
          t.classList.toggle('is-done', i < idx);
        });
      }

      show = function (i, doFocus) {
        idx = Math.max(0, Math.min(total - 1, i));
        steps.forEach((s, n) => s.classList.toggle('is-active', n === idx));
        if (backBtn) backBtn.hidden = idx === 0;
        const last = idx === total - 1;
        if (nextBtn) nextBtn.hidden = last;
        if (submitBtn) submitBtn.hidden = !last;
        refreshLabel();
        hideError();
        if (doFocus) {
          const top = appForm.getBoundingClientRect().top + window.pageYOffset - 90;
          window.scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
          const heading = steps[idx].querySelector('.wizard-step__name');
          if (heading) heading.focus({ preventScroll: true });
        }
      };

      function genreOk(stepEl) {
        const genres = stepEl.querySelectorAll('input[name="genre"]');
        if (!genres.length) return true;
        const any = [...genres].some((c) => c.checked);
        if (genreError) genreError.hidden = any;
        if (!any) genres[0].focus();
        return any;
      }

      function validateStep() {
        const cur = steps[idx];
        if (!genreOk(cur)) return false;
        const fields = [...cur.querySelectorAll('input, select, textarea')];
        for (const f of fields) {
          if (!f.checkValidity()) {
            f.reportValidity();
            f.focus({ preventScroll: true });
            return false;
          }
        }
        return true;
      }

      if (nextBtn) nextBtn.addEventListener('click', () => { if (validateStep()) show(idx + 1, true); });
      if (backBtn) backBtn.addEventListener('click', () => show(idx - 1, true));

      refreshWizardLang = refreshLabel;
      show(0, false);
    }

    /* AJAX submit */
    appForm.addEventListener('submit', (e) => {
      e.preventDefault();
      hideError();

      /* Validate the whole form; jump to the first step with a problem */
      for (let i = 0; i < steps.length; i++) {
        const genres = steps[i].querySelectorAll('input[name="genre"]');
        if (genres.length && ![...genres].some((c) => c.checked)) {
          if (steps.length) show(i, true);
          if (genreError) genreError.hidden = false;
          return;
        }
        const bad = steps[i].querySelector(':invalid');
        if (bad) {
          if (steps.length) show(i, true);
          window.setTimeout(() => { bad.reportValidity(); bad.focus({ preventScroll: true }); }, REDUCED ? 0 : 320);
          return;
        }
      }
      if (!appForm.checkValidity()) { appForm.reportValidity(); return; }

      const action = appForm.getAttribute('action') || '';
      if (!action || action.indexOf('YOUR_ARTIST_FORM_ID') !== -1) {
        showError(L('noEndpoint'));
        return;
      }

      const restore = submitBtn
        ? submitBtn.getAttribute(currentLang === 'es' ? 'data-es' : 'data-en')
        : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = L('sending');
      }

      fetch(action, {
        method: 'POST',
        body: new FormData(appForm),
        headers: { Accept: 'application/json' }
      })
        .then((res) => {
          if (res.ok) {
            appForm.hidden = true;
            if (successCard) {
              successCard.hidden = false;
              successCard.setAttribute('tabindex', '-1');
              const top = successCard.getBoundingClientRect().top + window.pageYOffset - 90;
              window.scrollTo({ top, behavior: REDUCED ? 'auto' : 'smooth' });
              successCard.focus({ preventScroll: true });
            }
            return;
          }
          return res
            .json()
            .then((d) => {
              const msg = d && d.errors && d.errors.length
                ? d.errors.map((x) => x.message).join(', ')
                : L('srvErr');
              throw new Error(msg);
            });
        })
        .catch((err) => {
          showError(err && err.message ? err.message : L('netErr'));
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = restore;
          }
        });
    });
  }

  /* Booking form: block submits while the Formspree endpoint is a placeholder */
  const bookingForm = document.querySelector('.contact-form:not(.application-form):not(.creator-form)');
  if (bookingForm) {
    const bookingError = bookingForm.querySelector('.contact-form__error');
    const BOOKING_MSG = {
      en: 'The booking form isn’t connected yet. Please email DEREKVINCI@EQSMUSICA.COM in the meantime.',
      es: 'El formulario de reservas aún no está conectado. Por favor escribe a DEREKVINCI@EQSMUSICA.COM mientras tanto.'
    };
    bookingForm.addEventListener('submit', (e) => {
      const action = bookingForm.getAttribute('action') || '';
      if (!action || action.indexOf('YOUR_FORM_ID') !== -1) {
        e.preventDefault();
        if (bookingError) {
          bookingError.textContent = BOOKING_MSG[currentLang === 'es' ? 'es' : 'en'];
          bookingError.hidden = false;
        }
      }
    });
  }

  /* Creator form: block submits while the Formspree endpoint is a placeholder */
  const creatorForm = document.getElementById('creator-form');
  if (creatorForm) {
    const creatorError = creatorForm.querySelector('.contact-form__error');
    const CREATOR_MSG = {
      en: 'The creator form isn\u2019t connected yet. Please email victorsavanillabooking@gmail.com in the meantime.',
      es: 'El formulario de creadores a\u00fan no est\u00e1 conectado. Por favor escribe a victorsavanillabooking@gmail.com mientras tanto.'
    };
    creatorForm.addEventListener('submit', (e) => {
      const action = creatorForm.getAttribute('action') || '';
      if (!action || action.indexOf('YOUR_CREATOR_FORM_ID') !== -1) {
        e.preventDefault();
        if (creatorError) {
          creatorError.textContent = CREATOR_MSG[currentLang === 'es' ? 'es' : 'en'];
          creatorError.hidden = false;
        }
      }
    });
  }

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
