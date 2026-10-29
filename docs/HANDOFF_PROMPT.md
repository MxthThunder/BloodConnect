# BloodConnect 2.0 - Handoff prompt, database reference and example report

How to use this file: open a new chat in this repository and paste **Part 1** (the prompt) as your first
message. Parts 2 to 9 are the reference material it points to; paste any of them too if the new chat cannot read the repo.
Part 10 is an example report to copy the style from.

Snapshot taken 2026-10-29, branch `main`, last commit `27ba699`. **Nothing from the BloodConnect 2.0 work is committed
yet** (see Part 9).

---

## Part 1 - The prompt to paste into the new chat

```
You are continuing work on BloodConnect, a Django + React emergency blood-coordination app, in the repo at
C:\react projects\BloodConnect\BloodConnect. I (the user) built it with a team. A previous session upgraded it to
"BloodConnect 2.0 - Adaptive Emergency Escalation Engine". That work is finished, tested (116 backend tests pass) and
running, but NOT committed.

MY GOAL NOW: help me write a project report (and, if I ask, slides / viva answers) about this system. Do not change
code unless I ask. Do not commit unless I ask.

First, read these in order, then confirm in 5 lines what you understood:
1. docs/HANDOFF_PROMPT.md  (this file: schema, architecture, API, results, example report)
2. docs/BLOODCONNECT_2.md  (design write-up: algorithm, assistant limits, run/test steps, demo sequence, limitations)
3. README.md
4. For any claim you are unsure about, read the code (map in Part 5). Never answer a technical question from memory
   when the file is available.

RULES FOR THE REPORT (these come from the original project spec; do not break them):
- Every number must come from the repository, the database, a test run, or an experiment run. If a number is not
  available, say "not measured" instead of inventing one.
- Simulation results come from SCRIPTED FICTIONAL donors. Never present them as real hospital performance,
  real donor response rates, or real donation outcomes.
- Vocabulary: "accepted" = a volunteer said yes. It is NOT a confirmed donation and NOT a blood unit.
  "No response" = status unknown, NOT declined and NOT unavailable.
- The system makes no clinical compatibility or eligibility decision. Blood-group matching is a matching rule only;
  final suitability is confirmed by the blood bank / hospital.
- No SMS, e-mail, push, GPS, or hospital-stock integration exists. "Alert sent" = an in-app Notification record.
- The assistant is rule-based (no LLM, no external AI API). Say so plainly.
- Be honest about results: Adaptive is usually SLOWER than Broadcast but contacts far fewer donors. It was not tuned
  to win. Report that as a trade-off.
- Known limitations are listed in Part 8. Include them.

Ask me, before writing: report type (college mini/major project report, IEEE-style paper, or PPT), required
sections/format from my college, page or word limit, whether screenshots are needed, and who the reader is
(examiner, panel, client). Then draft section by section and let me review each.
When you hand me a draft, start with one line naming the audience you assumed.
```

---

## Part 2 - What the project is (plain language)

BloodConnect is a web app for coordinating emergency blood-donor outreach in Chennai. Three roles:

| Role | What they do |
|---|---|
| Requester (hospital/family contact) | Creates a blood request (group, component, units, hospital, urgency, required-by time) |
| Donor | Keeps a profile (blood group, locality, availability, consent), receives in-app alerts, accepts or declines |
| Administrator | Verifies requests, manages donors/users/blood-bank stock, watches the audit log, and (2.0) runs the Command Center |

**Version 1.x**: when an admin approved a request, the system alerted every compatible donor at once and stopped. Nobody
tracked whether enough people answered.

**Version 2.0 (the upgrade)**: after the first alert, the system keeps managing the emergency. For each request it
- computes how many volunteers are needed (units x 2 by default),
- sends a first batch to the nearest best-scored donors only,
- records every response (accepted / declined / no response in the time window),
- recalculates the remaining need after each response,
- decides whether to wait, top up the same area, or expand to a wider area,
- writes every decision and its reason to an event timeline,
- never sends duplicate alerts, and stops cleanly on cancel or expiry.

Around the engine: an Emergency Command Center, per-case Outreach & Escalation page with explainable candidate
ranking, a Simulator (5 scenarios, nothing real is touched or sent), a 3-strategy comparison module computed from real
simulation runs, a rule-based explanation assistant, and an admin-editable policy page.

### End-to-end flow of a real emergency
1. Requester submits a `BloodRequest` (status `PENDING_VERIFICATION`).
2. Admin approves it (`POST /api/requests/<id>/verify/`). The view validates the request, then calls
   `escalation_service.start_case_for_request`, which creates an `EmergencyCase` (one-to-one with the request).
3. The engine ranks eligible donors and creates **Batch 1** (stage 1 only, sized by need / expected acceptance).
   Each chosen donor gets an `OutreachAttempt`, a `DonorMatch` and an in-app `Notification`.
4. Donors open the alert (`ALERT_VIEWED`) and accept or decline. The view calls the engine through `escalation/hooks.py`
   (failure-tolerant, so an engine bug can never break a donor response).
5. After every event `service.evaluate(case)` runs under a row lock and asks the pure function `decision.decide`
   what to do: close, mark lapsed alerts `NO_RESPONSE`, declare `VOLUNTEERS_SECURED`, wait, top up, expand,
   await admin approval, or flag `NEEDS_ADMIN_INTERVENTION`.
6. Everything is appended to `EscalationEvent`, shown on the timeline, and explainable via the assistant.
7. Request cancelled or past `required_by + grace` -> pending alerts withdrawn, no more batches.

### Decision rules in `decision.decide` (priority order)
1. Closed/cancelled/fulfilled or past expiry -> close, withdraw pending alerts.
2. Alerts older than the response window (CRITICAL 10 / URGENT 20 / STANDARD 45 min) -> `NO_RESPONSE` (status unknown).
3. Remaining need = 0 -> `VOLUNTEERS_SECURED` (outreach paused; request not "resolved").
4. No batch yet -> first batch from stage 1, size `ceil(need / expected_acceptance)` capped by stage max.
5. Alerts still inside their window expected to cover the need -> wait. Last batch too recent -> wait.
6. Otherwise top up in the current stage, sized by the shortfall.
7. Expand to the next stage only if the current stage has nobody eligible left AND earlier alerts are answered or lapsed.
   If auto-escalate is off -> `AWAITING_ESCALATION` until an admin approves.
8. Nobody left or batch limit reached -> `NEEDS_ADMIN_INTERVENTION` (admins notified once).

`expected_acceptance = (accepted + prior x prior_weight) / (answered + prior_weight)` - the configured prior (0.35,
worth 4 virtual alerts) is replaced gradually by observed outcomes.

### Candidate scoring (explainable)
Weights default 35 / 25 / 20 / 20: **proximity**, **blood-group match** (exact vs listed substitute), **profile verified
by blood bank**, **availability freshness**. Unknown distance gives no invented value (same locality gets partial
credit, otherwise none, UI shows "Unknown"). Past response behaviour is deliberately not used (avoids penalising
people who were simply busy). Hard exclusions: no consent, declared unavailable, inactive account, the requester
themself, declined this request, already accepted, already contacted (unless reminders allowed), missing data,
outside every stage. Exclusion counts per reason are shown to admins.

### Stages (default, cumulative, editable)
| # | Name | Radius | Fallback when distance unknown | Max batch |
|---|---|---|---|---|
| 1 | Immediate area | 5 km | LOCALITY | 8 |
| 2 | Nearby localities | 10 km | CITY | 10 |
| 3 | Greater Chennai | 20 km | CITY | 14 |
| 4 | Whole metro area | no limit | CITY | 20 |

### Baselines used in the comparison
- **A Basic broadcast**: alert the whole eligible pool once (this is how 1.x behaved).
- **B Fixed escalation**: open each stage on a fixed timer (15 min) and alert the whole stage, ignoring responses.
- **C Adaptive**: the engine above.
All three use the same machinery, dataset (same seed) and scripted donor behaviour, so the comparison is fair.

### Safety / correctness mechanisms
- `select_for_update` row lock on the case inside `transaction.atomic()`; SQLite `transaction_mode=IMMEDIATE`.
- Idempotent writes: repeating a response or evaluation is a no-op.
- DB constraints: real XOR simulated case; exactly one donor kind per attempt; unique (case, donor, stage); unique
  batch sequence per case.
- Verified with real parallel threads (3 concurrency tests, file-backed test DB).
- Simulation isolation: simulated data lives in its own tables, never creates `DonorMatch` or `Notification`, never sends anything.
- API payloads never expose donor phone/e-mail; all escalation endpoints are admin-only and audit-logged.

---

## Part 3 - Technology stack

| Layer | Technology |
|---|---|
| Backend | Python, Django 6.1.x (`requirements.txt` allows >=5.1,<6.2), Django REST Framework, django-cors-headers, python-dotenv |
| Auth | DRF token authentication, custom `User` (e-mail is the login), 3 roles |
| Database | SQLite (`backend/db.sqlite3`); PostgreSQL possible via env, but concurrency was verified on SQLite only |
| Frontend | React 19, Vite 8, Tailwind CSS v4 (`@theme` colour overrides), react-router, axios, react-leaflet (maps), recharts (charts), lucide-react (icons) |
| Tests | Django `TestCase` / `TransactionTestCase`; no frontend automated tests |
| Extra dependencies added for 2.0 | **None** |

Run commands (PowerShell):
```
cd backend ; python manage.py migrate ; python manage.py seed_data ; python manage.py runserver 127.0.0.1:8000
cd frontend ; npm run dev            # open http://localhost:5173  (use localhost, not 127.0.0.1)
cd backend ; python manage.py test   # 116 tests
python manage.py evaluate_escalations --loop --interval 30   # optional background evaluator (no built-in scheduler)
```
Admin login: `freddy.admin@bloodconnect.org` / `Admin@1234` (five more team admins use the same password; see
`seed_data.py`). Requesters use `Requester@1234`, e.g. `requester@bloodconnect.org`; donors use `Donor@1234`, e.g.
`donor.o_neg@bloodconnect.org`. The header Demo Switcher was removed by a teammate commit (`5851c33`), so switch roles by
logging out and in.

---

## Part 4 - Database (complete schema)

Engine: SQLite. 9 project apps (`dashboard` has no tables). 18 project tables below plus Django's built-in tables (`auth`, `contenttypes`, `sessions`,
`authtoken_token`, `admin_log`). Row counts are from the live `db.sqlite3` on 2026-10-29 after `seed_data`.

### 4.1 Row counts (live database)
| Table | Rows | Table | Rows |
|---|---|---|---|
| accounts_user | 42 | notifications_notification | 158 |
| donors_donorprofile | 32 | audit_auditlog | 11 |
| donors_donationhistory | 0 | escalation_escalationpolicy | 1 |
| blood_requests_bloodrequest | 15 | escalation_emergencycase | 5 |
| matching_donormatch | 107 | escalation_outreachbatch | 5 |
| bloodbank_bloodbank | 11 | escalation_outreachattempt | 83 |
| bloodbank_bloodstock | 88 | escalation_escalationevent | 30 |
| bloodbank_stocktransaction | 0 | escalation_simulationrun / simulateddonor / experiment | 0 / 0 / 0 |
| authtoken_token | 5 | | |

(Simulation tables are empty by design in the real database; simulations are run on demand and can be purged.)

### 4.2 Entity relationships
```
User 1---1 DonorProfile 1---* DonationHistory
User 1---* BloodRequest 1---* DonorMatch *---1 DonorProfile      (unique request+donor)
User 1---* Notification *---0..1 BloodRequest
User 1---* AuditLog (actor, SET_NULL)            User 1---* StockTransaction (performed_by, SET_NULL)
BloodBank 1---* BloodStock 1---* StockTransaction               (unique bank+group+component)

BloodRequest 1---0..1 EmergencyCase 1---* OutreachBatch 1---* OutreachAttempt
                                    1---* OutreachAttempt (case)
                                    1---* EscalationEvent  (also -> batch, attempt, actor)
OutreachAttempt *---0..1 DonorProfile        (real)   } exactly one of the two
OutreachAttempt *---0..1 SimulatedDonor      (fiction)}
OutreachAttempt *---0..1 DonorMatch          (link to the legacy alert row)
SimulationRun 1---0..1 EmergencyCase ; SimulationRun 1---* SimulatedDonor ; Experiment 1---* SimulationRun
Experiment 0..1---* Experiment (rerun_of) ; EscalationPolicy (single active JSON config)
```

### 4.3 Tables and columns

**accounts_user** (`accounts.User`, extends AbstractUser; `USERNAME_FIELD=email`)
email (unique), role (`requester|donor|admin`, default requester), phone, city, locality, is_verified (default True),
created_at, updated_at, plus inherited username, password, first_name, last_name, is_active, is_staff, is_superuser.

**donors_donorprofile**
user (1:1 CASCADE), blood_group (A+ A- B+ B- AB+ AB- O+ O-), city, locality, state (default Tamil Nadu),
approx_latitude, approx_longitude (nullable), is_available (default True), notification_consent (default True),
preferred_contact (`in_app|phone|sms|email`, default in_app), is_medically_verified (default False),
medical_verification_note, last_donation_date, total_donations, last_profile_update (auto), created_at.

**donors_donationhistory**
donor (FK CASCADE), donation_date, facility_name, units, component, certificate_ref, notes, created_at.

**blood_requests_bloodrequest**
reference_number (unique, `BC-REQ-XXXXXX`), requester (FK CASCADE), patient_case_ref (anonymised), blood_group,
component (Whole Blood / Packed Red Blood Cells / Platelets / Fresh Frozen Plasma / Cryoprecipitate), units_requested,
hospital_name, hospital_address, city, locality, hospital_lat, hospital_lng (nullable), urgency
(`CRITICAL|URGENT|STANDARD`), required_by, reason, contact_phone, contact_preference (`phone|in_app|hospital_desk`),
verification_status (`PENDING|APPROVED|REJECTED`), request_status (`PENDING_VERIFICATION|MATCHING|ACTIVE_ALERTS_SENT|DONOR_RESPONDED|FULFILLED|CANCELLED|CLOSED`),
verified_by (FK SET_NULL), verified_at, verification_notes, fulfillment_notes, created_at, updated_at.

**matching_donormatch** (the original alert row; still written for real alerts)
blood_request (FK), donor (FK), compatibility_score (default 100), match_type (`EXACT_MATCH|COMPATIBLE_SUBSTITUTE`),
match_explanation, distance_km, alert_status (`QUEUED|DISPATCHED|VIEWED|ACCEPTED|DECLINED`), donor_response_message,
responded_at, created_at, updated_at. Unique (blood_request, donor).

**bloodbank_bloodbank**
name, license_number, address, city, locality, contact_phone, contact_email, operating_hours, latitude, longitude
(defaults 13.0827 / 80.2707), is_active, created_at.

**bloodbank_bloodstock**
blood_bank (FK), blood_group, component, units_available, low_stock_threshold (default 5), last_updated.
Unique (blood_bank, blood_group, component). Property `is_low_stock`.

**bloodbank_stocktransaction**
stock (FK), transaction_type (`ADDITION|USAGE_ISSUE|CORRECTION`), units (signed), previous_units, resulting_units,
reason, reference_note, performed_by (FK SET_NULL), created_at. Created only through
`apply_transaction`, which locks the stock row and refuses negative inventory.

**notifications_notification**
recipient (FK CASCADE), related_request (FK SET_NULL), title, message, notification_type
(`EMERGENCY_ALERT|STATUS_UPDATE|DONOR_RESPONSE|LOW_STOCK|SYSTEM`), urgency, is_read, action_url, created_at.

**audit_auditlog**
actor (FK SET_NULL), actor_email, actor_role, action (e.g. REQUEST_APPROVED), target_model, target_id, details,
ip_address, created_at. Written via `AuditLog.record(...)`.

**escalation_escalationpolicy**
name (unique, default `default`), config (JSON: every threshold, stage and weight), is_active, updated_by (FK), updated_at.
Defaults are in `escalation/policy.py` (`DEFAULT_POLICY`), validated by `normalize_policy`.

**escalation_simulationrun**
scenario, strategy (`ADAPTIVE|FIXED|BROADCAST`), seed, status (`READY|RUNNING|PAUSED|COMPLETED`), sim_start, sim_clock,
horizon_minutes (default 120), scenario_params (JSON), policy_snapshot (JSON), experiment (FK CASCADE), created_by,
metrics (JSON), final_outcome, created_at, updated_at.

**escalation_simulateddonor** (fictional, per run)
run (FK CASCADE), code, blood_group, city, locality, latitude, longitude, is_available, notification_consent,
medically_verified, profile_age_days, response_plan (`ACCEPT|DECLINE|SILENT`), response_delay_minutes. Unique (run, code).

**escalation_emergencycase** (one per real request or simulation)
blood_request (1:1, nullable), simulation_run (1:1, nullable), is_simulation, strategy, reference, snapshot fields
(blood_group, units_requested, hospital_name, city, locality, hospital_lat/lng, urgency, required_by, expires_at),
status (`OPEN|COLLECTING_RESPONSES|AWAITING_ESCALATION|VOLUNTEERS_SECURED|NEEDS_ADMIN_INTERVENTION|RESOLVED|CANCELLED|EXPIRED`),
current_stage_index (-1 until first batch), target_volunteers, remaining_coordination_need, batches_created,
last_batch_at, last_evaluated_at, last_decision (JSON), policy_snapshot (JSON), started_at, closed_at, closure_reason,
reviewed_at, reviewed_by, created_at.
**CHECK `case_real_xor_simulated`**: a case is either (simulation AND has a run AND no request) or (real AND has a request AND no run).

**escalation_outreachbatch**
case (FK), sequence, stage_index, trigger (`INITIAL|TOP_UP|EXPANSION|MANUAL|BROADCAST|FIXED_INTERVAL|LEGACY_IMPORT`),
planned_size, decision_reason, created_at (engine time; virtual clock in simulations). Unique (case, sequence).

**escalation_outreachattempt**
case (FK), batch (FK), donor (FK, real) | sim_donor (FK, fictional), donor_match (FK SET_NULL), stage_index,
status (`ALERTED|VIEWED|ACCEPTED|DECLINED|NO_RESPONSE|WITHDRAWN`),
fulfilment (`NONE|VERIFICATION_PENDING|DONATION_CONFIRMED|NOT_DONATED`), attempted_at, viewed_at, responded_at,
response_source (`donor_app|admin|simulation`), response_message, rank_position, rank_score,
score_breakdown (JSON), explanation, distance_km, updated_at.
Constraints: **CHECK `attempt_exactly_one_donor_kind`**; **UNIQUE (case, donor, stage)** for real; **UNIQUE (case, sim_donor, stage)**
for simulated. Index (case, status).

**escalation_escalationevent** (append-only timeline)
case (FK), event_type (25 types, e.g. `BATCH_CREATED`, `CANDIDATE_ACCEPTED`, `RESPONSE_WINDOW_ELAPSED`, `SEARCH_EXPANDED`,
`VOLUNTEERS_SECURED`, `ADMIN_INTERVENTION_REQUIRED`, `REQUEST_CANCELLED`, `LATE_RESPONSE`), event_time (engine time),
created_at, previous_stage, new_stage, decision_reason, details (JSON), actor, batch, attempt, simulation_flag.
Index (case, event_time).

**escalation_experiment**
scenario, seeds (JSON list), results (JSON, aggregated metrics), rerun_of (self FK), created_by, created_at.

### 4.4 Migrations
`accounts/0001`, `donors/0001` + `0002_alter_donorprofile_state`, `blood_requests/0001`, `matching/0001`,
`bloodbank/0001`, `notifications/0001`, `audit/0001`, `escalation/0001_initial`. `donors/0002` is a default-only drift fix
that Django bundled; it is not a feature. A pending, unrelated `bloodbank` lat/long default drift was left alone
(`migrate` prints a warning about it).

---

## Part 5 - Codebase map (what each file is for)

Line counts are for the 2.0 backend app; `wc -l` as of this snapshot. The new `escalation` backend is ~4,900 lines
including ~1,350 lines of tests.

### Backend: `backend/`
| Path | Purpose |
|---|---|
| `config/settings.py`, `urls.py` | Django settings (SQLite IMMEDIATE, test DB file, CORS, token auth); URL include for every app |
| `accounts/` | Custom `User`, roles, register/login/logout/me, admin user management, permissions (`IsAdminUserRole` etc.), `seed_data` command (6 team admins, requesters, 32 donors, 11 blood banks, stock, 15 requests) |
| `donors/` | `DonorProfile`, `DonationHistory`, profile/availability/history/directory/relevant-requests endpoints |
| `blood_requests/` | `BloodRequest` and its create/list/detail/cancel/verify/fulfil/rematch views. **Modified**: approve starts the engine; cancel/fulfil/rematch inform it |
| `matching/` | `DonorMatch`, `services.run_donor_matching` (v1 broadcast), donor alert list/detail/respond. **Modified**: view/response feed the engine |
| `bloodbank/` | Banks, stock levels, transactions with negative-stock protection, low-stock alerts |
| `notifications/` | In-app notifications, read/unread |
| `audit/` | Audit log model + list endpoint |
| `dashboard/` | Aggregated stats endpoint for the admin dashboard |
| `escalation/constants.py` | All enums + 15 approximate Chennai locality coordinates |
| `escalation/policy.py` | `DEFAULT_POLICY`, validation, typed `Policy`/`Stage` view |
| `escalation/models.py` (270) | The 8 escalation models above |
| `escalation/decision.py` (234) | **Pure** `decide(Snapshot) -> Decision`; no DB, no clock, no UI |
| `escalation/candidates.py` (308) | Candidate pool, exclusion codes, scoring, explanation text, `rank_candidates` |
| `escalation/service.py` (689) | `AdaptiveEscalationService`: transactions, locks, idempotency, batches, responses, cancel/resolve, approve escalation, notifications |
| `escalation/simulation.py` (371) | Scenarios, seeded fictional donor generation, virtual clock, start/step/pause/reset/run-to-end, metrics, chart series |
| `escalation/experiments.py` (108) | Runs one scenario x seeds x 3 strategies, aggregates, reruns |
| `escalation/assistant.py` (423) | Rule-based explanation assistant (known facts / unknowns / rules applied / suggestions) |
| `escalation/presenters.py` (283) | API payload shaping; never includes contact details |
| `escalation/views.py` (453), `urls.py` | Admin-only REST API under `/api/escalation/` |
| `escalation/hooks.py` (55) | Failure-tolerant bridges used by the old request/matching views |
| `escalation/management/commands/` | `seed_escalation` (adopt seeded requests), `evaluate_escalations` (manual/loop evaluator) |
| `escalation/tests/` | `test_decision` 15, `test_engine` 34, `test_api` 22, `test_simulation` 27, `test_concurrency` 3 = 101 tests |

Pre-2.0 apps carry 15 tests; total 116.

### Frontend: `frontend/src/`
| Path | Purpose |
|---|---|
| `main.jsx`, `App.jsx`, `routes/AppRoutes.jsx` | Entry and routing (public, requester, donor, admin-portal) |
| `context/AuthContext.jsx`, `api/client.js` | Token auth state, axios client |
| `api/escalation.js` | Escalation API wrapper + `errorMessage` |
| `layouts/DashboardLayout.jsx`, `PublicLayout.jsx` | Sidebar/top bar; new "Emergency Coordination" nav section |
| `pages/` public | Landing, About, HowItWorks, Awareness, Contact, Login, Register |
| `pages/requester/` | Dashboard, CreateRequest, MyRequests, RequestDetail, RequestMatches, Notifications, Profile |
| `pages/donor/` | Dashboard, Profile, RelevantRequests, AlertDetail, History, Notifications |
| `pages/admin/` (old) | AdminDashboard, VerificationQueue, RequestManagement, DonorManagement, UserManagement, MatchingResults, BloodBankStock, LowStockAlerts, NotificationManagement, AuditLogs |
| `pages/admin/` (new, 2.0) | `CommandCenterPage` (254), `OutreachEscalationPage` (175), `SimulatorPage` (230), `StrategyComparisonPage` (251), `EscalationSettingsPage` (173) |
| `components/escalation/` | `shared.jsx` (badges, Panel, Metric, Button), `CaseViews.jsx` (metrics, pipeline, timeline, recommendations, assistant, decision log), `CandidateTable.jsx`, `EscalationMap.jsx` |
| `index.css` | Burgundy / warm-neutral healthcare palette via Tailwind `@theme`, focus-visible, reduced-motion, mobile overflow fix |
| `constants/chennaiData.js` | Chennai localities, India date formatting |

### Frontend routes
Public: `/`, `/about`, `/how-it-works`, `/awareness`, `/login`, `/register`, `/contact`.
Requester `/requester/...`: dashboard, create-request, my-requests, requests/:id, requests/:id/matches, notifications, profile.
Donor `/donor/...`: dashboard, profile, requests, alerts/:id, history, notifications.
Admin `/admin-portal/...`: dashboard, **command-center, outreach, outreach/:caseId, simulator, strategy-comparison,
escalation-settings**, verification-queue, requests, donors, users, matching, stock, low-stock, notifications, audit-logs.

---

## Part 6 - REST API

Base `http://127.0.0.1:8000/api/`. Token auth header `Authorization: Token <key>`.

| Group | Endpoints |
|---|---|
| auth | `POST register/ login/ logout/`, `GET/PUT me/ profile/`, `GET users/`, `POST users/<id>/toggle-status/` |
| donors | `profile/`, `toggle-availability/`, `history/`, `directory/`, `relevant-requests/` |
| requests | `GET/POST /`, `<id>/`, `<id>/cancel/ verify/ fulfill/ rematch/` |
| matching | `request/<id>/`, `donor-alerts/`, `donor-alerts/<id>/`, `donor-alerts/<id>/respond/`, `all-matches/` |
| bloodbank | `banks/`, `stock/`, `low-stock/`, `stock/<id>/transaction/`, `transactions/` |
| notifications | `/`, `<id>/read/`, `mark-all-read/`, `unread-count/`, `all/` |
| audit, dashboard | `audit/logs/`, `dashboard/stats/` |
| **escalation** (admin only) | `overview/`, `emergencies/` (create), `cases/`, `cases/<id>/` + `candidates/ timeline/ batches/ map/ evaluate/ escalate/ review/ resolve/ cancel/ assistant/`, `assistant/questions/`, `evaluate-active/`, `attempts/<id>/respond/`, `attempts/<id>/fulfilment/`, `policy/`, `policy/reset/`, `simulations/` + `scenarios/ purge/ <id>/ <id>/start step pause resume run-to-end reset`, `experiments/` + `<id>/ rerun/ assistant/ runs/` |

---

## Part 7 - Verified results (real, reproducible)

### Tests
`python manage.py test` -> **Ran 116 tests, OK** (about 68 s). Coverage: valid/invalid emergency creation; eligibility and
consent exclusion; accept vs decline vs no response; need recalculation; escalation and approval mode; no duplicate
outreach (including parallel threads); cancel and expiry; admin-only access and no contact-detail leakage; simulation
isolation; experiment metrics recomputed from stored rows and reproducible by seed; assistant output tracking state;
the legacy register -> request -> approve -> respond flow; pure decision rules without a database.
Also verified: `vite build` succeeds; a headless-browser walkthrough of all pages with no JS/API errors and no
horizontal overflow at 390 px width.

### Strategy comparison (5 seeds per scenario, fictional scripted donors, run 2026-10-29 on a scratch copy of the DB)
Source: `run_experiment(scenario, [1,2,3,4,5])` for all five scenarios. Values are means over 5 runs.

| Scenario | Strategy | Contacted | Batches | Unanswered | Accepted | Runs reaching target | Mean time to target (min) | Unresolved |
|---|---|---|---|---|---|---|---|---|
| HIGH_RESPONSE | Broadcast | 41.6 | 1 | 34.6 | 5.6 | 5/5 | 3.6 | 0 |
| HIGH_RESPONSE | Fixed | 15.8 | 1.2 | 9.4 | 4.6 | 5/5 | 9.2 | 0 |
| HIGH_RESPONSE | Adaptive | 10.4 | 1.8 | 4.6 | 4.4 | 5/5 | 11.0 | 0 |
| LOW_RESPONSE | Broadcast | 37.6 | 1 | 24.2 | 3.4 | 3/5 | 18.7 | 2 |
| LOW_RESPONSE | Fixed | 35.8 | 2.8 | 22.2 | 3.4 | 3/5 | 34.3 | 2 |
| LOW_RESPONSE | Adaptive | 35.4 | 5.4 | 21.8 | 3.4 | 3/5 | 35.0 | 2 |
| NO_RESPONSE_INITIAL_AREA | Broadcast | 42.8 | 1 | 34.4 | 5 | 5/5 | 6.2 | 0 |
| NO_RESPONSE_INITIAL_AREA | Fixed | 32.2 | 2 | 25 | 4.6 | 5/5 | 24.4 | 0 |
| NO_RESPONSE_INITIAL_AREA | Adaptive | 31.2 | 4.4 | 23.6 | 4.4 | 5/5 | 27.2 | 0 |
| PARTIAL_RESPONSE | Broadcast | 41.2 | 1 | 31.2 | 4.8 | 5/5 | 10.8 | 0 |
| PARTIAL_RESPONSE | Fixed | 24.4 | 1.6 | 16.2 | 4.6 | 5/5 | 18.2 | 0 |
| PARTIAL_RESPONSE | Adaptive | 22.2 | 3.6 | 14.6 | 4.4 | 5/5 | 21.0 | 0 |
| CANCELLED | Broadcast | 40.2 | 1 | 36.2 | 2 | 1/5 | 5.0 | 4 |
| CANCELLED | Fixed | 10.2 | 1 | 9.4 | 0.4 | 0/5 | none | 5 |
| CANCELLED | Adaptive | 9.4 | 1.4 | 9 | 0.4 | 0/5 | none | 5 |

How to read it (honest summary):
- Broadcast is the **fastest** to reach the volunteer target in every scenario where the target is reached, because it
  alerts everyone at once.
- Adaptive contacts the **fewest people** in the responsive scenarios (HIGH_RESPONSE: about 10 vs about 42, a 75 % cut;
  PARTIAL_RESPONSE: about 22 vs about 41) and uses more, smaller batches.
- When responses are scarce (LOW_RESPONSE, NO_RESPONSE_INITIAL_AREA) all three strategies converge on similar
  contact counts, because the search area has to widen anyway; Adaptive does not reach the target faster there.
- In the CANCELLED scenario (cancel at minute 5) Broadcast has already alerted about 40 people; Adaptive and Fixed
  had alerted about 9-10. After the cancel, no strategy creates further outreach.
- "Unresolved" in CANCELLED is expected: the request was cancelled, not fulfilled.
- Adaptive is **not** better on every axis. Its benefit is lower alert burden and visible reasoning, at the price of
  time. Do not claim it improves real-world donation outcomes.
Each result carries the caveat: "These figures come from a fictional simulation with scripted donor behaviour. They are
not measured hospital performance, real donor response rates or actual donation outcomes."

---

## Part 8 - Known limitations (include in the report)

1. No SMS, e-mail, push or phone gateway. "Alert sent" means an in-app notification record; delivery is only evidenced
   when the donor opens it.
2. No real hospital, blood-bank-stock, GPS, or government integration.
3. No built-in scheduler. Time-based decisions run when an admin has the Command Center / Outreach page open, via
   `evaluate_escalations`, or when a donor responds. Production needs cron / Celery beat.
4. Simulation results come from scripted fictional donors, not measured behaviour.
5. Locality coordinates are approximate and only used when a request has no coordinates; donor map positions are
   rounded to about 1 km.
6. Threaded concurrency was verified on SQLite only; PostgreSQL relies on `select_for_update` (not exercised).
7. The assistant is rule-based, not a language model; questions outside the supported list are declined.
8. No automated frontend tests (manual headless-browser walkthrough only).
9. A pre-existing `bloodbank` model/migration default drift is left alone.
10. Behaviour changes versus 1.x: approving a request whose required time has passed now returns 400; approval alerts
    only the initial batch instead of every compatible donor.

---

## Part 9 - Repository state

- Branch `main`; commits: `25352be initial commit`, `27ba699 another update`.
- **Uncommitted**: modified `README.md`, `backend/accounts/management/commands/seed_data.py`,
  `backend/blood_requests/views.py`, `backend/config/settings.py`, `backend/config/urls.py`, `backend/matching/views.py`,
  `frontend/src/components/Logo.jsx`, `frontend/src/index.css`, `frontend/src/layouts/DashboardLayout.jsx`,
  `frontend/src/routes/AppRoutes.jsx`; new `backend/escalation/`, `backend/donors/migrations/0002_alter_donorprofile_state.py`,
  `docs/`, `frontend/src/api/escalation.js`, `frontend/src/components/escalation/`, four new admin pages plus
  `EscalationSettingsPage.jsx`. Ask the user before committing.
- Servers during the previous session: Django at 127.0.0.1:8000, Vite at localhost:5173 (may no longer be running).

---

## Part 10 - Example report (style and level of detail to copy)

Below is a condensed example for a college project report. The real report should expand each section, add
screenshots (Command Center, Outreach page with candidate score breakdown, Simulator, Strategy Comparison, Settings) and
follow the college's template.

---

**BLOODCONNECT 2.0: AN ADAPTIVE, RESPONSE-AWARE EMERGENCY BLOOD-DONOR COORDINATION SYSTEM**

*Project report - Team BloodConnect, Chennai*

### Abstract
Emergency blood requests are time-critical, yet many coordination tools alert every possible donor once and then stop
tracking what happens. This leaves coordinators unsure whether enough volunteers have actually responded, floods donors
with alerts, and offers no explanation of why a donor was contacted. BloodConnect 2.0 extends an existing Django and
React platform with an Adaptive Emergency Escalation Engine. For each approved request the engine ranks eligible donors
with a transparent score, alerts a small first batch, records accepted, declined and unanswered alerts, recalculates the
remaining volunteer need, and widens the search area in stages only when earlier responses are insufficient. Every
decision is stored with its reason on a timeline. A simulator with five scenarios and fictional donors allows safe
testing, and a comparison module measured the engine against two baselines (basic broadcast and fixed-interval
escalation) over five seeded runs per scenario. In the simulated high-response scenario the adaptive strategy contacted
about 10 donors against about 42 for broadcast, but took about 11 minutes against about 4 to reach the volunteer target.
The system passes 116 automated tests. Results are simulation-based and do not represent real hospital performance.

### 1. Introduction
1.1 Background - blood demand in emergencies and the role of voluntary donors.
1.2 Problem statement - alert-and-forget coordination; no response tracking; alert fatigue; no audit trail.
1.3 Objectives
 1. Track every donor's response to each alert.
 2. Recalculate the remaining volunteer need after every response.
 3. Escalate to a wider area only when needed, and explain why.
 4. Provide a safe simulator and a quantitative comparison against baselines.
 5. Preserve privacy and avoid clinical claims.
1.4 Scope - Chennai localities, in-app alerts only, volunteers (not blood units) as the coordination target.

### 2. Existing system (BloodConnect 1.x)
Requester creates a request; administrator approves; the system created a match and an in-app notification for every
compatible donor; donors responded. Limitation: no view of whether the need was met, no staged expansion, no
reasoning, no baseline to compare against.

### 3. Proposed system
Table of the five new capabilities (response-aware escalation, explainable prioritisation, command center, simulator,
strategy comparison) mapped to their modules (Part 5 of this file).

### 4. System architecture
Three-tier diagram: React SPA -> Django REST API -> SQLite. Inside the API: `decision.py` (pure rules) <- `service.py`
(transactions, locks, idempotency) <- views/hooks. Simulation reuses the same engine with a virtual clock. State the
design choice that the decision function is pure so it can be unit-tested without a database.

### 5. Database design
ER diagram from Part 4.2; one table per entity from Part 4.3; list the four integrity constraints (real XOR simulated
case, one donor kind per attempt, unique outreach per case/donor/stage, unique batch sequence) and why each exists.
Include the live row counts (Part 4.1) as evidence of the seeded dataset.

### 6. Algorithm
6.1 Vocabulary (alert sent -> response -> volunteer confirmed -> hospital verification -> donation confirmed; accepted is
not a donation).
6.2 Target and remaining need: `target = units x 2`; `need = max(0, target - accepted)`. Worked example: 2 units ->
target 4; two acceptances -> need 2.
6.3 Eligibility filters and scoring weights (35/25/20/20).
6.4 Expected acceptance and batch sizing with a numeric example: prior 0.35, weight 4, 0 answered -> expected 0.35;
need 4 -> first batch `ceil(4 / 0.35) = 12`, capped by the stage-1 maximum of 8.
6.5 Decision cycle (the eight rules in Part 2).
6.6 Pseudocode of `decide()`.

### 7. Implementation
Technology table (Part 3); module descriptions; how existing views call the engine through failure-tolerant hooks;
concurrency control; privacy controls (admin-only, no contact details in payloads, audit logging).

### 8. Testing
Table of the five test files with counts (15/34/22/27/3 + 15 legacy = 116) and what each proves; the result "Ran 116
tests - OK"; mention the threaded tests that fire parallel responses and evaluations and confirm exactly one is applied;
mention `vite build` and the headless walkthrough.

### 9. Results and discussion
Insert the Part 7 table (all five scenarios) and, for HIGH_RESPONSE, a bar chart of candidates contacted and time to
target per strategy.
Discussion (keep these points): broadcast is fastest; adaptive contacts far fewer donors when responses are healthy;
when response is low every strategy must widen the search so differences shrink; cancellation stops outreach at once;
results are simulated and tied to the scripted donor assumptions; adaptive was not tuned to win.

### 10. Limitations and future work
Limitations: Part 8. Future work: real SMS/WhatsApp gateway with delivery receipts; hospital stock integration;
scheduler (Celery beat); PostgreSQL deployment and concurrency testing; learning response probabilities from real
data after consent and ethics review; frontend test suite; optional LLM-based assistant with strict grounding.

### 11. Conclusion
BloodConnect 2.0 turns one-shot alerting into a closed-loop, explainable coordination process. In simulation it reduces
alert volume substantially when donors respond and widens the search appropriately when they do not, at the cost of
speed relative to alerting everyone. It is a coordination aid: clinical matching, eligibility and blood-unit
availability remain the responsibility of the hospital and blood bank.

### Appendix A - API list (Part 6) - Appendix B - Default policy JSON (`escalation/policy.py`) - Appendix C - Test list
### Appendix D - Screenshots - Appendix E - User manual (demo sequence in `docs/BLOODCONNECT_2.md`, section 7)

### References (use only sources you have actually read; the code base itself and the Django / DRF / React documentation are safe to cite)
