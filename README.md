# The Turnkey Company — Premium website

The original black architectural website, branding, six Residential / Office collections and budget experience are retained. Enquiries now pass through a same-origin Worker API with validated Interakt or signed-webhook delivery, explicit receipts and a safe test mode.

**Current activation: private test mode. No live CRM credentials have been configured or real lead delivery verified. Test receipts never claim the enquiry was sent.**

## Run and test

Use Node.js 22.13+ (Node 24 recommended for the built-in SQLite test runner) and pnpm 11.25.0. This repository now needs a Worker runtime and D1; serving only HTML on GitHub Pages cannot deliver leads.

```sh
pnpm install --frozen-lockfile
cp .env.example .dev.vars
pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shocking_union_jack.sql
pnpm dev
```

Open the URL printed by the dev server. Apply each migration once, in order. Local D1 and the hosted database are separate. In the managed environment, use the Sites installer and `sites-preview start <checkout>` instead of launching a second server.

```sh
pnpm test
pnpm run check
pnpm build
```

The test suite uses an in-memory SQLite database with the real migrations and repository SQL adapter. Its external provider responses are fixtures; no real messages or leads are sent.

## Submission behavior

1. Calculator remains a browser preview requiring client information. It does not submit automatically.
2. “Prepare a detailed enquiry” copies contact details and attaches structured area, project type, package and optional scope.
3. Visitor gives separate enquiry consent. A live submission also requires a valid Turnstile challenge.
4. `POST /api/enquiries` validates everything again, recalculates the illustrative estimate, claims a durable idempotency receipt, then contacts the configured provider.
5. Only a positive provider acknowledgment returns `delivered`. The UI describes this as acceptance by the lead system, never WhatsApp delivery or a human response.
6. Timeouts, ambiguous responses and partial Interakt writes remain `unknown`. The visitor can check the same request through `POST /api/enquiries/status`. No automatic resend occurs.

Definitive rejection permits an explicit retry with a new request key. Double clicks and same-key retries cannot create another delivery. Idempotency is scoped to the request key held by the current page; it is not cross-device or cross-reload deduplication. Keep the page open during an uncertain submission.

## Security and data handling

- Server-side length/type/enum/contact/consent validation, 16 KB request limit, origin checks and JSON-only POST.
- Honeypot and minimum form time, durable IP counters (15 attempts per 10 minutes) and mobile counters (5 new attempts per hour). Production requires Turnstile Siteverify with hostname/action validation; public test keys are rejected in live mode.
- Bearer credentials / Interakt Basic key and HMAC signing secret remain server-only. Webhooks require an HTTPS hostname allowlist, reject redirects and use a bounded timeout.
- D1 stores a random reference, protected fingerprints, status and timestamps; it does **not** store names, phones, emails or briefs. Receipt retention is 30 days with opportunistic expiry cleanup; rate counters expire after two hours. No PII or provider response bodies are logged by the application.
- Contact details go to the selected CRM only on an explicit live submission. CRM access, retention and deletion arrangements must be approved before launch.
- There is no queued PII outbox or background retry service. A failed/uncertain lead cannot be reconstructed from the website database. The visitor retains the form in the open page and can download it. Operational reconciliation uses the displayed reference and the CRM's `website_lead_id` / webhook `id`.
- API responses are non-cacheable. The HTML uses CSP, no-sniff and referrer protections. Form fallback uses POST so a failed script cannot place contact details into the URL.

## Repository layout

| Path | Purpose |
| --- | --- |
| `web/` | Original `dist/` frontend moved intact for the Worker build; contains the authored HTML, styles, modules and assets |
| `web/enquiry.js` | Submission UI, status handling and calculator attachment |
| `server/leads.mjs` | Validation, anti-spam checks, provider adapters and delivery state machine |
| `server/store.mjs` | Durable D1 receipts and rate counters |
| `app/api/enquiries/` | Server-only API routes |
| `app/route.ts` | Original homepage served with security headers |
| `db/`, `drizzle/` | Database schema and generated migrations |
| `public/`, `dist/` | Ignored generated assets / Worker build output |
| `docs/LEAD_ACTIVATION.md` | Required settings, integration contract and production smoke test |
| `QA.md` | Actual verification and limits |

`web/calculator.js` still contains **illustrative prices**, not approved quotations. Project imagery/testimonials remain labelled placeholders. Existing assets and package specifications are preserved; see `ASSETS.md`. `noindex,nofollow` and owner-private access remain intentional.
