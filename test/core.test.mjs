// Shared tests for src/acuris-core.js (synced into every widget repo).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const C = require('../src/acuris-core.js');
const KEY = 'test-key-not-real';

function mockFetch(status, body, calls) {
  return (url, init) => {
    calls && calls.push({ url, init });
    return Promise.resolve({ status, ok: status < 300, json: () => Promise.resolve(body) });
  };
}

test('core: gbr goes to the PAF host, everything else to the main host', () => {
  assert.equal(C.hostFor('gbr'), 'https://paf.acuris-geo.com');
  assert.equal(C.hostFor('GBR'), 'https://paf.acuris-geo.com');
  assert.equal(C.hostFor('deu'), 'https://api.acuris-geo.com');
  assert.equal(C.hostFor('deu', { baseUrl: 'https://shop.example/acuris/' }), 'https://shop.example/acuris');
  assert.equal(C.hostFor('gbr', { baseUrl: 'https://p.example', ukBaseUrl: 'https://uk.example' }), 'https://uk.example');
});

test('core: request sends key + client headers, omits credentials, posts JSON', async () => {
  const calls = [];
  const r = await C.request({ method: 'POST', path: '/validate', body: { a: 1 }, country: 'usa', apiKey: KEY, client: 'gh-x/0.1.0', fetch: mockFetch(200, { ok: 1 }, calls) });
  assert.deepEqual(r.data, { ok: 1 });
  const { url, init } = calls[0];
  assert.equal(url, 'https://api.acuris-geo.com/validate');
  assert.equal(init.headers['X-Acuris-Key'], KEY);
  assert.equal(init.headers['X-Acuris-Client'], 'gh-x/0.1.0');
  assert.equal(init.headers['Content-Type'], 'application/json');
  assert.equal(init.credentials, 'omit');
  assert.equal(init.body, '{"a":1}');
});

test('core: no key (or the placeholder) is refused before any network call', async () => {
  const calls = [];
  for (const apiKey of [undefined, '', 'YOUR_ACURIS_API_KEY']) {
    await assert.rejects(C.request({ path: '/geocode', country: 'deu', apiKey, fetch: mockFetch(200, {}, calls) }), (e) => e.code === 'missing_api_key');
  }
  assert.equal(calls.length, 0);
});

test('core: keyless call allowed through your own proxy (baseUrl)', async () => {
  const calls = [];
  await C.request({ path: '/geocode', query: { q: 'x y' }, country: 'deu', baseUrl: 'https://shop.example/api', fetch: mockFetch(200, {}, calls) });
  assert.equal(calls[0].url, 'https://shop.example/api/geocode?q=x%20y');
  assert.equal(calls[0].init.headers['X-Acuris-Key'], undefined);
});

test('core: 403 cap carries resets_at, retry_after_seconds and the server message', async () => {
  const body = { error: 'uk_trial_cap_reached', message: 'Server says stop.', resets_at: '2026-10-12T00:00:00Z', retry_after_seconds: 99 };
  await assert.rejects(C.request({ path: '/validate', method: 'POST', body: {}, country: 'gbr', apiKey: KEY, fetch: mockFetch(403, body) }), (e) => {
    assert.equal(e.status, 403);
    assert.equal(e.code, 'uk_trial_cap_reached');
    assert.equal(e.message, 'Server says stop.');
    assert.equal(e.resetsAt, '2026-10-12T00:00:00Z');
    assert.equal(e.retryAfter, 99);
    return true;
  });
});

test('core: error vocabulary mapping', () => {
  assert.equal(C.normalizeError(401, {}).code, 'invalid_api_key');
  assert.equal(C.normalizeError(403, {}).code, 'forbidden');
  assert.equal(C.normalizeError(403, { error: 'key_blocked' }).code, 'key_blocked');
  assert.equal(C.normalizeError(402, { error: 'pack_expired' }).code, 'pack_expired');
  assert.equal(C.normalizeError(429, {}).code, 'rate_limit_exceeded');
  assert.equal(C.normalizeError(404, {}).code, 'no_match');
  assert.equal(C.normalizeError(501, {}).code, 'reverse_not_available');
  assert.equal(C.normalizeError(400, { error: 'Unsupported country' }).code, 'unsupported_country');
  const e = C.normalizeError(400, { error: 'country_not_served_by_this_endpoint', use_instead: 'https://paf.acuris-geo.com' });
  assert.equal(e.useInstead, 'https://paf.acuris-geo.com');
  const s = C.normalizeError(400, { error: 'Missing parameter: country' });
  assert.equal(s.message, 'Missing parameter: country');
});

test('core: network failure and abort are normalised', async () => {
  await assert.rejects(C.request({ path: '/x', country: 'usa', apiKey: KEY, fetch: () => Promise.reject(new TypeError('x')) }), (e) => e.code === 'network_error' && e.status === 0);
  const abort = Object.assign(new Error('a'), { name: 'AbortError' });
  await assert.rejects(C.request({ path: '/x', country: 'usa', apiKey: KEY, fetch: () => Promise.reject(abort) }), (e) => e.code === 'aborted');
});

test('core: UK postcode formatter', () => {
  assert.equal(C.formatUkPostcode('sw1a1aa'), 'SW1A 1AA');
  assert.equal(C.formatUkPostcode(' m1   1ae '), 'M1 1AE');
  assert.equal(C.formatUkPostcode('SW1A'), null);
  assert.equal(C.formatUkPostcode('10 Downing Street'), null);
});

test('core: escaping and precision (branch on point_coordinate)', () => {
  assert.equal(C.esc('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
  assert.deepEqual(C.precision({ accuracy_type: 'rooftop', point_coordinate: true }), { label: 'Rooftop', point: true });
  assert.deepEqual(C.precision({ accuracy_type: 'brand_new_tier', point_coordinate: true }), { label: 'Brand new tier', point: true });
  assert.equal(C.precision({ accuracy_type: 'rooftop' }).point, false);
  assert.match(C.coordsHtml({ lat: 1.5, lng: 2, accuracy_type: 'postcode_centroid', point_coordinate: false }), /acuris-prec--area/);
});

test('core: country selector has a placeholder and no preselected country', () => {
  const h = C.countryOptions(C.FREQUENT);
  assert.match(h, /^<option value="" selected disabled>Select country<\/option>/);
  assert.equal((h.match(/selected/g) || []).length, 1);
  assert.match(h, /<optgroup label="Frequently used">/);
  assert.deepEqual(C.FREQUENT, ['usa', 'can', 'deu', 'aut', 'fra', 'esp', 'prt', 'ita', 'sgp', 'nld', 'bel', 'nor', 'swe', 'dnk']);
});
