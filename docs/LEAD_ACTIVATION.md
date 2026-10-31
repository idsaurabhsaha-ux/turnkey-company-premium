# Lead collection activation — 31 October 2026

## Current verified state

The associated site is owner-private and configured with `LEAD_MODE=test`. No Interakt key, CRM destination or live Turnstile credentials were present in its runtime configuration. No real lead delivery or WhatsApp messaging was attempted. The implementation is ready for configuration and an end-to-end acceptance test, not yet activated for public customers.

The website needs the deployed Worker plus the `DB` D1 binding and generated migration. A static-only host cannot run the API. Sites provisions D1 from `.openai/hosting.json` and applies migrations during deployment. Preserve the existing project ID and access policy.

## Required live configuration

Use the host's secret/environment settings. Never enter secrets in browser JavaScript, the hosting manifest, GitHub source, issue text or a chat transcript. Local `.dev.vars` / `.env*` are ignored; `.env.example` lists names only.

| Setting | Required value |
| --- | --- |
| `LEAD_MODE` | `live` only after staging verification; `disabled` immediately stops new submissions; `test` makes no provider requests |
| `ENABLE_TEST_MODE` | `true` only in the private test environment; remove or set `false` for live |
| `ALLOWED_ORIGINS` | Exact HTTPS website origins, comma-separated, without trailing slash; include the final custom domain |
| `LEAD_HASH_SECRET` | Random secret of at least 32 characters; stable across deployments to preserve receipt lookup |
| `TURNSTILE_SITE_KEY` | Real site key for the approved production hostname; this public key is the only credential-like value exposed to the browser |
| `TURNSTILE_SECRET_KEY` | Matching server secret; public testing keys are rejected in live mode |
| `TURNSTILE_HOSTNAMES` | Exact permitted challenge hostnames, comma-separated; action must be `enquiry` |
| `PRIVACY_NOTICE_APPROVED` | `true` only after adding the company's approved privacy contact and CRM retention/deletion policy to the notice |
| `LEAD_PROVIDER` | `interakt` or `webhook` |

Missing required configuration fails closed. No live endpoint accepts an enquiry without the live security and privacy configuration. Environment changes require redeployment on Sites.

## Option A: Interakt

Set `INTERAKT_API_KEY` to the dashboard API key, **without** another `Basic ` prefix. The server sends `Authorization: Basic <API key>` to the fixed official host. Verify that the actual account/plan has Public API access; it has not been established for this account.

The adapter performs:

1. `POST https://api.interakt.ai/v1/public/track/users/`: identify by Indian phone and `+91`, set contact/project traits and website tags.
2. `POST https://api.interakt.ai/v1/public/track/events/`: record `WebsiteEnquiryReceived` with the same structured traits and unique `website_lead_id` to preserve the history of repeat enquiries.

Traits include name, email, city, project type, collection, brief, consent version, source and timestamp. Calculator enquiries additionally include area, kitchen/pantry, modular storage, waterproofing, server-calculated before/after-GST ranges and the illustrative pricing version. The phone number remains the contact identifier; the site never invents an Interakt user ID. Whitespace is normalized for Interakt's trait restrictions.

Both calls must return an HTTP success with JSON `result: true`. Unknown response schemas fail closed. Confirm the actual account's responses in staging before activating. If the contact is written but its event fails, status is `unknown`, because a partial write has happened. Reconcile manually by `website_lead_id`; do not blindly resend.

An accepted contact/event **does not mean** WhatsApp was delivered, an agent was notified, or the user entered a particular chatbot branch. Configure and verify the desired internal assignment/notification workflow in Interakt separately. No template message API is called. Before enabling an event-triggered campaign, confirm its recipient, template, consent and intended behavior.

Official reference checked 31 October 2026: https://www.interakt.shop/resource-center/user-and-event-track-api/

## Option B: signed CRM webhook

Set all four values:

- `LEAD_WEBHOOK_URL`: exact HTTPS endpoint, no URL credentials/query string; redirects are not followed.
- `LEAD_WEBHOOK_ALLOWED_HOSTS`: approved exact hostname(s), comma-separated. Use a trusted public CRM/owned integration endpoint; do not point to private networks or metadata services.
- `LEAD_WEBHOOK_TOKEN`: bearer secret.
- `LEAD_WEBHOOK_SIGNING_SECRET`: random HMAC key of at least 32 characters.

The server POSTs a JSON envelope:

```json
{
  "id": "unique-server-generated-UUID",
  "createdAt": "ISO-8601 timestamp",
  "contact": {"name":"...", "phone":"10 digits", "countryCode":"+91", "email":"...", "city":"..."},
  "project": {"type":"office", "tier":"Elevate", "message":"..."},
  "source": "calculator",
  "calculator": {"scope":{}, "estimate":{}, "currency":"INR", "pricingVersion":"illustrative-2026-10-31", "isQuotation":false},
  "consent": {"given":true, "version":"enquiry-2026-10-31", "purpose":"Respond to this project enquiry; no marketing opt-in"}
}
```

A direct enquiry has `calculator: null`. The full estimate contains area, base rate, base allowance, itemized optional allowances, subtotal, low/high range, GST rate/amounts and low/high totals. The receiver must validate the bearer token and the HMAC-SHA256 signature over **`timestamp + "." + exact raw JSON body`**, sent as `X-Turnkey-Signature: sha256=<hex>`. Check `X-Turnkey-Timestamp` within a five-minute window using constant-time comparison and deduplicate the `Idempotency-Key` header (same as `id`). Keep receiver credentials and logs private.

Return this only after the CRM durably saves the complete record:

```json
{"accepted":true,"leadId":"the exact incoming id","receiptId":"nonempty CRM record ID"}
```

A generic HTTP 200/204, missing/mismatched ID, redirect, invalid JSON, network timeout or 202 queued response is **unconfirmed**. A queueing connector (Zapier/Make/etc.) needs an owned acknowledgment adapter that waits for the final CRM write; its usual immediate HTTP 200 is insufficient. 400/401/403/404/422/429 are definitive rejections. Other failures are treated as ambiguous to avoid accidental duplicate delivery.

## Verification and launch sequence

1. Add verified company contact/retention details to the privacy notice and approve the demo rate treatment.
2. Use a CRM sandbox/test account and real Turnstile keys restricted to the staging hostname. Do not use actual customer data for initial testing.
3. Configure secrets and origins, deploy, then send one clearly labelled QA enquiry from desktop and one calculator enquiry from a mobile device.
4. Locate each record in the destination. Match reference, name, normalized mobile, email, city, project/collection, message, all scope flags, area, before/after-GST ranges and consent version. In Interakt confirm both the contact and timeline event.
5. Compare the provider acknowledgment to the frontend receipt. Test denied credentials, provider 429, timeout, duplicate click, expired challenge, changed calculator tier and an offline connection. A partial/failed/unknown response must not show success.
6. Confirm staff assignment/notification separately. For a webhook, test signature tampering/replay rejection and receiver-side idempotency.
7. Only after acceptance switch to the intended production credentials/domain. Re-check live delivery, set `ENABLE_TEST_MODE=false`, and change audience/domain only when the owner requests it. No public access change is included in this update.

## Operations and limits

- The browser waits up to 30 seconds; security verification has a 5-second timeout and each provider request an 8-second timeout.
- Status lookup requires the random browser-held request key in a header; there is no public lookup by phone or email. D1 stores only its HMAC.
- A receipt left `processing` for over a minute is shown as `unknown`. There are no automatic retries or background PII queues. Reconcile ambiguous cases in the CRM using the reference.
- Application logs exclude payloads/secrets. Configure the hosting/CRM platforms to avoid recording request bodies and authorization headers. Monitor 5xx, failed/unknown receipt counts and rate-limit spikes using the host's tools.
- Thirty-day receipt expiry is cleaned on subsequent API traffic, not by an unattended scheduled task. Set an operator retention process if stricter timing is required. Rotating `LEAD_HASH_SECRET` invalidates old browser receipt lookups.
- Existing pricing remains illustrative; this change does not authorize prices, tax treatment, marketing campaigns or a public launch.

Turnstile reference: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
