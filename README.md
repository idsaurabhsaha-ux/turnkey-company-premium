# The Turnkey Company — Premium website prototype

A responsive, dependency-free website implementing the approved black architectural direction. Built for `idsaurabhsaha-ux/turnkey-company-premium`.

## Run locally

Requires Python 3 for the preview server and Node.js 20+ for checks. No package installation or build is required.

```bash
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. Serve over HTTP; ES modules do not reliably run by double-clicking `index.html`.

```bash
npm test
npm run check
```

Any static web host can serve `dist/`. `.openai/hosting.json` identifies the associated private Sites preview. The deployed preview is separate from the company's existing domain.

## Included

- Responsive black architectural homepage with restrained brand orange and blue, animated interior imagery, manual Living / Working switches and scroll reveals.
- Existing reverse company logo, preserved as rendered in the company styleboard. Parent company and design partner are credited in text.
- Residential and Office / Commercial collections, each with Essential, Elevate and Premium; detail dialogs and a specification comparison.
- Package inclusion treatment for waterproofing, false ceiling, painting, flooring and electrical / lighting, instead of standalone service pages.
- Two-step budget flow: project scope, then required name, Indian mobile number, email, city and consent. No result is rendered until that form passes validation.
- Area and collection adjustments; optional kitchen / pantry, modular storage and waterproofing; itemised illustrative budget range, separate GST assumption and downloadable estimate.
- Estimate-to-enquiry prefill, validated enquiry form, truthful preparation confirmation and downloadable text brief.
- Clearly marked project-photography and client-testimonial placeholders.
- Mobile menu, keyboard focus styles, native modal focus management, reduced-motion support, pause-motion control and privacy explanation.

## Prototype boundaries

**This version does not send or durably store leads.** Contact details remain in JavaScript memory and clear on page reload / close. Downloads are initiated only by the visitor. There is no CRM, email delivery, tracking, third-party font dependency or analytics integration. No successful-delivery claim is made.

**Calculator values are illustrative, not owner-approved prices.** Edit `dist/calculator.js` to replace demo rates. The base allowance and optional lump-sum allowances are deliberately separate; the UI and export state assumptions, exclusions, ±10% variation and an illustrative 18% GST assumption. The calculator is a front-end UX gate, not an access-control or anti-scraping boundary. Production calculations and lead validation should be server-side.

Package specifications were transcribed from the company brochure styleboards dated 20 October 2026. Final models, quantities, availability and equivalent brands remain subject to the approved project proposal. All interior images are illustrative concepts, not representations of completed client projects. No client quotes, project-completion claims, guarantees, addresses, phone numbers or business metrics were fabricated.

`noindex,nofollow` is intentional for the prototype.

## Files

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Semantic page structure and forms |
| `dist/styles.css` | Responsive styling, motion and print treatment |
| `dist/app.js` | Package data, dialogs, navigation and form flows |
| `dist/calculator.js` | Isolated pricing assumptions and calculation |
| `dist/assets/` | Local optimised imagery and original logo rendering |
| `tests/calculator.test.mjs` | Formula, scope, range and invalid-input tests |
| `ASSETS.md` | Asset provenance and replacement notes |
| `QA.md` | Verification performed and remaining launch work |

## Before accepting real enquiries

1. Confirm package specifications and owner-approved pricing, tax treatment and exclusions.
2. Replace concept / project placeholders with approved project photography, case-study details and consented testimonials.
3. Connect a server-side enquiry endpoint to the chosen CRM / email destination, with validation, spam prevention, failure handling and delivery verification. Do not put service credentials in browser code.
4. Add the company's verified contact information and approved privacy / retention notice. Update the consent and success copy to match actual processing.
5. Test delivery, accessibility and performance on actual target devices; then configure the production domain and remove prototype labels / noindex where appropriate.
