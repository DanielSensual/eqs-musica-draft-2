/* EQS Admin: PIN sign-in, analytics overview and the leads list. Everything visitor-supplied is set as text, never HTML. */
(() => {
  const $ = (id) => document.getElementById(id);
  const TZ = 'America/New_York';
  const nf = new Intl.NumberFormat('en-US');

  const PAGE_NAMES = {
    '/': 'Home',
    '/artists/': 'Artists',
    '/booking/': 'Booking',
    '/about/': 'About',
    '/creators/': 'Creator Program',
    '/apply/': 'Artist application',
    '/derekvinci/': 'DerekVinci',
    '/newsletter/': 'Newsletter',
  };
  const DESTINATIONS = {
    spotify: 'Spotify', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok',
    apple_music: 'Apple Music', whatsapp: 'WhatsApp', email: 'Email', phone: 'Phone call', other: 'Other sites',
  };
  const FORM_NAMES = { booking: 'Booking', artist: 'Artist', creator: 'Creator' };
  const DEVICE_NAMES = { mobile: 'Phone', desktop: 'Computer', tablet: 'Tablet', unknown: 'Unknown' };
  const LANG_NAMES = { en: 'English', es: 'Español' };

  /** Tiny element builder: h('div', { class: 'x' }, 'text', child). Strings become text nodes. */
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/session/') showLogin();
    if (!res.ok) throw Object.assign(new Error(body.error || 'Something went wrong.'), { status: res.status });
    return body;
  }

  /* ---------- Sign-in ---------- */

  function showLogin() {
    $('app').hidden = true;
    $('login').hidden = false;
    setTimeout(() => $('pin').focus(), 50);
  }

  function showApp(user) {
    $('login').hidden = true;
    $('app').hidden = false;
    $('who').textContent = `Hi, ${user.name}`;
    loadStats();
    loadLeads();
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const pin = $('pin').value.trim();
    $('login-error').textContent = '';
    if (!/^\d{6}$/.test(pin)) {
      $('login-error').textContent = 'The PIN is 6 digits.';
      return;
    }
    $('login-button').disabled = true;
    try {
      const { user } = await api('/api/admin/session/', { method: 'POST', body: JSON.stringify({ pin }) });
      $('pin').value = '';
      showApp(user);
    } catch (error) {
      $('login-error').textContent = error.message;
      $('pin').value = '';
      $('pin').focus();
    } finally {
      $('login-button').disabled = false;
    }
  });

  $('pin').addEventListener('input', () => {
    $('pin').value = $('pin').value.replace(/\D/g, '').slice(0, 6);
    if ($('pin').value.length === 6) $('login-form').requestSubmit();
  });

  $('logout').addEventListener('click', async () => {
    await api('/api/admin/session/', { method: 'DELETE' }).catch(() => {});
    showLogin();
  });

  /* ---------- Tabs ---------- */

  document.querySelectorAll('[data-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('is-active', t === tab));
      $('overview').hidden = tab.dataset.tab !== 'overview';
      $('leads').hidden = tab.dataset.tab !== 'leads';
      if (tab.dataset.tab === 'overview') window.dispatchEvent(new Event('resize'));
    });
  });

  function chipGroup(attr, onPick) {
    const chips = document.querySelectorAll(`[${attr}]`);
    chips.forEach((chip) => chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.toggle('is-active', c === chip));
      onPick(chip.getAttribute(attr));
    }));
  }

  /* ---------- Overview ---------- */

  let range = '30d';
  chipGroup('data-range', (value) => { range = value; loadStats(); });

  function duration(seconds) {
    if (!seconds) return '–';
    const m = Math.floor(seconds / 60);
    return m ? `${m}m ${String(seconds % 60).padStart(2, '0')}s` : `${seconds}s`;
  }

  function barList(el, rows, nameOf, valueOf, unit) {
    el.replaceChildren();
    const max = Math.max(1, ...rows.map(valueOf));
    if (!rows.length) {
      el.append(h('p', { class: 'empty' }, 'Nothing yet for this period.'));
      return;
    }
    for (const row of rows) {
      const value = valueOf(row);
      el.append(h('li', {},
        h('span', { class: 'bars__name' }, nameOf(row)),
        h('span', { class: 'bars__value' }, `${nf.format(value)} ${unit(value)}`),
        h('span', { class: 'bars__track' }, h('span', { class: 'bars__fill', style: `width:${Math.max(3, (value / max) * 100)}%` })),
      ));
    }
  }

  function split(el, rows, nameOf, valueOf) {
    el.replaceChildren();
    const total = rows.reduce((n, r) => n + valueOf(r), 0);
    if (!total) {
      el.append(h('p', { class: 'empty' }, 'Nothing yet for this period.'));
      return;
    }
    const sorted = [...rows].sort((a, b) => valueOf(b) - valueOf(a));
    const colors = ['var(--accent)', 'var(--palm)', 'var(--muted)'];
    el.append(
      h('div', { class: 'split__bar' }, sorted.slice(0, 3).map((r) => h('span', { style: `width:${(valueOf(r) / total) * 100}%` }))),
      h('ul', { class: 'split__legend' }, sorted.slice(0, 3).map((r, i) =>
        h('li', {}, h('i', { style: `background:${colors[i]}` }), `${nameOf(r)} · ${Math.round((valueOf(r) / total) * 100)}%`))),
    );
  }

  function label(at, hourly) {
    const d = new Date(`${at}${hourly ? '' : 'T12:00'}`);
    return hourly
      ? d.toLocaleTimeString('en-US', { hour: 'numeric' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function chart(series, hourly) {
    const el = $('chart');
    el.replaceChildren();
    // Drawn at the box's real size so the axis text keeps its shape on a phone.
    const W = Math.max(280, el.clientWidth), H = Math.max(160, el.clientHeight), padL = 34, padB = 26, padT = 10;
    const max = Math.max(4, ...series.map((p) => p.visitors));
    const step = Math.ceil(max / 4);
    const top = step * 4;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Visitors over time');
    const s = (tag, attrs) => {
      const node = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.append(node);
      return node;
    };
    const y = (v) => padT + (H - padT - padB) * (1 - v / top);
    for (let i = 0; i <= 4; i++) {
      s('line', { class: 'grid-line', x1: padL, x2: W, y1: y(i * step), y2: y(i * step) });
      s('text', { class: 'axis', x: padL - 8, y: y(i * step) + 4, 'text-anchor': 'end' }).textContent = nf.format(i * step);
    }
    const slot = (W - padL) / series.length;
    const tip = h('div', { class: 'chart__tip', hidden: true });
    const every = Math.ceil(series.length / Math.max(3, Math.floor(W / 110)));
    series.forEach((p, i) => {
      const x = padL + i * slot;
      const bh = Math.max(p.visitors ? 2 : 0, (H - padT - padB) * (p.visitors / top));
      const bar = s('rect', { class: 'bar', x: x + slot * 0.18, width: slot * 0.64, y: H - padB - bh, height: bh, rx: Math.min(4, slot * 0.2) });
      const hit = s('rect', { x, width: slot, y: padT, height: H - padT - padB, fill: 'transparent' });
      const show = () => {
        bar.classList.add('is-hot');
        tip.hidden = false;
        tip.textContent = `${label(p.at, hourly)} · ${nf.format(p.visitors)} visitors · ${nf.format(p.views)} views`;
        tip.style.left = `${((x + slot / 2) / W) * 100}%`;
        tip.style.top = `${(y(p.visitors) / H) * 100}%`;
      };
      const hide = () => { bar.classList.remove('is-hot'); tip.hidden = true; };
      hit.addEventListener('mouseenter', show);
      hit.addEventListener('mouseleave', hide);
      hit.addEventListener('touchstart', show, { passive: true });
      if (i % every === 0) s('text', { class: 'axis', x: x + slot / 2, y: H - 6, 'text-anchor': 'middle' }).textContent = label(p.at, hourly);
    });
    el.append(svg, tip);
  }

  let lastChart = null;
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => lastChart && chart(...lastChart), 150);
  });

  let statsRequest = 0;
  async function loadStats() {
    const mine = ++statsRequest;
    $('stats-error').hidden = true;
    let data;
    try {
      data = await api(`/api/admin/stats/?range=${range}`);
    } catch (error) {
      if (error.status === 401) return;
      $('stats-error').textContent = error.message;
      $('stats-error').hidden = false;
      return;
    }
    if (mine !== statsRequest) return;
    const t = data.totals;
    $('k-visitors').textContent = nf.format(t.visitors);
    const delta = $('k-delta');
    delta.className = 'kpi__delta';
    if (t.previousVisitors) {
      const pct = Math.round(((t.visitors - t.previousVisitors) / t.previousVisitors) * 100);
      delta.textContent = `${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}% vs. previous period`;
      delta.classList.add(pct >= 0 ? 'up' : 'down');
    } else {
      delta.textContent = `${nf.format(t.sessions)} visits`;
    }
    $('k-views').textContent = nf.format(t.views);
    $('k-sessions').textContent = t.visitors ? `${(t.views / Math.max(t.sessions, 1)).toFixed(1)} pages per visit` : '';
    $('k-time').textContent = duration(t.avgSeconds);
    $('k-bounce').textContent = t.avgSeconds ? `${t.bounceRate}% left within 10 seconds` : '';
    $('k-leads').textContent = nf.format(t.leads);
    $('k-leads-split').textContent = data.leadsByForm.map((r) => `${r.count} ${FORM_NAMES[r.form] || r.form}`).join(' · ');

    const hourly = data.range === '24h';
    $('chart-sub').textContent = hourly ? 'per hour, Eastern time' : 'per day, Eastern time';
    lastChart = [data.series, hourly];
    chart(...lastChart);

    const visitors = (n) => (n === 1 ? 'visit' : 'visits');
    barList($('sources'), data.sources, (r) => r.name, (r) => r.sessions, visitors);
    barList($('pages'), data.pages, (r) => PAGE_NAMES[r.path] || r.path, (r) => r.views, (n) => (n === 1 ? 'view' : 'views'));
    barList($('artists'), data.artists, (r) => r.artist, (r) => r.clicks, (n) => (n === 1 ? 'click' : 'clicks'));
    barList($('outbound'), data.outbound, (r) => DESTINATIONS[r.destination] || r.destination, (r) => r.clicks, (n) => (n === 1 ? 'click' : 'clicks'));
    split($('devices'), data.devices, (r) => DEVICE_NAMES[r.device] || r.device, (r) => r.sessions);
    split($('languages'), data.languages, (r) => LANG_NAMES[r.lang] || r.lang, (r) => r.visitors);
    $('updated').textContent = `Updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }

  /* ---------- Leads ---------- */

  const filters = { form: '', status: '', q: '' };
  chipGroup('data-form', (value) => { filters.form = value; loadLeads(); });
  chipGroup('data-status', (value) => { filters.status = value; loadLeads(); });
  let searchTimer;
  $('lead-search').addEventListener('input', (event) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { filters.q = event.target.value; loadLeads(); }, 300);
  });

  const fieldLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const when = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const IDENTITY = new Set(['first_name', 'last_name', 'full_name', 'artist_name', 'creator_name', 'email', 'creator_email']);

  function leadCard(lead) {
    const handled = Boolean(lead.handled_at);
    const body = h('div', { class: 'lead__body', hidden: true });
    const card = h('article', { class: `lead${handled ? ' is-handled' : ''}` },
      h('button', { class: 'lead__summary', type: 'button', 'aria-expanded': 'false', onclick: (e) => {
        body.hidden = !body.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
      } },
        h('span', { class: 'lead__badge' }, FORM_NAMES[lead.form] || lead.form),
        h('span', { class: 'lead__who' }, h('span', { class: 'lead__name' }, lead.name || lead.email), h('span', { class: 'lead__email' }, lead.email)),
        h('span', { class: 'lead__when' }, when(lead.created_at)),
      ),
      body,
    );

    const rows = Array.isArray(lead.fields)
      ? lead.fields
      : Object.entries(lead.fields || {}).map(([key, value]) => ({ key, label: fieldLabel(key), value }));
    body.append(h('dl', { class: 'lead__fields' }, rows.filter((r) => !IDENTITY.has(r.key)).map((r) =>
      h('div', { class: String(r.value).length > 40 ? 'wide' : '' }, h('dt', {}, r.label), h('dd', {}, r.value)))));
    if ((lead.attachments || []).length) {
      body.append(h('p', { class: 'empty' }, `📎 ${lead.attachments.join(' · ')} (attached to the email)`));
    }

    const checkbox = h('input', { type: 'checkbox', checked: handled });
    const meta = h('span', { class: 'lead__meta' }, handled ? `Handled by ${lead.handled_by} · ${when(lead.handled_at)}` : `Ref ${lead.id}`);
    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        const { lead: saved } = await api('/api/admin/leads/', { method: 'PATCH', body: JSON.stringify({ id: lead.id, handled: checkbox.checked }) });
        for (const l of [lead, allLeads.find((x) => x.id === lead.id)].filter(Boolean)) {
          l.handled_at = saved.handled_at;
          l.handled_by = saved.handled_by;
        }
        card.classList.toggle('is-handled', Boolean(saved.handled_at));
        meta.textContent = saved.handled_at ? `Handled by ${saved.handled_by} · ${when(saved.handled_at)}` : `Ref ${lead.id}`;
        updateOpenCount();
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        alert(error.message);
      } finally {
        checkbox.disabled = false;
      }
    });
    const subject = encodeURIComponent(`Re: your ${(FORM_NAMES[lead.form] || '').toLowerCase()} inquiry — EQS Música`);
    body.append(h('div', { class: 'lead__actions' },
      h('a', { class: 'btn btn--accent btn--small', href: `mailto:${lead.email}?subject=${subject}` }, `Reply to ${(lead.name || '').split(' ')[0] || 'them'}`),
      h('label', { class: 'lead__handled' }, checkbox, 'Handled'),
      meta,
    ));
    return card;
  }

  let allLeads = [];
  function updateOpenCount() {
    const open = allLeads.filter((l) => !l.handled_at).length;
    $('open-count').hidden = !open;
    $('open-count').textContent = open;
  }

  let leadsRequest = 0;
  async function loadLeads() {
    const mine = ++leadsRequest;
    $('leads-error').hidden = true;
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    let data;
    try {
      data = await api(`/api/admin/leads/?${query}`);
    } catch (error) {
      if (error.status === 401) return;
      $('leads-error').textContent = error.message;
      $('leads-error').hidden = false;
      return;
    }
    if (mine !== leadsRequest) return;
    const list = $('lead-list');
    list.replaceChildren(...data.leads.map(leadCard));
    if (!data.leads.length) list.append(h('p', { class: 'empty' }, filters.form || filters.status || filters.q ? 'No leads match.' : 'No leads yet. New form submissions show up here.'));
    if (!filters.form && !filters.status && !filters.q) {
      allLeads = data.leads;
      updateOpenCount();
    }
  }

  /* ---------- Start ---------- */

  api('/api/admin/session/').then(({ user }) => showApp(user)).catch(showLogin);
})();
