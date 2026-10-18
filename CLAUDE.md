# GCDOC Portal — briefing for AI assistants

Admin portal for **GCDOC** (Gem City Dog Obedience Club, gcdoc.com) — tracks members, volunteer hour logs, dues, meetings and vouchers. Vue 3 + Pinia + Vite, Firebase (Auth + Firestore), hosted on Netlify. Roadmap and design history live in [PLANNING.md](PLANNING.md) — read it before starting anything larger than a bug fix. (README.md is still the stock Vue template; ignore it.)

## Who uses what — read this first

- **Only one person logs into the portal: the admin (`reallyjustsam@gmail.com`, the owner of this repo).** Member portal accounts were sunset. Don't build member-facing portal features, member sign-up/login flows, or UI copy that tells members to "sign in to the portal".
- The only other account is **`kiosk@gcdoc.com`**, a shared check-in terminal at the club. It is locked to `/kiosk` (members check in/out there; no member login involved).
- **Members interact only through the WordPress site** (gcdoc.com) via the plugin in `wordpress-plugin/gcdoc-member-hours/`. Shortcodes: `[gcdoc_hours]`, `[gcdoc_dues_owed]`, `[gcdoc_member_directory]`, `[gcdoc_log_hours]`, `[gcdoc_voucher]` (lookup/redeem + the member's own unused vouchers to reprint; also standalone as `[gcdoc_my_vouchers]`), `[gcdoc_voucher_issue]` (club admins issue trial / instructor-CSV / one-off vouchers).
- **Admin PIN** (`GCDOC_ADMIN_PIN` in wp-config, falls back to the older `GCDOC_VOUCHER_PIN`): the one shared PIN that unlocks club-admin actions on the WP site for a device (cookie), alongside WP Administrators. Gate new admin-only plugin features with `gcdoc_admin_actor()` rather than inventing another PIN.
- **WordPress ↔ portal link is by email only** (the WP account's `user_email`, never the WP username or user ID). The plugin calls Netlify functions in `netlify/functions/` with a shared secret; those look up `members` / `logs` in Firestore by email. If a member's email changes, it must be changed in both the portal and their WP account.

## Retired — don't use or rebuild

- **`dogs` collection / member-dogs feature** — removed 2026-10-12. The Firestore docs and the `dogs` rule still exist but nothing reads them. Don't add code that uses `dogs`.
- **Classes / registration module** (`classStore`, `ClassDashboard`, `RegistrarView`) — removed. The `classes` rule is leftover.
- **Member portal accounts**, email-link sign-in, registrar/teacher roles — removed.

## Data model (Firestore)

- **`members/{email}`** — doc ID is the **lowercased email**; it's the member ID used everywhere. Key fields: `Email`, `FirstName/LastName` (+ `FirstName2/LastName2` for joint members), `MembershipType` (`Regular`, `Lifetime`, `Family`, `Associate`, `Applicant`, `Inactive`, `Nonmember`; legacy `Household` = `Family`), `Joined`, `VotedInDate`, `Dues2026Paid`/`Dues2026PaidAt` (dues year is hard-coded as `DUES_YEAR` in `membersStore.js`), applicant checklist booleans (`APPLICANT_CHECKLIST`), `roles` (admin).
  - **`members/{email}/changelog/{id}`** — append-only history (event types documented at the top of `src/stores/membersStore.js`). Every member write that changes status/dues/applicant steps also writes a changelog entry in the same batch — keep doing that.
- **`logs`** — volunteer hour entries keyed to the member by `MemberEmail`. `Hours` = credited hours (multiplied), `clockHours` = real time. Types: Standard (1x), Cleaning/Maintenance (2x + counts toward Blue Ribbon vouchers), Trial Setup/Teardown (2x). `Status`: `active` (checked in at kiosk) → `pending` (awaiting admin approval) → `approved`. `SourceSheet` records origin (`kiosk`, `wp-plugin`, a sheet ID…).
- **`vouchers/{code}`** — voucher card ledger, `memberEmail`, `type` (`class` service / `blue` Blue Ribbon), status `created → printed → handed_out → used`. **`printed` is labelled "Published" everywhere in the UI** (stored value kept to avoid a migration): members see a voucher on the website only once it's published, and only unpublished (`created`) vouchers can be deleted. Rules in `src/utils/vouchers.js`.
- **`sheets`** — uploaded paper sign-in sheets.
- **Fiscal year runs Oct 1 – Sep 30.**

### Changing a member's email

Because email is the doc ID and logs/vouchers reference it, never just edit the `Email` field. Use `transferMemberEmail` in `membersStore.js` (wired to "Change Email" on the Edit Member page and "Update User Email" in Data Tools). It copies the member doc + changelog to the new ID, rewrites `logs.MemberEmail` and `vouchers.memberEmail`, and **keeps the old doc, marked `Inactive` with `MovedToEmail`** (by the owner's choice — do not change it back to deleting).

## Gotchas

- **Dates:** date-only strings (`YYYY-MM-DD` from `<input type="date">`) must be parsed as local time — use `parseLocalDate` / `todayLocalIso` from `src/utils/dates.js`, never `new Date('YYYY-MM-DD')` or `toISOString()` for dates. This bug previously shifted logs a day early and into the wrong fiscal year.
- **Firestore rules** live in `firestore.local`, which is **gitignored** — changes there must be published to Firebase by hand; tell the owner when a rule change is needed.
- **Dues amounts** are calculated only in PHP (`gcdoc_calculate_dues()` in the WP plugin); the portal records paid/unpaid only.
- Netlify functions need env vars `FIREBASE_SERVICE_ACCOUNT_JSON` and `REPORT_API_SECRET`; the WP plugin's matching endpoint/secret constants are defined in `wp-config.php` (see the top of the plugin file).
- Batched writes: stay under Firestore's 500-op batch limit (existing code chunks at 200–400).
- There is no test suite yet (Vitest is installed, `npm run test:unit`, but no tests exist). Verify changes with `npm run build`.

## Working conventions

- Commands: `npm run dev`, `npm run build`. Deploys happen via Netlify on push.
- Match the surrounding style: plain JS (no TypeScript), `<script setup>` SFCs, scoped CSS, short "why" comments.
- Don't commit unless asked. When finishing a roadmap item, update PLANNING.md.
