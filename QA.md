# Enquiry workflow verification — 31 October 2026

Baseline: GitHub commit `92b0f207d68f7660d648c8ebbd0eb47d4f7ab508`. The original frontend was retained in `web/` because `dist/` is now generated Worker output.

## Passed

- `pnpm test`: 16 tests, including original calculator coverage. New tests exercise real schema/SQL using in-memory SQLite: input and consent validation, budget recalculation despite tampered totals, body limits, origin/content-type rejection, honeypot/timing, persisted throttling, duplicate/concurrent requests, receipt lookup, interrupted processing, missing configuration, DB failure, CAPTCHA hostname/action verification, signed webhook acknowledgment, HTTP 202/ambiguous responses/timeouts and Interakt contact/event partial failure.
- `pnpm run check`: browser and server JavaScript parse; TypeScript check passes.
- Production Worker build with the maintained Sites/Vinext integration and D1 migration generation.
- Local D1 migration applied; actual browser forms exercised the API and persisted test receipts.
- Desktop Chrome (approximately 1333 CSS px): calculator client gate, Premium 1,200 sq ft example, enquiry prefill/attachment, direct enquiry submission and truthful test receipt. Minimum-form-time rejection kept the fields; an explicit later retry completed.
- Mobile responsive frame: 390 px frame / 375 px content. Office / Elevate, 1,500 sq ft, pantry + storage produced ₹34,20,000 subtotal and ₹30,78,000–₹37,62,000 before GST. Details/structured scope attached to enquiry, separate consent completed and the backend returned a test receipt.
- Tablet responsive frame: 768 px frame / 753 px content. Direct enquiry returned a test receipt. Mobile and tablet document widths equalled scroll widths, with no horizontal page overflow.
- Test receipts explicitly say no enquiry was sent to the company. Fields remain available and the brief download remains separate.
- Browser QA identified and repaired public asset startup routing and HTTP-preview UUID compatibility. Production still requires HTTPS.

Screenshot: [Responsive submission evidence](docs/enquiry-responsive-qa.jpg).

## Verification limits / remaining activation

Provider calls use fixtures in automated tests. The private test environment never calls a real CRM or WhatsApp service. Live Interakt credentials, subscription access, webhook ownership, real Turnstile verification, staff notification and end-to-end lead delivery remain unverified. Browser coverage uses desktop Chrome with responsive frames, not physical iOS/Android devices or mobile keyboards.

See [activation instructions](docs/LEAD_ACTIVATION.md) for exact configuration, acknowledgment contracts and the required real-destination acceptance test. Retain `LEAD_MODE=test` until that work is completed. Do not infer live delivery from passing tests or a successful deployment.
