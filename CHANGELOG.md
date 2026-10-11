# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-10-11

### Changed

- Attribution link text is now "Powered by Acuris Geo" (links to https://www.acuris-geo.com/). `attribution: false` still removes it.

## [0.1.0] - 2026-10-11

### Added

- `AcurisAddressValidation.mount()` with single-line and fielded modes and an optional country selector.
- Verdict tags Verified / Corrected / Partial / Street found, not that number / Valid postcode / No match.
- Standardised address, coordinates and precision label; "Did you mean" chips.
- `acuris:result` / `acuris:error` events, `onResult` / `onError` callbacks, `baseUrl` proxy support.
- Shared `acuris-core.js` (request, error normaliser, host routing, helpers).
