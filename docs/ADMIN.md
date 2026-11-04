# James Reports admin

The admin lives at **`/admin`** on the same site (for example `https://jamesreports.com/admin`). It is a separate app bundle (`admin/index.html` → `src/admin/`), so visitors never download it. It reads and writes Supabase directly with the **publishable** key. Every permission is enforced in the database through row-level security, triggers and role-checked functions. The UI only mirrors those rules.

- [Setup (one time)](#setup-one-time)
- [Roles](#roles)
- [Everyday guide](#everyday-guide)
- [Site ↔ admin coverage matrix](#site--admin-coverage-matrix)
- [How it is built](#how-it-is-built)
- [Security model](#security-model)
- [Verification report](#verification-report)
- [Known limits and blockers](#known-limits-and-blockers)

---

## Setup (one time)

These steps happen in the Supabase dashboard of the **James Reports** project (`zadipaukhnycrjuixxhj`). They need a person signed in to Supabase; nothing here can be done from the website.

### 1. Authentication URLs

**Authentication → URL Configuration**

| Setting | Value |
|---|---|
| Site URL | the production address, e.g. `https://jamesreports.com` |
| Redirect URLs | `https://jamesreports.com/admin/reset-password` · `http://localhost:5174/admin/reset-password` · `http://localhost:4174/admin/reset-password` · your Vercel preview pattern, e.g. `https://*-jreports.vercel.app/admin/reset-password` |

Invitation and password-reset emails send people to `/admin/reset-password`. If an address isn't listed, Supabase falls back to the Site URL and the link won't open the password form.

### 2. Turn off public sign-up (recommended)

**Authentication → Sign In / Providers → Email → "Allow new users to sign up": off.**

Nobody needs to sign up: team members are invited. Even with sign-up on, a self-registered account has **no access**. The admin shows "This account isn't on the team" and the database returns nothing, because access comes only from the `admin_members` table, which visitors cannot write. Turning it off still removes needless accounts.

### 3. Email delivery (SMTP)

**Authentication → Emails → SMTP Settings.** Supabase's built-in sender is for testing only. It sends a handful of emails per hour and only to team addresses. Set up a real provider (Resend, Postmark, SendGrid, Amazon SES…) before inviting people. Otherwise invitations and "forgot password" emails fail with "Too many emails…" or never arrive. Use a sender on your own domain, e.g. `admin@jamesreports.com`.

### 4. Create the first owner

1. **Authentication → Users → Add user → Create new user.** Enter James's (or the site owner's) email and a strong password, and tick **Auto Confirm User**.
2. **SQL Editor → New query**, run:

   ```sql
   select private.grant_owner('owner@example.com');
   ```

   Use the same email. `grant_owner` lives in a private schema, so it can only be run from the SQL editor. It is not reachable through the website or the API.
3. Open `/admin`, sign in, and invite the rest of the team from **Administration → Team**.

### 5. Hosting

- **Vercel:** `vercel.json` already sends `/admin` and `/admin/*` to the admin app and everything else to the public site. It also adds `noindex`, `no-store` and anti-framing headers to `/admin`. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the project's environment variables.
- **Apache / Hostinger:** `public/.htaccess` has the same rules. Upload the contents of `dist/`.
- **Never** add the secret key (`SUPABASE_SECRET_KEY`, `sb_secret_…`) to the host's build variables. The site doesn't use it. The invitation function reads its own key from Supabase's server environment.

---

## Roles

| Role | Can |
|---|---|
| **Viewer** | See everything in the admin except signed talent releases and the audit log. Change nothing. |
| **Editor** | Viewer, plus: create and edit drafts, save changes to live items as drafts, upload images and edit descriptions, triage submissions (status and notes). Cannot publish. |
| **Admin** | Editor, plus: publish, unpublish, archive, delete, change site settings, read talent releases, update pledges, export CSV, read the audit log. |
| **Owner** | Admin, plus: invite people, change roles, remove people. |

Rules the database enforces whatever the UI does:

- Nobody can change or remove their **own** role. The team always keeps **at least one owner**.
- Editors can't change `status` or edit a published row directly. Their edits to live items are stored as drafts, and an admin publishes them.
- Published items can't be deleted (unpublish or archive first). Images in use can't be deleted.
- Saves are **version-checked**. If someone else saved first, you get a "changed since you opened it" message instead of silently overwriting their work.

---

## Everyday guide

### Episodes, reports, archive, sponsors

1. **Content → Episodes → New episode.** Fill in the form. YouTube accepts a full link or the 11-character ID. Chapters take `mm:ss` times. Click **Save draft**. Visitors don't see drafts.
2. **Preview** opens the episode as it will look on the site (`/episodes/<id>?preview=1`). Only signed-in team members can open previews; visitors get "Sign in to preview", and previews are never indexed.
3. An admin clicks **Publish**. It appears on the site on the next page load.
4. To change a **live** item, edit it and **Save draft**. The site keeps showing the published version (the list shows "Unpublished changes") until an admin clicks **Publish changes**. **Discard draft** throws the pending edits away.
5. **Unpublish** takes an item off the site and keeps it as a draft. **Archive** keeps it out of lists for good, and **Restore** brings it back as a draft. **Delete** only works on items that aren't published.
6. **History** (revisions) lists earlier saved versions. **Load into editor** copies one back into the form so you can save it again.
7. Archive interviews and sponsors have a **position** order. In the list, sort by position and use the arrows.

**Sponsors** have two placements: *Sponsor card* (the full-width banner) and *Thank-you block*. The card needs an image, and the thank-you block needs thank-you text. FowenNurses is already set up this way.

### Media library

- **Content → Media library → Upload.** PNG, JPEG, WebP, GIF or AVIF, up to 10 MB. Drag several files at once and each shows its progress.
- Add a **description** (alt text) to every image: screen readers read it aloud, and the overview flags images that lack one.
- **Replace file** swaps the picture everywhere it is used and keeps its description.
- **Delete** is disabled while the image is used. The details panel lists where it is used.
- The photos that shipped with the site are listed as **Site images**. They can be chosen anywhere but not deleted.

### Inbox

**Inbox → Submissions**: Booking & ads, Guest requests, Pledges, Talent releases (admins only), Subscribers.

- Open a row to read the full submission, set its **status**, and keep private **notes**.
- Admins can **Export CSV** of the current filter (up to 5,000 rows). Formulas are neutralised, so the file is safe to open in Excel.
- **Pledges are promises, not payments**: no money is collected online. Mark a pledge *Paid* once the money actually arrives.
- Delete a submission only for spam or when the sender asks.

### Site settings (admins)

| Page | What it changes |
|---|---|
| **Site → Homepage** | Section order and visibility · highlight figures · "Our story" video · coverage timeline · Credits ("appeared on" / "produced for") · Fundraising figures |
| **Site → Header & footer** | Header links (also the footer's Explore column) · announcement bar · social links · footer languages line and Privacy/Terms links |
| **Site → Watch & podcast** | James Reports TV channels, scrolling headlines, premiere slot · Podcast playlists and the uploads playlist |
| **Site → About page** | Introduction, biography paragraphs, facts |
| **Site → Brand & SEO** | Site name, tagline, footer description · default page title and description · booking and advertising emails · **Page images** (home hero, about portrait, booking hero, VIP portrait, guest photo, default episode image) |

Each group saves on its own with **Save**. **Defaults** fills in the values the site launched with, and nothing changes until you save. Leave a fundraising figure empty to hide it. Never publish estimates.

### Team (owners)

**Administration → Team → Invite someone.** Enter the email and choose a role. They receive an email to choose a password. If the person already has an account, they are added without an email. From the row's menu: **Send password link** (for a lost password or an expired invitation) and **Remove from team**.

### Audit log (admins)

Every change by a signed-in team member: content, media, settings, team, and triage. Filter by type, kind of change, person or dates, then expand a row to see *before → after*. Visitor submissions themselves aren't logged, and personal data from forms is never copied into the log.

### Other

- **Ctrl/⌘ + K** opens the command palette: jump to any page, search episodes, reports and sponsors, or create something new.
- **Account**: your display name, password, theme (light, dark or match device), and "sign out other devices".

---

## Site ↔ admin coverage matrix

Every part of the public site, and where it is managed. *Fixed in code* means it is part of the page design (layout, design copy, or a design photo set) and changes through a code edit; the reason is given.

### On every page

| Part | Managed in | Notes |
|---|---|---|
| Flag stripe | Fixed in code | Brand element of the design |
| Announcement bar (on/off, label, text, link) | **Site → Header & footer** | Hidden if settings fail to load (never shows a stale announcement) |
| Logo / wordmark | Fixed in code | Brand artwork. The tagline under it comes from **Brand & SEO** |
| Header links (labels, order, visibility, external links) | **Site → Header & footer → Navigation** | Episodes and Podcast keep their drop-downs |
| Episodes drop-down: topics and counts | Fixed list + **Episodes** | Topics are a fixed vocabulary (database constraint, colours); counts are live |
| Podcast drop-down | Fixed in code | Links to fixed pages |
| VIP Club, Donate, Subscribe buttons | Fixed in code | Link to fixed features |
| Subscribe dialog | Fixed copy · YouTube link from **Social** · sign-ups in **Inbox → Subscribers** | |
| Newsletter band | Fixed copy · sign-ups in **Inbox → Subscribers** | |
| "Request to be a guest" section | Photo: **Brand & SEO → Page images** · copy fixed · requests in **Inbox → Guest requests** | |
| Footer description, © name | **Brand & SEO → Brand** | |
| Footer languages line, Privacy/Terms links | **Header & footer → Footer** | Privacy/Terms show as plain text until a link is set |
| Footer Explore column | Same as header links | |
| Footer Guests / Partners columns | Fixed in code | Links to fixed pages |
| Footer Follow links | **Header & footer → Social links** | Empty links are hidden |
| Browser tab title, meta description | **Brand & SEO → Search engines**; per episode in **Episodes** | |
| Social-share preview (Open Graph tags) | Fixed in `index.html` | Crawlers don't run JavaScript; making these editable needs pre-rendering (see blockers) |
| "Some site information couldn't be loaded" notice | System | Shown if settings fail to load |

### Home

| Part | Managed in |
|---|---|
| Section order and visibility | **Site → Homepage** |
| Hero: latest episode | **Episodes** (newest published by date) |
| Hero: host photo | **Brand & SEO → Page images → Home hero** |
| Hero: highlight figures | **Site → Homepage** |
| Hero: "Host · James Pierre" card | Fixed in code (design copy) |
| "James has appeared on" | **Site → Homepage → Credits** |
| "Our story" video, title, text | **Site → Homepage** |
| Recent episodes | **Episodes** |
| Latest on the podcast | **Externally managed: YouTube.** Uploads playlist chosen in **Watch & podcast** |
| On the record (reports) | **Reports** |
| Coverage history timeline | **Site → Homepage** |
| Fundraising figures | **Site → Homepage → Fundraising** (hidden when empty) |
| Fundraising headline, quick amounts | Fixed in code (design copy) |
| From the archive | **Archive** |
| Sponsor card and thank-you block | **Sponsors** |

### Other pages

| Page | Managed in | Fixed in code (why) |
|---|---|---|
| Watch | Channels, headlines, premiere slot: **Watch & podcast**. Videos: **YouTube** | Program-guide times are computed from the clock |
| Podcast | Playlists and uploads: **Watch & podcast**. Videos: **YouTube** | Intro copy (design) |
| Episodes list | **Episodes** | Topic and language filters (fixed vocabularies) |
| Episode page | All episode fields, image and SEO: **Episodes**. Default image: **Page images**. Supporters line: **Fundraising** | "Transcript" box copy (design; transcripts aren't stored yet) |
| Reports | **Reports** | |
| Archive | **Archive** | |
| About | Intro, paragraphs, facts: **About page**. Portrait: **Page images** | Awards section copy and photos, gallery (design photo set) |
| Booking | Hero photo: **Page images**. Clients: **Credits**. Emails: **Brand & SEO → Contact**. Requests: **Inbox → Booking & ads** | Service cards, ad products, how-it-works, gala gallery, stats strip (design copy and photos) |
| Support (donate) | Pledges: **Inbox → Pledges** | Amounts and copy. **Payments are blocked**: no provider connected |
| VIP Club | Portrait: **Page images**. Pledges: **Inbox → Pledges** | Tiers and benefits (design) |
| Guest request | Requests: **Inbox → Guest requests** | Copy |
| Talent release | Signatures: **Inbox → Talent releases** (admins) | Legal text is versioned in code (`terms_version`), on purpose |
| 404 | Fixed in code | |

---

## How it is built

| | |
|---|---|
| App | React 19 + TypeScript, React Router 8, separate Vite entry (`admin/index.html`) |
| UI | Tailwind CSS v4 (loaded only in the admin), shadcn/ui on Radix, Lucide icons, sonner toasts, cmdk palette |
| Data | `@supabase/supabase-js` (auth, storage, functions) + TanStack Query |
| Forms | React Hook Form + Zod, the same rules the database checks |
| Theme | Light / dark / system, saved per browser, applied before first paint |

```
admin/index.html                  admin entry (noindex)
src/admin/main.tsx                providers: theme, query client, router, toasts
src/admin/router.tsx              routes; everything behind <RequireTeam>
src/admin/nav.ts                  sidebar groups, filtered by role
src/admin/lib/                    supabase client, auth, permissions, data hooks, errors, format, theme
src/admin/components/             shell, sidebar, header, command palette, forms, media picker, ui/ (shadcn)
src/admin/collections/            the list + editor framework and the four content definitions
src/admin/routes/                 overview, media, inbox, site settings, team, audit, account, auth pages
src/lib/siteConfig.ts             settings shape + launch values, shared with the public site
src/lib/preview.ts                public-site draft preview (team session only)
supabase/functions/admin-invite/  owner-only invitation function
```

Database (see `supabase/migrations/`):

| Migration | Adds |
|---|---|
| `…_admin_foundation` | `admin_members` + role functions · `status`/`version` on content · `content_drafts`, `content_revisions` · `audit_log` + triggers · `media_assets` + public `media` bucket · `sponsors` · `site_config` with server-side validation · team policies on submissions · `admin_publish`, `admin_set_member_role`, `admin_remove_member`, `admin_update_profile`, `admin_media_usage`, `admin_dashboard`, `private.grant_owner` |
| `…_admin_seed` | Moves the site's existing images, the FowenNurses sponsor and every hard-coded setting into the database (nothing replaced with sample data), then drops the old `site_settings` table |
| `…_admin_add_member` | `admin_add_member`, used by the invite function |

---

## Security model

- **Authentication**: Supabase Auth with email and password. Sessions are stored in the browser under `jr-admin-auth`. An expired session sends you back to sign in.
- **Authorization lives in the database.** `private.has_role()` reads `admin_members`. Each table's policies and each `admin_*` function check it. Hiding a menu item is never the protection: a direct URL shows "You don't have access", and the data request is refused anyway.
- **No self-escalation**: role changes go only through `admin_set_member_role` and `admin_remove_member`, owner-only, never on yourself, never removing the last owner. `admin_members` has no insert, update or delete grants.
- **Public sign-up can't create staff**: a new account has no `admin_members` row, so it gets nothing.
- **Secrets**: the browser only ever has the publishable key. The invitation function uses the service key from Supabase's server environment, after checking that the caller is an owner. It then adds the member *with the caller's own token*, so the database re-checks the role and the audit log records who did it.
- **Storage**: the `media` bucket is public to read. Uploads and replacements need the editor role, deletions need admin. Type and size limits are enforced by the bucket.
- **Previews**: the public site reads the admin session token from the same origin's storage and queries as that team member. Row-level security decides what it sees, so visitors get nothing.
- **Hosting headers**: `/admin` is `noindex`, `no-store` and can't be framed.
- The Supabase security advisor lists the public form functions and the `admin_*` functions as "callable". **This is intended**: the form functions are the public endpoints, and every `admin_*` function checks the caller's role first.

---

## Verification report

Run on 2026-11-03 against the live project. Everything below was actually run.

| Check | Result |
|---|---|
| `npm run typecheck` | Pass |
| `npm test`: 4 files, 66 tests | **66 passed**. Covers: role matrix, role-filtered navigation, route guards (signed out → sign-in, non-member refused, direct link to a forbidden page refused, admin allowed), error mapping, content helpers, episode and sponsor validation, CSV formula neutralising, search escaping, overview ranges, audit display, the public site with admin settings (section order and visibility, announcement, header links, load-failure notice with no stale figures, sponsors from data, empty sponsors), draft preview without a session, preview token expiry, settings merge |
| `npm run build` | Pass (public + admin bundles). Build output scanned: no secret key, and no admin code in the public bundles |
| Row-level security matrix (rolled-back transaction, simulated roles) | Pass: editor can't publish or edit live rows directly; visitor sees only published rows; outsider sees nothing; viewer is read-only; stale version → conflict; owner can't demote themselves |
| Live API as an anonymous visitor | Refused: `admin_dashboard`, `admin_add_member`, reading the inbox, team, audit log and drafts, writing `site_config`, uploading to `media`, calling `admin-invite` without a token or with only the publishable key. `grant_owner` isn't exposed. Unpublished episodes aren't returned |
| Supabase security advisor | Only the intended "callable function" warnings above |
| Public site in the production build (`npm run preview`) | Home reads announcement, navigation, sponsors, hero image, timeline and fundraising from the database; no console errors |
| No horizontal overflow at 360, 390, 768, 1024, 1440 px | Pass for `/`, `/about`, `/booking`, `/watch`, `/podcast`, `/episodes`, `/admin/login` (and `/admin/forgot-password` at 360) |
| Admin when signed out | `/admin` redirects to `/admin/login`; page is `noindex` |

**Not yet verified in a browser:** the signed-in admin screens (overview, editors, inbox, settings, team, audit), uploads through the UI, and invitation email delivery. These need the first owner account from [step 4](#4-create-the-first-owner), plus SMTP for emails.

---

## Known limits and blockers

| Item | Status / what's needed |
|---|---|
| First owner account | **Needs a person**: steps 1–4 above |
| Invitation and reset emails | **Needs SMTP** (step 3). The built-in sender is heavily rate-limited |
| Payments | **Blocked**: no payment provider. Donations and VIP sign-ups are pledges |
| Social-share previews | Fixed in `index.html`. Per-page previews need pre-rendering or a server |
| Visitor analytics | None connected. The overview shows real submission counts only, never invented traffic |
| Transcripts | The episode page's transcript box is design copy; transcripts aren't stored yet |
| Admin bundle size | One ~830 KB chunk (~230 KB gzipped), loaded only at `/admin`. Can be split per page later |
| Same-origin admin | The admin shares the site's origin, which makes previews work. Moving it to a subdomain would need a different preview mechanism |
