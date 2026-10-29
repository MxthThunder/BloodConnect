# Blood Donation Camps - discovery and coordination

Two connected features added to BloodConnect:

1. **Camp discovery and locator** - the public can find upcoming, approved camps in Chennai, search by locality,
   see them on a map and register their interest.
2. **Camp registration and medical-support coordination** - colleges, companies, NGOs, community groups and similar
   organisations apply to hold a camp. BloodConnect reviews the application, coordinates a qualified blood bank or
   medical team, and tracks the application through each stage.

> **BloodConnect only coordinates.** Donor screening, blood collection and every clinical procedure must be done by
> qualified, authorised professionals or institutions. The platform never promises medical support until a partner has
> confirmed availability. This is enforced in code and in the database, not just in wording (see "Safeguards").

## Who does what

| Role | Can do |
|---|---|
| Anyone (no account) | Browse the camp list, map and camp pages |
| Any signed-in user (donor, requester, organiser) | Register or withdraw interest in an upcoming approved camp |
| **Camp organiser** (new role) | Submit applications, edit them until review starts, follow progress, cancel |
| Administrator | Review, record medical-partner coordination, approve / decline / cancel, mark completed, add notes |

The new `organiser` role can be chosen at registration (`/register?role=organiser`). Administrators can **not** be
created through public registration: the register API previously accepted `role: admin`, so anyone could make
themselves an administrator. That is now rejected (tested).

## The application workflow

```
SUBMITTED -> UNDER_REVIEW -> PARTNER_COORDINATION -> APPROVED -> COMPLETED
     \             \                  \                  \
      +-> REJECTED / CANCELLED (from any stage before COMPLETED; REJECTED only before approval)
```

| Stage | Meaning | Who moves it |
|---|---|---|
| Submitted | Organiser sent the application | Organiser |
| Under review | An administrator picked it up | Admin: *Start review* |
| Medical partner coordination | A blood bank / medical team is being arranged (status contacted, confirmed or declined) | Admin: *Save partner update* |
| Approved | A partner **confirmed**; the camp is listed publicly | Admin: *Approve* |
| Completed | The camp took place (on or after its date) | Admin: *Mark completed* |
| Not approved / Cancelled | Ended early, with a reason shown to the organiser | Admin / organiser |

Rules live in the pure module `backend/camps/workflow.py` (no database, no clock) and are unit-tested: stages cannot be
skipped or reversed, terminal states have no exit, approval requires a confirmed and named partner with at least one
confirmed kind of support, completion needs the camp date to have arrived.

## Safeguards (what stops the platform over-promising)

* **Approval gate**: `approve` is refused unless `partner_status = CONFIRMED`, a partner is named, support is recorded
  and the date has not passed.
* **Database constraint** `camp_confirmed_partner_required`: a row cannot be `APPROVED` or `COMPLETED` unless its partner
  is `CONFIRMED`, even if code is bypassed. A second constraint requires a confirmed partner to be named.
* **Organiser view hides unconfirmed partners**: until confirmation the organiser sees "No medical support is confirmed
  yet" and no partner name. Internal notes and partner notes are never sent to organisers.
* **Public listing**: only `APPROVED`, upcoming camps. It never includes organiser phone/e-mail, internal notes or who
  registered interest (only a count).
* **Interest is not a booking** and not an eligibility statement; the UI says so on every list and detail page.
* Camp applications cannot be approved from the wrong stage, edited after review begins, or changed by other organisers
  (they get a 404, not a 403, so other people's applications cannot be probed).

## Public discovery

* `/camps` (also `/donor/camps`, `/requester/camps` inside the dashboards): list with locality filter (15 Chennai
  localities), text search (title, organisation, venue, address), "on or after" date, list + map (tabs on phones).
* `/camps/:id`: date, time, venue, address, facilities, confirmed medical support, how to register, map, interest button.
* Map pins use exact coordinates when the organiser supplies them. Otherwise the pin is placed at the **approximate centre
  of the locality** (reusing the escalation engine's reference points) and the page says the position is approximate.
* Registering interest needs an account; signed-out visitors are sent to sign in and returned to the page afterwards.
  Interest is idempotent (one per person per camp) and can be withdrawn.
* If an approved camp is cancelled, everyone who registered interest gets an in-app notification and it leaves the listing.

## Data model (`backend/camps`)

| Table | Purpose |
|---|---|
| `camps_campapplication` | The application and (once approved) the public camp. Organisation, venue, locality, optional coordinates, date/time, expected donors, facilities (JSON list of codes), private contact details, public registration info, `status`, `partner_status`, `partner` (optional blood bank FK) or `partner_name`, confirmed `partner_support` (JSON), internal `admin_notes`/`partner_notes`, rejection/cancellation reasons, review/approval/completion timestamps, `actual_donors` (recorded by an admin, may be empty) |
| `camps_campevent` | Timeline: submitted, edited, status changes, partner updates, notes. `internal` events are admin-only |
| `camps_campinterest` | One row per (camp, user); unique constraint |

Constraints: `camp_confirmed_partner_required`, `camp_confirmed_partner_named`, `camp_start_before_end`,
`uniq_camp_interest_per_user`. Validation also rejects: dates earlier than 3 days ahead or beyond 365 days, localities
outside the supported 15, unknown facility/support codes, malformed phone numbers, coordinates outside Chennai, fewer than
10 or more than 5,000 expected donors.

## API (`/api/camps/`)

| Endpoint | Who | Purpose |
|---|---|---|
| `GET options/` | anyone (blood banks only for admins) | Form choices and the coordination notice |
| `GET /` , `GET <id>/` | anyone | Upcoming approved camps; filters `locality`, `q`, `date_from`, `date_to` |
| `POST/DELETE <id>/interest/`, `GET my-interests/` | signed in | Register / withdraw interest |
| `GET/POST applications/` | organiser (own) / admin (all, with `status_counts`) | List and submit |
| `GET/PATCH applications/<id>/` | owner or admin | Read; edit while `SUBMITTED` |
| `POST applications/<id>/cancel/` | owner or admin | Cancel (admin must give a reason) |
| `POST applications/<id>/action/` | admin | `start_review`, `partner`, `approve`, `reject`, `complete`, `note` |

Every administrator action is written to the audit log and notifies the organiser in-app.

## Demo data

`python manage.py seed_data` also runs `seed_camps`, which creates two demo organisers and nine applications, one at each
stage (including a rejected and a completed one) with a few interest records.

* Organiser login: `organiser@bloodconnect.org` / `Organiser@1234` (second account: `organiser.ngo@bloodconnect.org`).
* **All organisations and partners in the seed are fictional** (partners are labelled "Demo Partner Blood Centre N
  (fictional)"). The seed never claims a real hospital or blood bank has confirmed anything. The completed demo camp has
  no donor count, because none was recorded.
* The seed keeps upcoming demo camps upcoming when it is re-run on a later day.

## Try it (5 minutes)

1. Sign out. Open **Donation Camps** (top navigation): search "Anna Nagar", switch to the map, open a camp.
2. Click *Sign in to register interest*, sign in as `donor.o_neg@bloodconnect.org` / `Donor@1234`, register, then withdraw.
3. Sign in as `organiser@bloodconnect.org`: open an application and read its progress tracker and timeline. Try
   *Apply to Hold a Camp* with a date tomorrow to see validation.
4. Sign in as an administrator (`freddy.admin@bloodconnect.org` / `Admin@1234`): **Camp Applications**. Open the
   *Partner coordination* camp and try to approve it: the button is disabled and says why. Set the partner to
   *confirmed*, tick the support types, save, then approve. The camp appears on the public list.
5. As the organiser, reopen the application: the partner is now named and the stage is Approved.

## Tests

`python manage.py test camps` runs 59 tests (the whole suite is 175):

* `test_workflow.py` (12): transitions, skipped/reversed stages, terminal states, approval and completion gates.
* `test_api.py` (47): registration (no admin self-sign-up), submission and validation, organiser isolation, hidden
  internal data, the full submit-to-completion journey, approval blockers, database constraints, notes, cancellation
  and notifications, public filtering and privacy, map-point flagging, interest (idempotent, counted, withdrawn, auth
  required, closed camps), and seed idempotence.

The browser flow (public finder, map, interest, organiser sign-up and application, admin approval, mobile layout, role
fences) was exercised in a headless browser with no JS or API errors.

## Limitations

* No e-mail, SMS or push: organiser and attendee updates are in-app notifications only.
* Interest registration is a headcount signal, not slot booking, and does not check donor eligibility.
* "Medical partner confirmed" is a record an administrator makes after speaking to the partner; BloodConnect does not
  integrate with blood banks' systems, so it cannot verify it automatically.
* Camp coordinates are optional and organiser-supplied; there is no geocoding or address lookup.
* The platform does not share attendee lists with organisers (privacy); organisers see counts only.
* No automated frontend tests.
