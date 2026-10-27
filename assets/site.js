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
      tooBig: {
        en: 'Your uploads are over 4 MB. Please remove them and share photos or a press kit through your Dropbox / Drive link instead.',
        es: 'Tus archivos superan 4 MB. Quítalos y comparte fotos o press kit con tu enlace de Dropbox / Drive.'
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
      const uploadBytes = [...appForm.querySelectorAll('input[type="file"]')]
        .reduce((sum, input) => sum + [...input.files].reduce((s, f) => s + f.size, 0), 0);
      if (uploadBytes > 4 * 1024 * 1024) {
        showError(L('tooBig'));
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

  /* Booking + creator forms: send through /api/submit and swap the form for a confirmation */
  const SIMPLE_FORMS = [
    {
      form: document.querySelector('.contact-form:not(.application-form):not(.creator-form)'),
      email: 'DEREKVINCI@EQSMUSICA.COM',
      done: { en: 'Thank you — your inquiry is in. Our team responds within 48 hours.', es: 'Gracias — recibimos tu consulta. Nuestro equipo responde en 48 horas.' }
    },
    {
      form: document.getElementById('creator-form'),
      email: 'victorsavanillabooking@gmail.com',
      done: { en: 'Thank you — your work is in. If it fits the label, we’ll reach out.', es: 'Gracias — recibimos tu trabajo. Si encaja con el sello, te contactaremos.' }
    }
  ];
  SIMPLE_FORMS.forEach(({ form, email, done }) => {
    if (!form) return;
    const errorBox = form.querySelector('.contact-form__error');
    const button = form.querySelector('.form-submit');
    const lang = () => (currentLang === 'es' ? 'es' : 'en');
    const FAIL = {
      en: `Your message hasn’t been sent. Please try again, or email ${email}.`,
      es: `Tu mensaje no se envió. Intenta de nuevo o escribe a ${email}.`
    };
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (errorBox) errorBox.hidden = true;
      if (button) {
        button.disabled = true;
        button.textContent = lang() === 'es' ? 'Enviando…' : 'Sending…';
      }
      fetch(form.getAttribute('action'), {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      })
        .then((res) => {
          if (!res.ok) throw new Error('send failed');
          const note = document.createElement('p');
          note.className = 'application-success';
          note.setAttribute('role', 'status');
          note.setAttribute('tabindex', '-1');
          note.textContent = done[lang()];
          form.replaceWith(note);
          note.focus({ preventScroll: true });
        })
        .catch(() => {
          if (errorBox) {
            errorBox.textContent = FAIL[lang()];
            errorBox.hidden = false;
          }
          if (button) {
            button.disabled = false;
            button.textContent = button.getAttribute(lang() === 'es' ? 'data-es' : 'data-en');
          }
        });
    });
  });

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
