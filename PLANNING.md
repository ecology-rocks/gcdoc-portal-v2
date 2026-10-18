# GCDOC Portal — Planned Changes

_Last updated: 2026-10-01_

Roadmap ordered by dependency (each phase simplifies the next), not by original request order.

## Completed

### Phase 1 — Sunset unused features ✅
Classes/Registration module fully removed (`classStore.js`, `ClassDashboard.vue`, `RegistrarView.vue`, dead nav links). Member-dogs feature (`DogManager.vue`, `DogModal.vue`, `dogStore.js`, Dogs import/export tab) also sunset and removed 2026-10-12; existing `dogs` Firestore docs and rule left in place, unused. Member portal accounts sunset — only admin (`reallyjustsam@gmail.com`) and the `kiosk@gcdoc.com` terminal have accounts now; email-link sign-in and registrar/teacher roles removed from `authStore.js` and `Login.vue`.

### Phase 2 — Hours tracker in the WordPress plugin ✅
`netlify/functions/member-log-submit.js` + `[gcdoc_log_hours]` shortcode let members self-log hours from WordPress, landing in the existing approval queue with `SourceSheet: "wp-plugin"`.

### Phase 4 — Dues tracking ✅ (mostly)
Went further than originally scoped — this one's essentially done, not just started:
- `Dues2026Paid` / `Dues2026PaidAt` fields on the member doc, with a toggle badge + "2026 Dues Unpaid Only" filter + Paid/Outstanding/Total summary bar in `MemberManager.vue`
- Paid status now surfaces on the WP shortcodes (`[gcdoc_hours]`, new `[gcdoc_dues_owed]`), with "Pay Your Dues" / "Enter Missing Hours" buttons that disappear once marked paid
- `VotedInDate` field + automatic dues exemption (voted in after July 1 → no dues owed for the cycle starting the following Oct 1), computed in `member-report.js`, only applies when a date is actually on file
- **Still open**: `gcdoc_calculate_dues()` only exists in PHP (`gcdoc-member-hours.php`) — never got ported to a shared JS util, so the portal has no way to independently compute/display a dues amount itself. Low priority since nothing in the portal needs that today, but flagged here so it doesn't get lost.

## Phase 3 — Member changelog + log compression (changelog built; compression not yet built)

Current state is a band-aid, not a real data model. `MembershipType` is a single mutable string field on the member doc (`Active`/`Inactive`/etc. — no history of *when* someone went inactive or why), so the portal can only ever show "current status," never "was this person an active member in FY2023?" The Members view now hides `Inactive` by default via a UI filter (`src/modules/members/MemberManager.vue`), which solves today's clutter problem but doesn't solve historical reporting. Separately, `src/stores/logsStore.js` pulls the *entire* `logs` collection into memory via a live listener for every admin session — fine today, but unbounded growth over years is a real future cost/performance problem.

**Design (settled 2026-10-01)**: `members/{email}` stays the single source of "current state" exactly as today — no parallel per-year snapshot collection. Add one append-only subcollection per member, `members/{email}/changelog/{id}`, of typed event docs:

```
{ date, type: "status_change", from: "Applicant", to: "Regular", note: "" }
{ date, type: "dues_payment", fiscalYear: 2025, amount: 50 }
{ date, type: "dues_exempt", fiscalYear: 2026, reason: "voted-in" }
{ date, type: "fy_summary", fiscalYear: 2023, totalHours: 180, stdVouchers: 7, blueVouchers: 2 }
{ date, type: "note", text: "Moved to Florida" }
```

The changelog is pure history — it never overrides "current." Every existing place that updates the member doc (status dropdown, dues toggle) also appends one changelog entry alongside its existing write.

**Log compression**: a deliberate "Close out FY" admin action (not automatic) that, per member: sums that FY's `logs` into one `fy_summary` changelog entry, exports the detailed logs for that FY to CSV (reusing the existing `CsvImporter.vue` export pattern) as a backup, then deletes those `logs` docs from Firestore — keeping the live collection bounded to recent years while still answering "how many hours in 2023."

**Known gap**: no historical backfill for years before this ships (old MembershipType/dues history isn't reconstructable from current data).

**Archival records reviewed (2026-10-01)**, at `Z:\My Drive\GCDOC\GCDOC Membership\Archival Records` — a messy mix overall (dues-deposit batches keyed by name only, no stable match key, patchy year coverage), but a few genuinely clean, usable snapshots turned up:
- `2025 End of year PDF.pdf` (pulled 10/3/2025) — best source found: full active roster with Member Type, closed-out FY2025 hours total, email, and original "Became Member" join year. ~175-190 members. Strong candidate to seed FY2025 `fy_summary` + `status_change` changelog entries once this phase is built. (`2025 membership database.pdf` is a near-duplicate of this, pulled 2 days earlier — skip it.)
- `Backup of Qry - Active member mailing with phone email.xlk` (actually .xlsx, just renamed; Dec 2017) — 194 active members with name/email/phone/Member Type, no hours.
- `Gem City Agility Club Membership List_2015...xlsx` (2015) — ~230-240 rows, contact info only, membership type would need color-coded legend extraction (extra work).
- Rough club-size trend from these three alone: ~230-240 (2015) → 194 active (2017) → ~175-190 with logged hours (2025). Caveat: the 2025 figure may undercount members with exactly 0 logged hours, since it's an hours-report pivot.
- Everything else in that folder (dues-deposit batches, meeting-count sheet, applicant cleanup sheet, 2014 directory docs) was judged not worth importing for this phase — name-only matching risk or off-topic.
- Not yet imported anywhere — this is just a scouted inventory for when the changelog system is actually built.

**Changelog built (2026-10-12)** — the history half of this phase is done; log compression is not:
- `members/{email}/changelog/{id}` subcollection, append-only. Helpers + event types documented at the top of `src/stores/membersStore.js`. Each entry has `date`, `type`, `by` (admin email) plus type fields.
- Event types shipped: `status_change {from, to, note}`, `dues_payment {duesYear}`, `dues_payment_reversed {duesYear}`, `email_change {from, to}`, `applicant_step {field, label, done}` (applicant checklist boxes, list in `APPLICANT_CHECKLIST`), `note {text}`. Dues entries record paid/unpaid only — no dollar amount, since dues calc still lives only in PHP (see Phase 4 "still open").
- Written in the same batch as the member update in: `addMember`, `updateMember` (only when `MembershipType` actually changes; optional "Reason for type change" field on the edit form), `setDuesPaid`, `importGenericRows` (new members + type changes), `transferMemberEmail` (copies the whole changelog to the new email and logs the change; the old member doc is kept, marked `Inactive` with `MovedToEmail`).
- UI: "History" panel on the Edit Member page (`src/modules/members/components/MemberChangelog.vue`) with manual "Add Note".
- Firestore rule `members/{memberId}/changelog/{entryId}`: read/create/delete for admin, no update. Lives in `firestore.local` (gitignored) — must be published to Firebase.
- `fy_summary` / `dues_exempt` types are designed but not emitted yet — they belong with the close-out action.

- Not yet built: the FY close-out/export/delete admin action (would emit `fy_summary`), and the one-time FY2025 seed from `2025 End of year PDF.pdf`
- Worth doing before Phase 4 (Attendance) and Phase 5 (Vouchers) if possible, since both would naturally emit their own changelog event types (attendance eligibility determinations, voucher issuance/redemption) rather than inventing separate history mechanisms

## Phase 4 — Attendance tracking for board eligibility

Today attendance is only implicit via logged hours — no record of "did they attend meeting X." Needs real schema.

- New Firestore collection `meetings`: `{ id, fiscalYear, date, label }` — 5 per FY, created by admin
- New Firestore collection `attendance` (or subcollection under `meetings`): `{ meetingId, memberEmail, attended: true, recordedAt }`
- Extend `src/modules/admin/AttendanceSheet.vue` / `src/modules/admin/MeetingView.vue` so checking a name off on the sign-in sheet writes an attendance record tied to a specific meeting, instead of just printing a sheet
- New computed eligibility view: e.g. "attended ≥ 2 of 5 meetings this FY" per member, surfaced in `MeetingView.vue` or a new "Board Eligibility" panel — confirm actual threshold rule before building

## Phase 5 — Voucher system + distribution tracking (first version built 2026-10-12)

**Built**: rules centralized in `src/utils/vouchers.js` (service: credited hrs ≥50 → 1 per 25, floor; blue: cleaning clock hrs, 1 per full 8, floor; Regular/Family/Lifetime earn, Applicants pending until voted in, Associate/Inactive none). `vouchers/{code}` ledger (`src/stores/vouchersStore.js`) with status created → printed → handed_out → used; "Create cards for earned vouchers" (add-only sync), manual issue for instructors/trial workers, Vouchers report page, 10-up cardstock print page with QR codes (`VoucherPrint.vue`), and website redemption via `[gcdoc_voucher]` + `netlify/functions/voucher-redeem.js` (WP Administrators or optional shared `GCDOC_VOUCHER_PIN`). Pre-existing handwritten vouchers stay valid and untracked. Hand-issued sets (`TrialVoucherIssuer.vue`, `InstructorVoucherIssuer.vue`): trial workers get Blue Ribbon vouchers per day by role (presets for Agility/Obedience/Conformation and Barn Hunt, editable); instructors, from the registrar's CSV, get 1 Blue Ribbon voucher per class at 5+ of 7 weeks plus 1 Standard (1x) service hour per week attended (hours even under 5 weeks), counted toward a manually chosen FY (e.g. Session 5 2026 → FY27; log date clamped into that FY). Print layout: two 5-card columns per page, members with 5+ cards get their own column(s). Pending board decision: 150+ hrs → 1 year of free classes instead of class vouchers.

**Website voucher tools (2026-10-18)**: the voucher PIN became a general **admin PIN** (`GCDOC_ADMIN_PIN`, falls back to `GCDOC_VOUCHER_PIN`; same cookie, so unlocked devices stay unlocked) checked by `gcdoc_admin_actor()`. `[gcdoc_voucher]` now also lists the logged-in member's published, unused vouchers with per-card checkboxes to reprint at home — reprinting doesn't change status, since the code is the voucher (`netlify/functions/member-vouchers.js`; also `[gcdoc_my_vouchers]`). New `[gcdoc_voucher_issue]` page lets admins/PIN holders (e.g. the registrar, without the portal) issue trial-worker, instructor and one-off sets, mirroring the portal issuers via `netlify/functions/voucher-issue.js`. Instructors take the registrar's CSV upload, with server-side name matching and a review step; a session name used before only warns, like the portal (a session can arrive as several files, e.g. one per sport), and is re-checked at issue time with an "issue anyway?" confirm. Each upload gets its own setId (`instructors-<session>-<timestamp>`) so its print page shows only that file's cards. After issuing, the set's page (`?gcdoc_set=…`, reopenable) can print, **Publish**, or **Delete this set** while nothing in it is published. Instructor hours from the website go in as `Status: 'pending'` (approval queue), unlike the portal issuer's approved hours; deleting a set leaves its hours for the admin to review.

**"Printed" → "Published" (label only, 2026-10-18)**: stored status stays `printed`, shown as Published in the portal (Vouchers page, Print page) and website. Members' website list shows only published (`printed` / `handed_out`) cards, so a mistaken set stays hidden while it can still be deleted. Portal Vouchers page has "✓ Publish" per member and per hand-issued set (publishing without printing), and tags website-issued sets. Sets carry `set.issuedFrom: 'website'` and `createdBy` = WP display name or "PIN (website)".

_Original plan notes:_

`src/stores/logsStore.js` already *computes* voucher counts a member has earned (`vouchersByMember`: 1 per 25 hrs once ≥50 hrs/FY; `blueVouchersByMember`: cleaning clock hours / 8) but nothing tracks whether an earned voucher has actually been **issued/handed out or redeemed**. Needs a real ledger, not just a derived count.

- New Firestore collection `vouchers`: `{ id, memberEmail, fiscalYear, type: "service" | "blue", status: "earned" | "issued" | "redeemed", earnedAt, issuedAt, issuedBy, redeemedAt, redeemedFor }`
- Reconciliation job/admin view that diffs "earned" counts (from `logsStore` getters) against existing voucher-ledger records per member/FY, and generates the missing `vouchers` docs in `status: "earned"` so nothing has to be entered by hand from scratch
- **Distribution UI** (new admin view, e.g. `VoucherManager.vue`): list members with outstanding earned-but-not-issued vouchers, mark as issued (who/when), and mark as redeemed (what it was used for — e.g. trial entry, merchandise)
- Decide the redemption model: vouchers redeemed against trial fees/entries elsewhere in the club's process, so this may just need a "redeemed" flag + note field rather than integration with a payment system
- Optional later: show a member's voucher balance (earned vs. available) on the WP plugin dues/hours shortcode, same pattern as the dues estimate
