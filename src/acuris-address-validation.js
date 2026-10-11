/*! Acuris address validation widget | MIT | Copyright (c) 2026 Acuris GmbH */
(function (root, factory) {
  var C = (typeof module === 'object' && module.exports) ? require('./acuris-core.js') : root.AcurisCore;
  var api = factory(C, root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AcurisAddressValidation = api;
})(typeof self !== 'undefined' ? self : this, function (C, root) {
  'use strict';

  var VERSION = '0.1.1';
  var FIELDS = [['street', 'Street'], ['house_number', 'House number'], ['city', 'City'], ['postcode', 'Postcode'], ['state', 'State / region']];
  var POSTCODE_NOTE = 'The pin is the centre of the postcode - add a house number or building name to check a specific address';
  var TAGS = {
    verified: 'Verified', corrected: 'Corrected', partial: 'Partial', nomatch: 'No match',
    postcode: 'Valid postcode', hno: 'Street found, not that number'
  };
  var ATTRIB = 'Powered by Acuris Geo';
  var ATTRIB_URL = 'https://www.acuris-geo.com/';

  // Visible attribution link, on by default; opts.attribution === false removes it.
  function attribLinkHtml(opts) {
    if (opts && opts.attribution === false) return '';
    return '<p class="acuris-powered"><a href="' + C.esc(ATTRIB_URL) + '" target="_blank" rel="noopener">' + C.esc(ATTRIB) + '</a></p>';
  }

  // values: a string (single line) or an object of fields.
  function buildBody(values, country) {
    var input = values;
    if (values && typeof values === 'object') {
      input = {};
      for (var k in values) {
        if (Object.prototype.hasOwnProperty.call(values, k) && values[k] != null && String(values[k]).trim() !== '') input[k] = String(values[k]).trim();
      }
    } else input = String(values == null ? '' : values).trim();
    return { input: input, country: String(country || '').toLowerCase() };
  }

  // opts: {apiKey, country, baseUrl, ukBaseUrl, fetch, client}
  function validate(values, opts) {
    opts = opts || {};
    var body = buildBody(values, opts.country);
    if (!body.country) return Promise.reject(C.normalizeError(0, { error: 'country_required', message: 'Select a country first.' }));
    return C.request({
      method: 'POST', path: '/validate', body: body, country: body.country, apiKey: opts.apiKey,
      baseUrl: opts.baseUrl, ukBaseUrl: opts.ukBaseUrl, fetch: opts.fetch, signal: opts.signal,
      client: opts.client || ('gh-address-validation/' + VERSION)
    }).then(function (r) { return r.data; });
  }

  function classify(r) {
    if (!r) return 'nomatch';
    if (r.postcode_valid === true) return 'postcode';
    if (r.house_number_not_found === true) return 'hno';
    if (r.partial_match === true) return 'partial';
    if (r.corrections && r.corrections.length) return 'corrected';
    return 'verified';
  }

  function formatted(r) {
    var s = (r && r.standardized) || {};
    if (s.formatted_address) return s.formatted_address;
    if (r && r.formatted_address) return r.formatted_address;
    return [[s.house_number, s.street].filter(Boolean).join(' '), [s.postcode, s.city].filter(Boolean).join(' '), s.state]
      .filter(Boolean).join('\n');
  }

  function dymLabel(d) {
    return [[d.house_number, d.street].filter(Boolean).join(' '), d.postcode, d.city, d.municipality, d.state]
      .filter(Boolean).join(', ');
  }

  function chipsHtml(list) {
    if (!list || !list.length) return '';
    var h = '<div class="acuris-dym"><span>Did you mean:</span>';
    for (var i = 0; i < list.length && i < 6; i++) {
      h += '<button type="button" class="acuris-chip" data-dym="' + i + '">' + C.esc(dymLabel(list[i] || {})) + '</button>';
    }
    return h + '</div>';
  }

  function tagHtml(kind) {
    return '<span class="acuris-tag acuris-tag--' + kind + '">' + C.esc(TAGS[kind]) + '</span>';
  }

  // Pure: response -> HTML string. opts.uk = the UK extras module (optional);
  // opts.attribution === false hides the "Powered by Acuris Geo" link.
  function resultHtml(r, opts) {
    opts = opts || {};
    var uk = opts.uk;
    var kind = classify(r);
    var addr = formatted(r);
    var h = '<div class="acuris-result acuris-result--' + kind + '">' + tagHtml(kind);
    if (uk && uk.welshAlternate) h += uk.welshToggleHtml(uk.welshAlternate(r, addr));
    h += '<div class="acuris-addr">' + C.esc(addr) + '</div>';
    if (kind === 'corrected') h += '<p class="acuris-corr">Corrected: ' + C.esc(r.corrections.join(', ')) + '</p>';
    if (kind === 'postcode') h += '<p class="acuris-note">' + C.esc(POSTCODE_NOTE) + '</p>';
    h += C.coordsHtml(r);
    h += chipsHtml(r.did_you_mean);
    if (uk) h += uk.identifiersHtml(r) + uk.attributionHtml(r);
    else if (r.attribution) h += '<p class="acuris-attrib">' + C.esc(r.attribution) + '</p>';
    h += attribLinkHtml(opts);
    return h + '</div>';
  }

  // Pure: error -> HTML. A 404 is a "No match" verdict, with did_you_mean chips when offered.
  function errorHtml(err, opts) {
    var uk = opts && opts.uk;
    if (err && err.code === 'no_match') {
      return '<div class="acuris-result acuris-result--nomatch">' + tagHtml('nomatch') +
        '<p>' + C.esc(err.message) + '</p>' + chipsHtml(err.body && err.body.did_you_mean) + '</div>';
    }
    if (uk) return uk.errorHtml(err);
    return '<p class="acuris-error" role="alert">' + C.esc(err && err.message) + '</p>';
  }

  function formHtml(opts) {
    var id = opts.idPrefix;
    var h = '<form class="acuris-av" novalidate>';
    if (opts.country === 'select') {
      h += '<label for="' + id + '-c">Country</label><select id="' + id + '-c" name="country" required>' +
        C.countryOptions(C.FREQUENT) + '<option value="__other">Other country (ISO-3 code)</option></select>' +
        '<input class="acuris-other" name="country_other" maxlength="3" placeholder="e.g. che" hidden aria-label="ISO-3 country code">';
    }
    if (opts.fields === 'fielded') {
      var list = opts.fieldList || FIELDS;
      for (var i = 0; i < list.length; i++) {
        h += '<label for="' + id + '-' + list[i][0] + '">' + C.esc(list[i][1]) + '</label><input id="' + id + '-' + list[i][0] +
          '" name="' + list[i][0] + '">';
      }
    } else {
      h += '<label for="' + id + '-q">Address</label><input id="' + id + '-q" name="input" autocomplete="off">';
    }
    return h + '<button type="submit">Validate</button><div class="acuris-out" aria-live="polite"></div></form>';
  }

  function mount(target, options) {
    var o = {};
    var k;
    for (k in options || {}) if (Object.prototype.hasOwnProperty.call(options, k)) o[k] = options[k];
    o.country = o.country || 'select';
    o.fields = o.fields || 'single';
    o.idPrefix = C.nextId('acuris-av');
    var host = C.pick(target);
    if (!host) throw new Error('AcurisAddressValidation: target not found');
    host.innerHTML = formHtml(o);
    var form = host.querySelector('form');
    var out = host.querySelector('.acuris-out');
    var sel = form.querySelector('select[name="country"]');
    var other = form.querySelector('input[name="country_other"]');
    var last = null;
    if (sel) sel.addEventListener('change', function () { other.hidden = sel.value !== '__other'; });
    if (o.uk) {
      var pc = form.querySelector('input[name="postcode"]') || form.querySelector('input[name="input"]');
      o.uk.bindPostcodeBlur(pc);
    }

    function country() {
      if (!sel) return o.country;
      return sel.value === '__other' ? String(other.value || '').trim().toLowerCase() : sel.value;
    }
    function values() {
      if (o.fields !== 'fielded') return form.querySelector('input[name="input"]').value;
      var v = {}, ins = form.querySelectorAll('input[name]');
      for (var i = 0; i < ins.length; i++) if (ins[i].name !== 'country_other') v[ins[i].name] = ins[i].value;
      return v;
    }
    function fill(d) {
      if (o.fields !== 'fielded') { form.querySelector('input[name="input"]').value = dymLabel(d); return; }
      for (var f in d) {
        var el = form.querySelector('input[name="' + f + '"]');
        if (el && typeof d[f] !== 'object') el.value = d[f];
      }
    }
    function run(v) {
      if (o.uk) {
        var pc = form.querySelector('input[name="postcode"]') || form.querySelector('input[name="input"]');
        if (pc) pc.value = o.uk.tidy(pc.value);
      }
      out.innerHTML = '<p class="acuris-busy">Checking…</p>';
      var opts = { apiKey: o.apiKey, country: country(), baseUrl: o.baseUrl, ukBaseUrl: o.ukBaseUrl, fetch: o.fetch, client: o.client };
      return validate(v == null ? values() : v, opts).then(function (r) {
        last = r.did_you_mean || null;
        out.innerHTML = resultHtml(r, o);
        if (o.uk) o.uk.bindWelshToggle(out);
        C.emit(host, 'acuris:result', { response: r, verdict: classify(r) });
        if (typeof o.onResult === 'function') o.onResult(r);
        return r;
      }, function (err) {
        last = (err.body && err.body.did_you_mean) || null;
        out.innerHTML = errorHtml(err, o);
        C.emit(host, 'acuris:error', { error: err });
        if (typeof o.onError === 'function') o.onError(err);
        return null;
      });
    }
    function onSubmit(ev) { ev.preventDefault(); run(); }
    function onClick(ev) {
      var t = ev.target;
      var i = t && t.getAttribute ? t.getAttribute('data-dym') : null;
      if (i == null || !last || !last[+i]) return;
      fill(last[+i]);
      run();
    }
    form.addEventListener('submit', onSubmit);
    out.addEventListener('click', onClick);
    return {
      element: host,
      validate: run,
      destroy: function () {
        form.removeEventListener('submit', onSubmit);
        out.removeEventListener('click', onClick);
        host.innerHTML = '';
      }
    };
  }

  return {
    VERSION: VERSION, FIELDS: FIELDS, TAGS: TAGS, buildBody: buildBody, validate: validate, classify: classify,
    formatted: formatted, resultHtml: resultHtml, errorHtml: errorHtml, formHtml: formHtml, mount: mount
  };
});
