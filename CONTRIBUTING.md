# Contributing

Thanks for your interest in improving the Acuris address validation widget. Issues and pull requests are welcome.

## Ground rules

- **No runtime dependencies and no build step.** The widget is plain ES5 JavaScript that runs
  from a `<script>` tag. Please keep it that way: no frameworks, no bundler, no polyfills.
- **Size budget:** widget JavaScript (everything in `src/` except the shared `acuris-core.js`)
  stays at or below 15 KB unminified, CSS at or below 4 KB. `node scripts/size.mjs` checks it.
- **Never commit an API key.** Examples and tests use the placeholder `YOUR_ACURIS_API_KEY`
  or a mocked `fetch`. Tests never call the live API.
- **Shared files are generated.** `src/acuris-core.js` start with a `/* core <sha> ... */` stamp and are
  shared by all Acuris widget repos. Do not edit them here; open an issue or a pull request
  describing the change and we will apply it to every widget. `node scripts/check-core.mjs`
  fails when a stamped file was edited by hand.

## Development

```bash
git clone https://github.com/Acuris-GmbH/acuris-address-validation-widget.git
cd acuris-address-validation-widget
npm test                       # node:test, mocked fetch, no network
node scripts/check-core.mjs    # shared files unchanged
node scripts/size.mjs          # bundle budget
```

Node 22 or newer. Open `examples/index.html` in a browser to try the widget with your own key.

## Pull requests

- One topic per pull request, with a test for any behaviour change.
- Describe what the user sees before and after.
- By contributing you agree that your contribution is licensed under the MIT licence of this
  repository.

## Questions and security

Questions about the widget or the Acuris API: support@acuris-geo.com. Please report security
issues privately to the same address rather than in a public issue.
