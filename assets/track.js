/* Visit tracking for the /admin/ dashboard. No cookies: ids live in localStorage/sessionStorage. Never blocks the page. */
(() => {
  const ENDPOINT = '/api/track/';
  const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'gclid', 'fbclid'];
  const path = location.pathname;

  function id(storage, key) {
    try {
      let value = storage.getItem(key);
      if (!value) {
        value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        storage.setItem(key, value);
      }
      return value;
    } catch {
      return 'no-storage';
    }
  }

  function send(eventName, properties = {}) {
    try {
      const body = JSON.stringify({
        eventName,
        path,
        referrer: document.referrer,
        title: document.title,
        visitorId: id(localStorage, 'eqs_vid'),
        sessionId: id(sessionStorage, 'eqs_sid'),
        properties,
      });
      // text/plain keeps the beacon a simple request in every browser; the endpoint parses the body either way.
      if (navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }))) return;
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: true }).catch(() => {});
    } catch {}
  }

  function siteLang() {
    try {
      return localStorage.getItem('eqs-lang') === 'es' ? 'es' : 'en';
    } catch {
      return 'en';
    }
  }

  const params = new URLSearchParams(location.search);
  const campaign = {};
  UTM_KEYS.forEach((k) => {
    const v = params.get(k);
    if (v) campaign[k] = v.slice(0, 200);
  });
  if (campaign.fbclid && !campaign.utm_source) campaign.utm_source = 'facebook';
  if (campaign.gclid && !campaign.utm_source) campaign.utm_source = 'google';

  const ua = navigator.userAgent;
  const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  send('page_view', {
    ...campaign,
    device_type: tablet ? 'tablet' : /Mobi|Android|iPhone|iPod/i.test(ua) ? 'mobile' : 'desktop',
    viewport_width: window.innerWidth,
    language: navigator.language || 'unknown',
    site_lang: siteLang(),
  });

  const reached = new Set();
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const pct = Math.round((scrollY / Math.max(document.documentElement.scrollHeight - innerHeight, 1)) * 100);
      [25, 50, 75, 90].forEach((m) => {
        if (pct >= m && !reached.has(m)) {
          reached.add(m);
          send('scroll_depth', { depth_percent: m });
        }
      });
      ticking = false;
    });
  }, { passive: true });

  const started = Date.now();
  let reported = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden' || reported) return;
    const seconds = Math.round((Date.now() - started) / 1000);
    if (seconds < 3) return;
    reported = true;
    send('engagement_time', { seconds, bounced: seconds < 10 && reached.size === 0 });
  });

  const DESTINATIONS = [
    [/spotify\.com/, 'spotify'],
    [/(youtube\.com|youtu\.be)/, 'youtube'],
    [/instagram\.com/, 'instagram'],
    [/(facebook\.com|fb\.com)/, 'facebook'],
    [/tiktok\.com/, 'tiktok'],
    [/music\.apple\.com/, 'apple_music'],
    [/(wa\.me|whatsapp\.com)/, 'whatsapp'],
  ];

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const card = target.closest('.artist-card');
    const name = card && card.querySelector('.artist-card__name');
    if (name) send('artist_click', { artist: name.textContent.trim().slice(0, 80) });

    const lang = target.closest('.lang-toggle__btn[data-lang]');
    if (lang) send('language_switch', { to: lang.getAttribute('data-lang') });

    const link = target.closest('a[href]');
    if (!link) return;
    let url;
    try {
      url = new URL(link.href, location.href);
    } catch {
      return;
    }
    let destination = null;
    if (url.protocol === 'mailto:') destination = 'email';
    else if (url.protocol === 'tel:') destination = 'phone';
    else if (url.origin !== location.origin) {
      destination = (DESTINATIONS.find(([re]) => re.test(url.hostname)) || [null, 'other'])[1];
    }
    if (destination) {
      send('outbound_click', { destination, href: link.href.slice(0, 300), label: (link.textContent || '').trim().slice(0, 80) });
    }
  }, { capture: true });

  document.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    const kind = form && form.querySelector('input[name="form"]');
    if (kind) send('form_submit', { form: kind.value });
  }, { capture: true });
})();
