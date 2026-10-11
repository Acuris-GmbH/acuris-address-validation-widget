/* core eee9f7fd42b1 from _core/acuris-core.js */
/*! Acuris widget core | MIT | Copyright (c) 2026 Acuris GmbH */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcurisCore = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  var API = 'https://api.acuris-geo.com';
  var PAF = 'https://paf.acuris-geo.com';
  var PLACEHOLDER = 'YOUR_ACURIS_API_KEY';

  // Frequently used countries (ISO-3). No country is ever preselected.
  var FREQUENT = ['usa', 'can', 'deu', 'aut', 'fra', 'esp', 'prt', 'ita', 'sgp', 'nld', 'bel', 'nor', 'swe', 'dnk'];
  var NAMES = {
    usa: 'United States', can: 'Canada', deu: 'Germany', aut: 'Austria', fra: 'France',
    esp: 'Spain', prt: 'Portugal', ita: 'Italy', sgp: 'Singapore', nld: 'Netherlands',
    bel: 'Belgium', nor: 'Norway', swe: 'Sweden', dnk: 'Denmark', che: 'Switzerland',
    lux: 'Luxembourg', fin: 'Finland', irl: 'Ireland', jpn: 'Japan', hkg: 'Hong Kong',
    gbr: 'United Kingdom'
  };

  var MESSAGES = {
    missing_api_key: 'Add your Acuris API key to use this widget.',
    invalid_api_key: 'The API key was not recognised. Check the key, or get a free one.',
    free_limit_reached: 'The free daily allowance on this key is used up.',
    uk_trial_cap_reached: 'The free UK lookups for today are used up.',
    insufficient_credits: 'There are no transactions left on this key.',
    trial_expired: 'The trial on this key has ended.',
    key_blocked: 'This API key has been blocked.',
    ip_not_allowed: 'This API key is restricted to other IP addresses.',
    signup_required: 'An API key is required. Create a free account to get one.',
    forbidden: 'This request is not allowed with this key.',
    pack_expired: 'The transaction pack on this key has expired.',
    subscription_canceled: 'The subscription on this key has been cancelled.',
    credits_wrong_region: 'This key\'s transactions do not cover this country.',
    rate_limit_exceeded: 'Too many requests. Wait a moment and try again.',
    country_not_served_by_this_endpoint: 'This country is served by a different Acuris host.',
    unsupported_country: 'This country is not supported.',
    no_match: 'No matching address was found.',
    reverse_not_available: 'Reverse geocoding is not available for this country.',
    id_expired: 'That suggestion has expired. Please search again.',
    network_error: 'Could not reach the Acuris API. Check your connection.',
    aborted: 'Request cancelled.'
  };

  var BY_STATUS = { 401: 'invalid_api_key', 403: 'forbidden', 404: 'no_match', 410: 'id_expired', 429: 'rate_limit_exceeded', 501: 'reverse_not_available' };

  function isUk(country) { return String(country || '').toLowerCase() === 'gbr'; }

  function trimSlash(u) { return String(u).replace(/\/+$/, ''); }

  // gbr always goes to the PAF host; everything else to the main API host.
  // `baseUrl` (e.g. your own proxy) replaces both unless `ukBaseUrl` is set.
  function hostFor(country, o) {
    o = o || {};
    if (isUk(country)) return trimSlash(o.ukBaseUrl || o.baseUrl || PAF);
    return trimSlash(o.baseUrl || API);
  }

  function isAcurisHost(h) { return h === API || h === PAF; }

  function hasKey(k) { return !!k && k !== PLACEHOLDER; }

  function normalizeError(status, body) {
    body = (body && typeof body === 'object') ? body : {};
    var code = typeof body.error === 'string' ? body.error : (typeof body.code === 'string' ? body.code : '');
    var sentence = '';
    if (/^unsupported country$/i.test(code)) code = 'unsupported_country';
    else if (/ /.test(code)) { sentence = code; code = ''; }
    if (!code) code = BY_STATUS[status] || (status === 402 ? 'insufficient_credits' : (status ? 'http_' + status : 'network_error'));
    var msg = (typeof body.message === 'string' && body.message) || sentence || MESSAGES[code] || ('Request failed (HTTP ' + status + ').');
    return {
      status: status || 0,
      code: code,
      message: msg,
      resetsAt: body.resets_at || null,
      retryAfter: typeof body.retry_after_seconds === 'number' ? body.retry_after_seconds : null,
      useInstead: body.use_instead || null,
      body: body
    };
  }

  function qs(q) {
    if (!q) return '';
    var out = [];
    for (var k in q) {
      if (Object.prototype.hasOwnProperty.call(q, k) && q[k] != null && q[k] !== '') {
        out.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
      }
    }
    return out.length ? '?' + out.join('&') : '';
  }

  // o = {apiKey, client, method, path, query, body, country, baseUrl, ukBaseUrl, fetch, signal}
  // Resolves {status, data}; rejects with a normalised error object.
  function request(o) {
    var host = hostFor(o.country, o);
    var f = o.fetch || (root && root.fetch ? function (u, i) { return root.fetch(u, i); } : null);
    if (!f) return Promise.reject(normalizeError(0, { error: 'network_error' }));
    if (!hasKey(o.apiKey) && isAcurisHost(host)) return Promise.reject(normalizeError(0, { error: 'missing_api_key' }));
    var headers = { 'Accept': 'application/json' };
    if (hasKey(o.apiKey)) headers['X-Acuris-Key'] = o.apiKey;
    if (o.client) headers['X-Acuris-Client'] = o.client;
    var init = { method: o.method || 'GET', headers: headers, credentials: 'omit', mode: 'cors' };
    if (o.body != null) { headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(o.body); }
    if (o.signal) init.signal = o.signal;
    return f(host + o.path + qs(o.query), init).then(function (r) {
      var p = (r && typeof r.json === 'function') ? r.json() : Promise.resolve({});
      return p.then(null, function () { return {}; }).then(function (data) {
        if (r.status >= 200 && r.status < 300) return { status: r.status, data: data || {} };
        throw normalizeError(r.status, data);
      });
    }, function (e) {
      throw normalizeError(0, { error: (e && e.name === 'AbortError') ? 'aborted' : 'network_error' });
    });
  }

  // UK postcode: "sw1a1aa" -> "SW1A 1AA"; null when it is not a full postcode.
  function formatUkPostcode(s) {
    var t = String(s == null ? '' : s).toUpperCase().replace(/\s+/g, ' ').trim();
    var m = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/.exec(t);
    return m ? m[1] + ' ' + m[2] : null;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function emit(el, name, detail) {
    if (!el || !el.dispatchEvent) return;
    var ev;
    if (typeof root.CustomEvent === 'function') ev = new root.CustomEvent(name, { bubbles: true, detail: detail });
    else { ev = root.document.createEvent('CustomEvent'); ev.initCustomEvent(name, true, false, detail); }
    el.dispatchEvent(ev);
  }

  // Precision: the label comes from accuracy_type; point vs area ALWAYS from
  // the boolean point_coordinate (new tiers may appear at any time).
  var TIERS = {
    rooftop: 'Rooftop', arrival_point: 'Arrival point', street_interpolated: 'Interpolated on the street',
    street_centroid: 'Street centre', street_segment_centroid: 'Street segment centre',
    postcode_centroid: 'Postcode centre', postcode: 'Postcode centre', locality_centroid: 'Locality centre',
    admin_centroid: 'Region centre'
  };
  function precision(r) {
    var t = r && r.accuracy_type ? String(r.accuracy_type) : '';
    var label = TIERS[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') : '');
    return { label: label, point: !!(r && r.point_coordinate === true) };
  }

  function coordsHtml(r) {
    if (!r || typeof r.lat !== 'number' || typeof r.lng !== 'number') return '';
    var p = precision(r);
    return '<p class="acuris-coords">' + r.lat.toFixed(6) + ', ' + r.lng.toFixed(6) +
      (p.label ? ' <span class="acuris-prec acuris-prec--' + (p.point ? 'point' : 'area') + '">' + esc(p.label) + '</span>' : '') + '</p>';
  }

  // <select> markup: placeholder first, "Frequently used" group, optional extra group.
  function countryOptions(frequent, extra, extraLabel) {
    var h = '<option value="" selected disabled>Select country</option><optgroup label="Frequently used">';
    function opt(c) { return '<option value="' + esc(c) + '">' + esc(NAMES[c] || c.toUpperCase()) + '</option>'; }
    var i;
    for (i = 0; i < frequent.length; i++) h += opt(frequent[i]);
    h += '</optgroup>';
    if (extra && extra.length) {
      h += '<optgroup label="' + esc(extraLabel || 'More countries') + '">';
      for (i = 0; i < extra.length; i++) h += opt(extra[i]);
      h += '</optgroup>';
    }
    return h;
  }

  // Listbox keyboard helpers (combobox pattern).
  function move(cur, n, dir) {
    if (!n) return -1;
    if (cur < 0) return dir > 0 ? 0 : n - 1;
    return (cur + dir + n) % n;
  }
  function setActive(input, list, idx) {
    var opts = list ? list.querySelectorAll('[role="option"]') : [];
    var id = '';
    for (var i = 0; i < opts.length; i++) {
      var on = i === idx;
      opts[i].setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) { id = opts[i].id; if (opts[i].scrollIntoView) opts[i].scrollIntoView({ block: 'nearest' }); }
    }
    if (id) input.setAttribute('aria-activedescendant', id);
    else input.removeAttribute('aria-activedescendant');
  }

  var uid = 0;
  function nextId(prefix) { uid += 1; return (prefix || 'acuris') + '-' + uid; }

  function pick(target) {
    if (typeof target === 'string') return root.document.querySelector(target);
    return target || null;
  }

  return {
    VERSION: '0.1.0', API_HOST: API, UK_HOST: PAF, PLACEHOLDER_KEY: PLACEHOLDER,
    REGISTER_URL: 'https://api.acuris-geo.com/register?lang=en',
    FREQUENT: FREQUENT, NAMES: NAMES, MESSAGES: MESSAGES,
    hostFor: hostFor, hasKey: hasKey, request: request, normalizeError: normalizeError, qs: qs,
    formatUkPostcode: formatUkPostcode, esc: esc, emit: emit, precision: precision, coordsHtml: coordsHtml,
    countryOptions: countryOptions, move: move, setActive: setActive, nextId: nextId, pick: pick, isUk: isUk
  };
});
