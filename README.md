# James Reports with James Pierre

The website for **James Reports**, the independent interview and reporting channel of 4-time Emmy Award winner James Pierre. It is built from the Claude Design project *James Reports Platform Design* (`James Reports.dc.html`), which is kept unchanged in [`design-source/`](design-source/).

Pages: Home · Watch (James Reports TV) · Podcast · Episodes (+ each episode) · Reports · Archive · About · Booking (events and advertising) · Support (donations) · VIP Club · Guest request · Talent release form.

## Stack

| | |
|---|---|
| UI | React 19 + TypeScript, built with Vite 8 |
| Routing | React Router 8 (one URL per page; pages load on demand) |
| Data | Supabase Postgres via `@supabase/postgrest-js` (no auth needed) |
| Tests | Vitest + Testing Library (jsdom) |

**Why not keep the `.dc.html` file?** The design file runs on the design tool's runtime (`support.js`), which downloads React and the 3 MB Babel compiler from unpkg and compiles the page inside every visitor's browser. It also has no URLs (refreshing always returns to Home) and can't be tested. The page was already a React component, so it is now the same React code, compiled ahead of time. Every section's styles are copied from the design file as-is (the `sx()` helper reads the design's CSS strings), so the two can be compared line by line.

## Getting started

Requires Node 20.19+ (tested with Node 24).

```bash
npm install
cp .env.example .env.local   # then fill in the two VITE_ values
npm run dev                  # http://localhost:5174
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Typecheck, then build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run the test suite once |
| `npm run typecheck` | TypeScript only |
| `npm run images` | Rebuild the responsive WebP copies after adding a file to `public/assets/` |

### Configuration

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | The **publishable** key (`sb_publishable_…`). Safe to ship. |
| `SUPABASE_SECRET_KEY` | never the browser | Only for admin scripts. Never prefix it with `VITE_`. |

Without the two `VITE_` values the site still loads, but lists show a "couldn't load" message and forms report that they aren't connected.

## Deploying

`npm run build` produces a static site in `dist/`. Upload it to any static host.

- **Apache / Hostinger shared hosting:** upload the *contents* of `dist/` to `public_html/`. `public/.htaccess` is copied into `dist/` and sends every page URL to `index.html`, so links like `/episodes/ep-48` work after a refresh.
- **Netlify / Vercel / Cloudflare Pages:** build command `npm run build`, output `dist`, and add a single-page-app fallback rewrite (`/* → /index.html`).
- The `VITE_` variables are read at **build** time; set them in the host's build settings or in `.env.local` before building.

## Supabase

Project: **James Reports** (`zadipaukhnycrjuixxhj`). Schema lives in [`supabase/migrations/`](supabase/migrations/) and is already applied.

| Migration | Creates |
|---|---|
| `…_content_schema` | `episodes`, `reports`, `archive_items`, `site_settings` (public read of published rows only) |
| `…_submissions` | `newsletter_subscribers`, `booking_requests`, `guest_requests`, `talent_releases`, `support_pledges`, plus one validating function per form |
| `…_seed_design_content` | The design's episodes, reports, archive and ticker text |

**Security model.** Visitors use the publishable key, which maps to the `anon` role.
- Content tables: `anon` may only `SELECT` published rows. Insert/update/delete privileges are revoked.
- Submission tables: RLS is on with **no policies** and all privileges revoked, so visitors can neither read nor write them directly.
- Each form calls a `SECURITY DEFINER` function (`subscribe_newsletter`, `submit_booking_request`, `submit_guest_request`, `sign_talent_release`, `submit_support_pledge`). Each one validates every field again on the server, rejects bot submissions (hidden honeypot field), limits repeats to 5 per email per hour (10 for releases), and returns a server-made reference such as `JR-2601`.
- The Supabase advisor reports these functions as "callable by anon" and the tables as "RLS enabled, no policy". **Both are intentional**: they are the public form endpoints, and the tables are deliberately closed.
- `talent_releases` stores personal data (date of birth, address, signer IP). Keep dashboard access limited to the team.

### Day-to-day editing (Supabase dashboard → Table editor)

- **New episode:** add a row to `episodes`. Set `youtube_id` (the 11-character video id) to get an on-page video player, and/or `audio_url` (HTTPS audio file) to get the site's audio player. Play buttons only appear on episodes that have one of these. `chapters` is a JSON list like `[{"at": 252, "label": "Where things stand today"}]`. Set `is_published = false` to hide a row.
- **Reports:** add rows to `reports`. Give `url` to make the card link to the full piece.
- **Ticker and fundraising:** edit the single `site_settings` row. `raised_cents` and `supporters_count` are **empty on purpose**. The home page shows the progress bar and supporter count only once real figures are entered.
- **Submissions:** read and triage them in `booking_requests`, `guest_requests`, `talent_releases`, `support_pledges` and `newsletter_subscribers` (each has a `status` column where relevant).

## What changed from the design, and why

| Design | Now | Reason |
|---|---|---|
| Forms showed a random reference and "success" without saving | All seven forms save to Supabase and show the server's reference | Real data |
| Donate and VIP "charged" money and asked for card numbers | They save a **pledge** (`support_pledges`, status `pending_payment`). The page says plainly that no payment was taken and that the team will follow up. No card fields. | No payment provider is connected. Collecting card numbers ourselves would be unsafe. |
| Audio player advanced a timer with no audio | Real `<audio>` playback: seek, keyboard slider, speed, errors | Honest playback. Shown only for episodes with `audio_url`. |
| "A copy is on its way to your inbox", "Media kit sent to your inbox" | Removed. The release offers a printable copy; the media kit button opens an email to ads@jamesreports.com | No email service is connected |
| Fundraising $8,420 / 684 supporters | Hidden until set in `site_settings` | Those were the design tool's placeholder values |
| `<image-slot>` editor widget | Responsive `<picture>` (WebP copies + original as fallback). The hero photo that existed only in the editor's sidecar file is now `public/assets/hero-james.webp`. | The editor script only works inside Claude Design |
| No URLs, no mobile menu, placeholder-only inputs | Real routes, mobile menu below 1260 px, labelled inputs with inline errors, focus management, `<dialog>` for Subscribe, skip link, reduced-motion support | Accessibility and usability |
| Grey `#8A8A8A` small text | `#6B6B6B` | Meets WCAG AA contrast |

## Open items (need a decision or a service)

1. **Payments.** Connect a provider (Stripe recommended for card, Apple Pay and Google Pay; PayPal separately), then turn pledges into real checkouts. Zelle and Cash App need the team's account details.
2. **Email.** Confirmation and receipt emails need a provider (e.g. Resend) and an Edge Function.
3. **VIP member access.** Early access and members-only content need sign-in, which the design does not include.
4. **Real catalogue.** The 10 episodes and 6 reports are the design's examples. Replace them and add `youtube_id` / `audio_url`.
5. **Privacy policy and terms.** The footer shows "Privacy" and "Terms" as plain text, as in the design. A policy page is needed since the site collects personal data.
6. **Spam.** Honeypot plus per-email throttling only. Add Cloudflare Turnstile if spam appears.

## Project layout

```
design-source/            original Claude Design export (reference only, not deployed)
public/assets/            images; opt/ holds the generated WebP sizes
scripts/                  optimize-images.mjs
src/components/           layout, header, player, subscribe dialog, shared UI
src/lib/                  api (Supabase), validation, formatting, types, sx()
src/pages/                one file per page
src/test/                 Vitest suites
supabase/migrations/      schema, functions, policies, seed
```
