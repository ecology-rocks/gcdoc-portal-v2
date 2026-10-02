# GCDOC Portal — Planned Changes

_Last updated: 2026-10-01_

Roadmap ordered by dependency (each phase simplifies the next), not by original request order.

## Completed

### Phase 1 — Sunset unused features ✅
Classes/Registration module fully removed (`classStore.js`, `ClassDashboard.vue`, `RegistrarView.vue`, dead nav links). `DogManager.vue`/`DogModal.vue` confirmed as a general member-dogs feature, kept. Member portal accounts sunset — only admin (`reallyjustsam@gmail.com`) and the `kiosk@gcdoc.com` terminal have accounts now; email-link sign-in and registrar/teacher roles removed from `authStore.js` and `Login.vue`.

### Phase 2 — Hours tracker in the WordPress plugin ✅
`netlify/functions/member-log-submit.js` + `[gcdoc_log_hours]` shortcode let members self-log hours from WordPress, landing in the existing approval queue with `SourceSheet: "wp-plugin"`.

### Phase 4 — Dues tracking ✅ (mostly)
Went further than originally scoped — this one's essentially done, not just started:
- `Dues2026Paid` / `Dues2026PaidAt` fields on the member doc, with a toggle badge + "2026 Dues Unpaid Only" filter + Paid/Outstanding/Total summary bar in `MemberManager.vue`
- Paid status now surfaces on the WP shortcodes (`[gcdoc_hours]`, new `[gcdoc_dues_owed]`), with "Pay Your Dues" / "Enter Missing Hours" buttons that disappear once marked paid
- `VotedInDate` field + automatic dues exemption (voted in after July 1 → no dues owed for the cycle starting the following Oct 1), computed in `member-report.js`, only applies when a date is actually on file
- **Still open**: `gcdoc_calculate_dues()` only exists in PHP (`gcdoc-member-hours.php`) — never got ported to a shared JS util, so the portal has no way to independently compute/display a dues amount itself. Low priority since nothing in the portal needs that today, but flagged here so it doesn't get lost.

## Phase 3 — Member changelog + log compression (design settled, not yet built)

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

- Not yet built: the changelog subcollection, the write-alongside-existing-updates wiring, and the FY close-out/export/delete admin action
- Worth doing before Phase 4 (Attendance) and Phase 5 (Vouchers) if possible, since both would naturally emit their own changelog event types (attendance eligibility determinations, voucher issuance/redemption) rather than inventing separate history mechanisms

## Phase 4 — Attendance tracking for board eligibility

Today attendance is only implicit via logged hours — no record of "did they attend meeting X." Needs real schema.

- New Firestore collection `meetings`: `{ id, fiscalYear, date, label }` — 5 per FY, created by admin
- New Firestore collection `attendance` (or subcollection under `meetings`): `{ meetingId, memberEmail, attended: true, recordedAt }`
- Extend `src/modules/admin/AttendanceSheet.vue` / `src/modules/admin/MeetingView.vue` so checking a name off on the sign-in sheet writes an attendance record tied to a specific meeting, instead of just printing a sheet
- New computed eligibility view: e.g. "attended ≥ 2 of 5 meetings this FY" per member, surfaced in `MeetingView.vue` or a new "Board Eligibility" panel — confirm actual threshold rule before building

## Phase 5 — Voucher system + distribution tracking

`src/stores/logsStore.js` already *computes* voucher counts a member has earned (`vouchersByMember`: 1 per 25 hrs once ≥50 hrs/FY; `blueVouchersByMember`: cleaning clock hours / 8) but nothing tracks whether an earned voucher has actually been **issued/handed out or redeemed**. Needs a real ledger, not just a derived count.

- New Firestore collection `vouchers`: `{ id, memberEmail, fiscalYear, type: "service" | "blue", status: "earned" | "issued" | "redeemed", earnedAt, issuedAt, issuedBy, redeemedAt, redeemedFor }`
- Reconciliation job/admin view that diffs "earned" counts (from `logsStore` getters) against existing voucher-ledger records per member/FY, and generates the missing `vouchers` docs in `status: "earned"` so nothing has to be entered by hand from scratch
- **Distribution UI** (new admin view, e.g. `VoucherManager.vue`): list members with outstanding earned-but-not-issued vouchers, mark as issued (who/when), and mark as redeemed (what it was used for — e.g. trial entry, merchandise)
- Decide the redemption model: vouchers redeemed against trial fees/entries elsewhere in the club's process, so this may just need a "redeemed" flag + note field rather than integration with a payment system
- Optional later: show a member's voucher balance (earned vs. available) on the WP plugin dues/hours shortcode, same pattern as the dues estimate
