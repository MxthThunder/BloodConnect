# BloodConnect 2.0 - Adaptive Emergency Escalation Engine

BloodConnect 1.x could *find* compatible donors and alert them all at once. It then stopped: nothing tracked whether
enough people actually answered. 2.0 manages the process **after** the first alert. For every emergency it records each
candidate's response, recalculates how many volunteers are still needed, decides whether another batch is warranted,
widens the search area when the current one is exhausted, and writes every decision (with its reason) to a timeline.

Everything below is implemented in the existing Django + React stack. No dependency was added.

## 1. Existing architecture (as found)

| Layer | What exists |
|---|---|
| Backend | Django 6.1 + DRF, SQLite, token auth, apps `accounts donors blood_requests matching bloodbank notifications audit dashboard` |
| Roles | `requester`, `donor`, `admin` (custom `User`, permission classes in `accounts/permissions.py`) |
| Flow | requester creates `BloodRequest` -> admin approves -> `matching.services.run_donor_matching` created a `DonorMatch` + in-app `Notification` for **every** compatible donor -> donors respond on `DonorMatch` |
| Frontend | React 19, Vite, Tailwind v4, react-router, axios, react-leaflet, recharts |
| Baseline | 15 backend tests, all passing before any change |

## 2. What was added

New Django app **`escalation`** plus four admin pages. Existing views were touched only to call into it.

```
backend/escalation/
  constants.py     statuses, event types, scenario list, Chennai locality reference points
  policy.py        every threshold, validated; stored in EscalationPolicy (editable in Admin Settings)
  decision.py      PURE decision rules (no DB, no clock, no UI) for the three strategies
  candidates.py    candidate pool, exclusion rules, transparent scoring + explanation text
  service.py       AdaptiveEscalationService - persistence, transactions, idempotency, closure, notifications
  simulation.py    scenarios, deterministic fictional donors, virtual clock, run lifecycle, metrics
  experiments.py   3-strategy comparison, aggregation, reruns
  assistant.py     rule-based explanation / recommendation service
  presenters.py    API payloads (no contact details ever)
  views.py urls.py hooks.py   REST API (admin-only) and the bridges used by the old views
  management/commands/seed_escalation.py, evaluate_escalations.py
  tests/           101 tests (decision rules, engine, API, simulator, experiments, assistant, concurrency)
frontend/src/
  pages/admin/     CommandCenterPage, OutreachEscalationPage, SimulatorPage, StrategyComparisonPage, EscalationSettingsPage
  components/escalation/   shared, CaseViews (metrics, pipeline, timeline, decision support), CandidateTable, EscalationMap
  api/escalation.js
```

Modified existing files: `blood_requests/views.py` (approve starts the engine; cancel/fulfil/rematch inform it),
`matching/views.py` (donor view/response feed the engine), `config/settings.py` + `urls.py` (app, SQLite
`transaction_mode=IMMEDIATE`, file-backed test DB), `accounts/.../seed_data.py` (adopt seeded requests; keep open demo
requests live), `index.css` (palette), `DashboardLayout.jsx` / `AppRoutes.jsx` (navigation), `Logo.jsx` (contrast on dark sidebar).

### Migrations
* `escalation/0001_initial` - EscalationPolicy, SimulationRun, SimulatedDonor, EmergencyCase, OutreachBatch,
  OutreachAttempt, EscalationEvent, Experiment (with DB constraints: real XOR simulated case, exactly one donor kind per
  attempt, unique outreach per case/donor/stage, unique batch sequence).
* `donors/0002_alter_donorprofile_state` - **not a new feature.** Django found that `DonorProfile.state`'s default had
  drifted from migration 0001 (default-only change, no schema effect) and bundled it because `escalation` depends on `donors`.
  (An unrelated pending `bloodbank` lat/long default drift was left alone.)

No column was added to `BloodRequest` or `DonorProfile`: the engine's state lives in `EmergencyCase` (one-to-one with a request).

## 3. The algorithm

State per emergency: `EmergencyCase` (status, stage, target, remaining need) -> `OutreachBatch` -> `OutreachAttempt`
(status, score, explanation) and an append-only `EscalationEvent` timeline.

**Vocabulary (kept strictly apart).** Potential candidate -> Alert sent -> Response received (accepted/declined/no response)
-> Volunteer confirmed (= accepted) -> Hospital verification pending -> Donation outcome confirmed by the hospital.
*Accepted* is never treated as a donation or a blood unit. *No response* means **status unknown**, not unavailable or declined.

**Target and need.** `target_volunteers = units_requested x volunteers_per_unit` (default 2, a buffer for hospital
deferrals). `remaining_coordination_need = max(0, target - accepted volunteers)`. A hospital deferral ("did not donate")
removes a volunteer and reopens the need.

**Eligibility (hard filters).** Excluded: no consent, declared unavailable, inactive account, the requester, declined this
request, already accepted, already contacted (unless `allow_reminders` and the search has since expanded), missing the
information the rules need, outside every stage. Exclusion counts per reason are shown to administrators.

**Prioritisation (editable weights, default 35/25/20/20).** proximity - blood-group criteria match (exact vs listed
substitute) - profile verified by blood bank (existing flag) - freshness of declared availability. Unknown distance gives no
invented value: same-locality gets partial proximity credit, otherwise none, and the UI shows "Unknown". Past response
behaviour is deliberately **not** used. Blood-group matching reuses the platform's ABO/Rh table and is a matching rule, not
a transfusion-compatibility or eligibility decision.

**Stages.** Cumulative, configurable: radius in km, a fallback (`LOCALITY` or `CITY`) when a donor has no coordinates, and a
max batch size. Defaults: 5 / 10 / 20 km / unlimited.

**Decision cycle** (`decision.decide`, run by `service.evaluate`, idempotent):
1. Closed/cancelled/fulfilled request, or past `required_by + grace` -> close; withdraw pending alerts; no further outreach.
2. Alerts older than the response window (CRITICAL 10 / URGENT 20 / STANDARD 45 min) become `NO_RESPONSE`.
3. Need met -> `VOLUNTEERS_SECURED`, outreach paused (the request is **not** resolved).
4. First batch: stage 1 only, sized `ceil(need / expected_acceptance)` capped by the stage.
5. Later: if alerts still in their window are expected to cover the need -> wait; if the last batch is too recent -> wait;
   else top up in the current stage, sized by the shortfall.
6. Expand to the next stage only when the current stage has nobody eligible left **and** earlier alerts are answered or
   lapsed. With auto-escalation off this becomes `AWAITING_ESCALATION` until an administrator approves.
7. Nobody left / batch limit reached -> `NEEDS_ADMIN_INTERVENTION` (admins notified once).

`expected_acceptance = (accepted + prior x prior_weight) / (answered + prior_weight)`: the configured prior, replaced
gradually by observed outcomes.

**Safety.** Case row lock + transaction per mutation; repeated responses/evaluations are no-ops; unique constraints back
this up (verified with real parallel threads). Cancelled/expired cases cannot create batches.

**Baselines for comparison** (same machinery, different rule): A *broadcast* alerts the whole eligible pool once;
B *fixed* opens each stage on a timer and alerts the entire stage regardless of responses.

## 4. Explanations and the "AI" assistant

`assistant.py` is a **rule-based explanation service**. No AI API was configured in the project, so none is called; the app
needs no network or key. Each answer is built only from the recorded case, attempts, events and policy and is returned as
*known facts* / *unknowns* / *rules applied* / *suggestions*. It answers: why unresolved, why these candidates, why/why not
expanded, what is missing, which stages are done, what remains, and (from stored experiment results) how strategies compared.
Free text is routed by keywords to those intents; anything else is declined and the supported questions listed. It never
states that a message was delivered (only that a donor opened an alert), never judges compatibility or eligibility, and never
invents stock, donors or locations. **Limitation:** it is not a language model; phrasing is fixed and questions outside the
list are not understood.

## 5. Running

```powershell
# backend
cd backend
..\venv\Scripts\Activate.ps1        # or create: python -m venv ..\venv ; pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data          # also runs seed_escalation (idempotent)
python manage.py runserver 127.0.0.1:8000
# optional background worker (otherwise the Command Center / Outreach pages trigger evaluation while open)
python manage.py evaluate_escalations --loop --interval 30
# frontend
cd frontend ; npm install ; npm run dev     # http://127.0.0.1:5173
```
Sign in with any team admin (e.g. `freddy.admin@bloodconnect.org` / `Admin@1234`, or any account in `ACCOUNTS_CREDENTIALS.md`).
If your database was seeded long ago, re-run `seed_data`: it refreshes `required_by` of still-open demo requests.

## 6. Tests

```powershell
cd backend
python manage.py test                 # everything (175, incl. 59 for donation camps)
python manage.py test escalation      # new suite (101)
```
Covers: valid/invalid emergency creation; eligibility and consent exclusion; accept/decline; decline vs no-response;
need recalculation; escalation and approval mode; no duplicate outreach (incl. parallel threads); cancellation and expiry;
admin-only access and no contact-detail leakage; simulation isolation (no real rows, DB constraints, reset/purge);
experiment metrics recomputed from stored records and reproducible by seed; assistant output tracking state; the
pre-existing register -> request -> approve -> respond flow; pure decision rules without a database.

## 7. Demonstration sequence

1. **Command Center** -> *New emergency* (e.g. B+, 2 units, Fortis Malar, Critical). A request is created, verified, ranked,
   and the first batch is alerted. You land on **Outreach & Escalation**.
2. Expand a candidate row: score breakdown and plain-language reason. Press *Accept* on one (records a phone response);
   the remaining need drops from 4 to 3, the status stays "collecting responses", the timeline gains an event.
3. Ask **Decision support** "Why is this request still unresolved?" and "Why did the system prioritise these candidates?".
4. Sign out and log in as a donor (e.g. `donor.o_neg@bloodconnect.org`), open the alert, accept; return as admin and watch it flow in.
5. **Emergency Simulator** -> "No response in the initial area" -> Create -> Start. Watch batch 1 go quiet, the response
   window elapse (status *unknown*, not declined), then the escalation and search-area expansion events. Try Pause/Step/Reset
   and the other four scenarios. All data is fictional and nothing is sent.
6. **Strategy Comparison** -> run a scenario -> compare the three strategies in the table and charts, *Rerun same seeds*
   (identical numbers), *Rerun with new seeds*, *Explain these results*, *Open timeline* for any run.
7. **Admin Settings**: change a stage radius or response window, save, and run a new simulation to see behaviour change.
8. Cancel an emergency (Outreach page, or the requester's cancel button): pending alerts are withdrawn and no further
   outreach is generated.

## 8. Known limitations and integrations that do **not** exist

* No SMS, e-mail, push or phone gateway: "alert sent" means an in-app notification record; delivery is confirmed only when
  the donor opens it. No real hospital, blood-bank stock, GPS or government integration.
* No built-in scheduler: time-based decisions run when an administrator has the Command Center / Outreach page open, via
  `evaluate_escalations`, or when a donor responds. Use cron/Celery beat in production.
* Simulation results come from scripted fictional donors. They are **not** measured hospital performance. In the shipped
  scenarios Adaptive is typically *slower* than Broadcast but contacts far fewer people; it is not tuned to win. Re-run with
  different seeds before drawing conclusions.
* Locality reference points are approximate and used only when a request has no coordinates (always labelled approximate).
  Donor map positions are rounded to ~1 km.
* Threaded concurrency is verified on SQLite only; PostgreSQL relies on `select_for_update` (not exercised here).
* The explanation assistant is rule-based (see section 4). The frontend has no automated tests; it was exercised with a
  headless-browser walkthrough (all pages, no API/JS errors, no horizontal overflow at 390 px) and `vite build`.
* Approving a request whose required time has passed is now rejected (400) instead of silently alerting donors.
* Approval now alerts only the initial batch instead of every compatible donor; use *Approve next batch* or let the engine escalate.
