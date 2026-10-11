import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const W = require('../src/acuris-address-validation.js');
const KEY = 'test-key-not-real';

function mockFetch(status, body, calls) {
  return (url, init) => {
    calls.push({ url, init });
    return Promise.resolve({ status, ok: status < 300, json: () => Promise.resolve(body) });
  };
}

test('body: single line and fielded shapes', () => {
  assert.deepEqual(W.buildBody(' 1600 Pennsylvania Ave NW, Washington, DC 20500 ', 'USA'),
    { input: '1600 Pennsylvania Ave NW, Washington, DC 20500', country: 'usa' });
  assert.deepEqual(W.buildBody({ street: 'Schönhauser Allee', house_number: '36', city: 'Berlin', postcode: '10435', state: '' }, 'deu'),
    { input: { street: 'Schönhauser Allee', house_number: '36', city: 'Berlin', postcode: '10435' }, country: 'deu' });
});

test('validate: POSTs to /validate on the main host with the widget client header', async () => {
  const calls = [];
  await W.validate('Schönhauser Allee 36, 10435 Berlin', { apiKey: KEY, country: 'deu', fetch: mockFetch(200, {}, calls) });
  assert.equal(calls[0].url, 'https://api.acuris-geo.com/validate');
  assert.equal(calls[0].init.method, 'POST');
  assert.match(calls[0].init.headers['X-Acuris-Client'], /^gh-address-validation\/0\.1\.0$/);
  assert.deepEqual(JSON.parse(calls[0].init.body), { input: 'Schönhauser Allee 36, 10435 Berlin', country: 'deu' });
});

test('validate: gbr goes to the PAF host', async () => {
  const calls = [];
  await W.validate('10 Downing Street, London SW1A 2AA', { apiKey: KEY, country: 'gbr', fetch: mockFetch(200, {}, calls) });
  assert.equal(calls[0].url, 'https://paf.acuris-geo.com/validate');
});

test('validate: no country selected is refused locally', async () => {
  const calls = [];
  await assert.rejects(W.validate('x', { apiKey: KEY, fetch: mockFetch(200, {}, calls) }), (e) => e.code === 'country_required');
  assert.equal(calls.length, 0);
});

test('validate: 403 maps to a normalised error and renders the server message', async () => {
  const calls = [];
  const body = { error: 'free_limit_reached', message: 'Daily allowance used.', resets_at: '2026-10-12T00:00:00Z' };
  await assert.rejects(W.validate('x', { apiKey: KEY, country: 'usa', fetch: mockFetch(403, body, calls) }), (e) => {
    assert.equal(e.code, 'free_limit_reached');
    assert.equal(e.resetsAt, '2026-10-12T00:00:00Z');
    assert.match(W.errorHtml(e), /role="alert">Daily allowance used\./);
    return true;
  });
});

const verified = {
  status: 'verified', corrections: [], accuracy_type: 'rooftop', point_coordinate: true, lat: 52.538189, lng: 13.412664,
  standardized: { street: 'Schönhauser Allee', house_number: '36', postcode: '10435', city: 'Berlin', formatted_address: 'Schönhauser Allee 36\n10435 Berlin\nGERMANY' }
};

test('render: verified', () => {
  assert.equal(W.classify(verified), 'verified');
  const h = W.resultHtml(verified);
  assert.match(h, /acuris-tag--verified">Verified</);
  assert.match(h, /Schönhauser Allee 36\n10435 Berlin/);
  assert.match(h, /52\.538189, 13\.412664 <span class="acuris-prec acuris-prec--point">Rooftop</);
  assert.doesNotMatch(h, /Corrected/);
});

test('render: Corrected only when corrections[] is non-empty', () => {
  assert.equal(W.classify({ ...verified, status: 'corrected', corrections: [] }), 'verified');
  const r = { ...verified, status: 'corrected', corrections: ['Postal code', 'City'] };
  assert.equal(W.classify(r), 'corrected');
  assert.match(W.resultHtml(r), /Corrected: Postal code, City/);
});

test('render: partial vs verified', () => {
  const r = { partial_match: true, accuracy_type: 'postcode_centroid', lat: 1, lng: 2, reasons: ['street_not_matched'], standardized: { postcode: '10435', city: 'Berlin' } };
  assert.equal(W.classify(r), 'partial');
  const h = W.resultHtml(r);
  assert.match(h, /acuris-tag--partial">Partial</);
  assert.match(h, /acuris-prec--area">Postcode centre</);
});

test('render: house number not found is amber, valid postcode is green with the pin note', () => {
  assert.equal(W.classify({ partial_match: true, house_number_not_found: true }), 'hno');
  assert.match(W.resultHtml({ house_number_not_found: true, standardized: {} }), /Street found, not that number/);
  const pc = W.resultHtml({ postcode_valid: true, partial_match: true, standardized: { postcode: 'SW1A 1AA' } });
  assert.match(pc, /acuris-tag--postcode">Valid postcode</);
  assert.match(pc, /The pin is the centre of the postcode - add a house number or building name to check a specific address/);
});

test('render: 404 no match with did_you_mean chips, escaped', () => {
  const err = { code: 'no_match', message: 'No match.', body: { did_you_mean: [{ street: 'Main <St>', city: 'Springfield', postcode: '62701' }, { street: 'Main Ave', city: 'Springfield' }] } };
  const h = W.errorHtml(err);
  assert.match(h, /acuris-tag--nomatch">No match</);
  assert.match(h, /data-dym="0">Main &lt;St&gt;, 62701, Springfield</);
  assert.match(h, /data-dym="1">Main Ave, Springfield</);
});

test('form: placeholder country, no preselection; fielded inputs', () => {
  const h = W.formHtml({ country: 'select', fields: 'fielded', idPrefix: 't' });
  assert.match(h, /Select country/);
  assert.equal((h.match(/ selected/g) || []).length, 1);
  for (const f of ['street', 'house_number', 'city', 'postcode', 'state']) assert.match(h, new RegExp('name="' + f + '"'));
  assert.doesNotMatch(W.formHtml({ country: 'usa', fields: 'single', idPrefix: 't' }), /<select/);
});

test('render: attribution link on by default, removable, API attribution kept', () => {
  const r = { standardized: { formatted_address: '1 Main St' }, attribution: 'Data <source>' };
  const on = W.resultHtml(r);
  assert.match(on, /<a href="https:\/\/www\.acuris-geo\.com\/" target="_blank" rel="noopener">Address validation by ACURIS-geo\.com<\/a>/);
  assert.match(on, /<p class="acuris-attrib">Data &lt;source&gt;<\/p>/);
  const off = W.resultHtml(r, { attribution: false });
  assert.doesNotMatch(off, /ACURIS-geo\.com/);
  assert.match(off, /<p class="acuris-attrib">Data &lt;source&gt;<\/p>/);
});
