# acuris-address-validation-widget

> Framework-free address validation widget for any HTML form. Verifies, corrects and standardises addresses in 240+ countries via the Acuris API; returns coordinates and a precision tier. One script tag, MIT. Free API key, 1,000 transactions/day.

[![CI](https://github.com/Acuris-GmbH/acuris-address-validation-widget/actions/workflows/ci.yml/badge.svg)](https://github.com/Acuris-GmbH/acuris-address-validation-widget/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Status:** beta (0.1.1)

---

## What this is

A small, dependency-free widget that adds address validation to any HTML page. The user types an
address (one line, or separate fields), the widget sends it to the Acuris
[`POST /validate`](https://api.acuris-geo.com/docs#validate) endpoint and shows the verdict:

| Tag | When |
| --- | --- |
| **Verified** | The address matched the reference data. |
| **Corrected** | It matched after a value-changing correction; the corrected fields are listed (`corrections[]`). |
| **Partial** | Only part of the address could be confirmed (`partial_match`); the pin is approximate. |
| **Street found, not that number** | The street exists but the house number is not on file. |
| **Valid postcode** | A bare postcode that exists (UK). |
| **No match** | Nothing matched (HTTP 404); "Did you mean" chips are shown when the API offers candidates. |

It also shows the standardised address, the coordinates and a precision label (rooftop, street,
postcode or locality centre). Whether the pin is an address point or an area centre is taken from
the boolean `point_coordinate`, so new precision tiers never break the badge.

- 240+ countries and territories; country is chosen by the user (placeholder "Select country",
  never preselected) or fixed by you.
- UK addresses (`gbr`) are sent to `https://paf.acuris-geo.com` automatically. UK lookups are
  licensed per transaction; see the [UK pricing](https://www.acuris-geo.com/acuris-pricing/#uk-plans).
- ES5, no framework, no build step, about 10 KB of widget code plus the shared 10 KB core.

---

## Quick start

Copy the files from `src/` into your site (no build step, no dependencies) and load them
in this order: the stylesheet, `acuris-core.js`, then the widget.

```html
<link rel="stylesheet" href="/js/acuris/acuris-address-validation.css">
<script src="/js/acuris/acuris-core.js"></script>
<script src="/js/acuris/acuris-address-validation.js"></script>
```

```html
<div id="address-check"></div>
<script>
  AcurisAddressValidation.mount('#address-check', {
    apiKey: 'YOUR_ACURIS_API_KEY',   // free key: https://api.acuris-geo.com/register?lang=en
    country: 'select',               // or a fixed ISO-3 code, e.g. 'usa'
    fields: 'single'                 // or 'fielded'
  });
</script>
```

Open [`examples/index.html`](examples/index.html) for a working page (paste your key; it is kept
in `sessionStorage` for that tab only).

### Options

| Option | Default | Description |
| --- | --- | --- |
| `apiKey` | none | Your Acuris API key. Required unless `baseUrl` points at your own proxy. |
| `country` | `'select'` | ISO-3 code (`'usa'`, `'deu'`, ...) or `'select'` to show a country selector. |
| `fields` | `'single'` | `'single'` (one input) or `'fielded'` (street, house number, city, postcode, state). |
| `fieldList` | built-in | Fielded mode only: array of `[name, label]` pairs sent as `input` fields. |
| `baseUrl` | `https://api.acuris-geo.com` | Your proxy URL (see Production). Also used for UK unless `ukBaseUrl` is set. |
| `ukBaseUrl` | `https://paf.acuris-geo.com` | Host for `country: 'gbr'`. |
| `onResult` | none | `function (response)` called with the API response. |
| `onError` | none | `function (error)` called with `{status, code, message, resetsAt}`. |
| `fetch` | `window.fetch` | Inject your own `fetch` (tests, instrumentation). |
| `attribution` | `true` | Shows the link "Powered by Acuris Geo" under each result; set `false` to turn it off. |

`mount()` returns `{ element, validate(values?), destroy() }`. Without a DOM you can call
`AcurisAddressValidation.validate(values, { apiKey, country })`, which resolves to the API response.

### Events

Dispatched on the mount element and bubbling:

| Event | `event.detail` |
| --- | --- |
| `acuris:result` | `{ response, verdict }`, verdict one of `verified`, `corrected`, `partial`, `hno`, `postcode` |
| `acuris:error` | `{ error }` with `status`, `code` (e.g. `no_match`, `invalid_api_key`, `free_limit_reached`, `rate_limit_exceeded`), `message`, `resetsAt` |

```js
document.querySelector('#address-check').addEventListener('acuris:result', function (ev) {
  console.log(ev.detail.verdict, ev.detail.response.standardized);
});
```

---

## Production

Every Acuris widget needs an API key. A key placed in browser code is **visible to anyone who
opens your page**, so treat the key in `apiKey` as an evaluation setup.

**Recommended for production:** keep the key on your server and let the widget talk to your own
backend. Set `baseUrl` (and `ukBaseUrl` for UK addresses) to endpoints you host; they forward the
request to the Acuris API and add the `X-Acuris-Key` header server-side. Leave `apiKey` empty in
the browser. UK requests (`country=gbr`) must always be forwarded to https://paf.acuris-geo.com,
everything else to https://api.acuris-geo.com; the same key works on both.

```js
// Minimal Node 22 proxy (Express). Forward only the paths this widget uses,
// and add your own rate limiting and bot protection.
const ACURIS_KEY = getSecret('ACURIS_API_KEY'); // from your secret store, never from the browser
const HOSTS = { '/acuris': 'https://api.acuris-geo.com', '/acuris-uk': 'https://paf.acuris-geo.com' };
app.use(express.json());
app.all(/^\/(acuris|acuris-uk)\/(validate)$/, async (req, res) => {
  const prefix = '/' + req.path.split('/')[1];
  const r = await fetch(HOSTS[prefix] + req.originalUrl.slice(prefix.length), {
    method: req.method,
    headers: { 'X-Acuris-Key': ACURIS_KEY, 'Content-Type': 'application/json' },
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body)
  });
  res.status(r.status).type('application/json').send(await r.text());
});
```

```js
AcurisAddressValidation.mount('#address-check', { baseUrl: '/acuris', ukBaseUrl: '/acuris-uk', country: 'select' });
```

### Free tier

A free key gives you **1,000 transactions a day, no card, never expires**
([get one](https://api.acuris-geo.com/register?lang=en)). Commercial use of the free tier requires a visible attribution link back
to acuris-geo.com wherever results are shown; see the [Terms of Service](https://api.acuris-geo.com/legal/terms).
Paid plans: [https://www.acuris-geo.com/acuris-pricing/](https://www.acuris-geo.com/acuris-pricing/).

---

## Use with AI coding agents

If you build with Claude Code, Cursor, GitHub Copilot, OpenCode, Codex, Gemini CLI or any other
tool that supports [Agent Skills](https://agentskills.io), install the Acuris agent context. It
teaches your agent the Acuris API: endpoints, headers, error codes and the patterns used here.

```bash
# Claude Code
/plugin marketplace add Acuris-GmbH/acuris-agent-context
/plugin install acuris@acuris-plugins

# Cursor, Copilot, Codex, OpenCode, Gemini CLI and others
npx skills add Acuris-GmbH/acuris-agent-context
```

Source: <https://github.com/Acuris-GmbH/acuris-agent-context>

---

## Docs & links

- API reference: <https://api.acuris-geo.com/docs>
- OpenAPI spec: <https://api.acuris-geo.com/docs/openapi.yaml>
- Get a free API key: <https://api.acuris-geo.com/register?lang=en>
- Pricing: <https://www.acuris-geo.com/acuris-pricing/>
- Terms of Service: <https://api.acuris-geo.com/legal/terms>
- Support: support@acuris-geo.com

---

## More Acuris on GitHub

| Repository | What it does |
| --- | --- |
| [acuris-address-autocomplete-widget](https://github.com/Acuris-GmbH/acuris-address-autocomplete-widget) | Address autocomplete (typeahead), 20 countries |
| [acuris-geocoding-widget](https://github.com/Acuris-GmbH/acuris-geocoding-widget) | Address to latitude/longitude with a precision tier |
| [acuris-reverse-geocoding-widget](https://github.com/Acuris-GmbH/acuris-reverse-geocoding-widget) | Coordinates to the nearest postal addresses |
| [acuris-mcp](https://github.com/Acuris-GmbH/acuris-mcp) | MCP server: address validation and geocoding tools for AI assistants |
| [acuris-agent-context](https://github.com/Acuris-GmbH/acuris-agent-context) | Agent Skills that teach coding agents the Acuris API |
| [acuris-commercetools-connector](https://github.com/Acuris-GmbH/acuris-commercetools-connector) | commercetools checkout widgets + API Extension |
| [acuris-centra-connector](https://github.com/Acuris-GmbH/acuris-centra-connector) | Centra checkout address validation |
| [acuris-scayle-connector](https://github.com/Acuris-GmbH/acuris-scayle-connector) | SCAYLE checkout address validation |

---

## License

Maintained by Acuris GmbH · Support: support@acuris-geo.com

MIT (this widget). The Acuris API itself is a commercial service with a free tier.
