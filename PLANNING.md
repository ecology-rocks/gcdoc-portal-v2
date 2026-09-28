# GCDOC Portal — Planned Changes

_Last updated: 2026-09-27_

Roadmap ordered by dependency (each phase simplifies the next), not by original request order.

## Phase 1 — Sunset unused features

Do this first — it simplifies everything else.

### Classes/Registration module (full removal)
- Routes: `/classes`, `/registrar` in `src/router/index.js`
- Components: `src/modules/classes/ClassDashboard.vue`, `src/modules/admin/RegistrarView.vue`
- Store: `src/stores/classStore.js`
- Nav links/dividers in `src/layouts/AppLayout.vue` (teacher/registrar sections)
- Role checks tied to `teacher`/`registrar` in `src/stores/authStore.js`
- **Check first**: confirm `src/modules/members/components/DogManager.vue` / `DogModal.vue` aren't purely class-registration artifacts vs. a general "member's dogs" feature to keep.
- Leave the `classes`/`dogs` Firestore collections alone (stop reading/writing, don't delete data) unless purge is confirmed.

### Member portal accounts (sunset individual logins)
- Only admin (+ kiosk) should have accounts going forward.
- Remove email-link sign-in flow and `member`/`teacher`/`registrar` login paths in `src/stores/authStore.js` and `src/views/Login.vue`
- Simplify router guards in `src/router/index.js` to just `admin` vs `kiosk` vs public
- Keep the hardcoded `kiosk@gcdoc.com` password account and `src/views/KioskView.vue` as-is — stays as the walk-up, in-clubhouse hours-logging terminal
- Portal member directory/self-service views become admin-only tools (or removed if redundant with WP plugin)

## Phase 2 — Hours tracker in the WordPress plugin

Members already log in to WordPress — give them self-service hour logging instead of requiring portal access.

- New Netlify function (e.g. `member-log-submit.js`) accepting `{ email, date, activity, type, clockHours }`, writing to the `logs` Firestore collection with `Status: "pending"`, `SourceSheet: "wp-plugin"` — mirrors kiosk/admin entry behavior
- New shortcode in `wordpress-plugin/gcdoc-member-hours/gcdoc-member-hours.php` (e.g. `gcdoc_log_hours`) with a small form; reuses the existing secret-header auth pattern already in the plugin
- Submitted entries land in the existing approval queue (`src/modules/memberlogs/components/LogApprovals.vue`) — no new admin workflow needed
- Once shipped, portal member accounts are fully redundant, reinforcing Phase 1

## Phase 3 — Attendance tracking for board eligibility

Today attendance is only implicit via logged hours — no record of "did they attend meeting X." Needs real schema.

- New Firestore collection `meetings`: `{ id, fiscalYear, date, label }` — 5 per FY, created by admin
- New Firestore collection `attendance` (or subcollection under `meetings`): `{ meetingId, memberEmail, attended: true, recordedAt }`
- Extend `src/modules/admin/AttendanceSheet.vue` / `src/modules/admin/MeetingView.vue` so checking a name off on the sign-in sheet writes an attendance record tied to a specific meeting, instead of just printing a sheet
- New computed eligibility view: e.g. "attended ≥ 3 of 5 meetings this FY" per member, surfaced in `MeetingView.vue` or a new "Board Eligibility" panel — confirm actual threshold rule before building

## Phase 4 — Dues tracking (separate from WordPress)

WordPress plugin only *estimates* what a member owes — actual paid/unpaid status needs to live in the system.

- Add fields to the member doc in `members`: `duesPaid: bool`, `duesAmount`, `duesFiscalYear`, `duesPaidDate`
- Admin UI (new small view, or a tab in `src/modules/members/MemberManager.vue`) to mark a member paid/unpaid per FY, with amount pre-filled from the same dues-tier logic already in `wordpress-plugin/gcdoc-member-hours/gcdoc-member-hours.php` — consider porting that calculation into a shared JS util so the portal and plugin don't drift out of sync
- Optional later: surface "dues paid" status back on the WP shortcode once this exists

## Phase 5 — Voucher system + distribution tracking

`src/stores/logsStore.js` already *computes* voucher counts a member has earned (`vouchersByMember`: 1 per 25 hrs once ≥50 hrs/FY; `blueVouchersByMember`: cleaning clock hours / 8) but nothing tracks whether an earned voucher has actually been **issued/handed out or redeemed**. Needs a real ledger, not just a derived count.

- New Firestore collection `vouchers`: `{ id, memberEmail, fiscalYear, type: "service" | "blue", status: "earned" | "issued" | "redeemed", earnedAt, issuedAt, issuedBy, redeemedAt, redeemedFor }`
- Reconciliation job/admin view that diffs "earned" counts (from `logsStore` getters) against existing voucher-ledger records per member/FY, and generates the missing `vouchers` docs in `status: "earned"` so nothing has to be entered by hand from scratch
- **Distribution UI** (new admin view, e.g. `VoucherManager.vue`): list members with outstanding earned-but-not-issued vouchers, mark as issued (who/when), and mark as redeemed (what it was used for — e.g. trial entry, merchandise)
- Decide the redemption model: vouchers redeemed against trial fees/entries elsewhere in the club's process, so this may just need a "redeemed" flag + note field rather than integration with a payment system
- Optional later: show a member's voucher balance (earned vs. available) on the WP plugin dues/hours shortcode, same pattern as the dues estimate
