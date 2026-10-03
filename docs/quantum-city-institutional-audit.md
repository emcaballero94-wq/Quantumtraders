# Quantum City — Institutional Trading Floor: Phase 0 Audit

Audit of the existing Quantum Traders codebase against the "Institutional Trading
Floor" brief (departments, event-driven architecture, MANDO decision core, risk
firewall, Tree of Life geometry). **No code was changed for this audit.** It builds
on `docs/quantum-city-architecture.md` (the first Quantum City audit) and
`docs/mando-v2-roadmap.md`, re-verified against `main` at `2bc0e99`.

Every claim below points at a file. Where something does not exist, it says so.

---

## 1. Current architecture (verified)

| Layer | What exists |
|---|---|
| Frontend | Next.js 15 App Router, React 19, Tailwind with theme tokens (`app/globals.css`, gold/blue themes), ~35.8k lines across `app/`, `lib/`, `components/`. 17 dashboard pages. |
| Backend | 48 stateless serverless API routes under `app/api/**`. **No long-running process, no worker, no queue.** |
| Database | Supabase Postgres, dedicated `quantumtraders` schema (`supabase/schema.sql`), accessed only with the service-role key (`lib/supabase/admin.ts`). 14 tables (§4). |
| Auth | Supabase Auth; `lib/supabase/middleware.ts` is default-deny and only lets `isOwnerEmail()` users into `/dashboard` and most `/api/*`. Single-owner, not multi-tenant. |
| Scheduled jobs | Two daily Vercel crons (`vercel.json`): `/api/cron/gex-snapshot` 21:30 UTC, `/api/cron/options-flow-outcomes` 22:00 UTC, guarded by `CRON_SECRET`. |
| AI | Claude Haiku narrates deterministic facts (GEX, Options Flow, Order Flow briefs, Pulse brief, chat). Every call has a non-AI fallback and is logged to `ai_usage_log`. |
| Realtime | No server→browser push. Browser polls our REST routes (20–60 s) and holds its own WebSockets to Binance/Deribit (`components/orderflow/*`). |
| 3D | `/dashboard/city` + hero on `/dashboard` (`components/quantum-city/*`), Tree of Life layout, reads `/api/quantum-city/state` and `/events`, couriers driven by real events and by M.A.N.U. chat sources (`lib/quantum-city/manu-bus.ts`). |
| Tests | 179 Vitest tests, all under `lib/**` (`manu` 8 files, `options-flow` 9, `gex` 3, `manu-gex` 3, `manu-options-flow` 2, `auth` 1, `quantum-city` 1). No API-route or UI tests. |

## 2. External integrations (verified)

| Integration | Direction | What it does | Where |
|---|---|---|---|
| **MT5** | MT5 → app, **one-way** | Expert Advisor `QuantumJournalBridge.mq5` posts every **closed** deal (entry, exit, SL/TP, profit, commission, swap) to `POST /api/journal/trades` with `source: "mt5"`, authenticated by `MT5_JOURNAL_API_KEY`. It does **not** send open positions, balance, equity or margin, and the app **cannot** send anything back to MT5. | `mql5/`, `app/api/journal/trades/route.ts` |
| **OANDA** | read-only | Quotes and candles for forex, metals, indices, oil (`OANDA_ENVIRONMENT` practice/live). No order endpoints are used. | `lib/market-data.ts` |
| **Binance** | read-only | Crypto quotes (server) + trade tape / book / liquidations / derivatives over the browser's WebSocket. | `lib/market-data.ts`, `components/orderflow/*` |
| **Deribit** | read-only | Crypto options chain and flow. | `lib/deribit-data.ts`, `lib/options-flow/*` |
| **Tradier** | read-only | Equity options chain for GEX. | `lib/tradier-data.ts` |
| **Yahoo Finance** | read-only | History fallback. | `lib/market-data.ts` |
| **ForexFactory** | read-only | Economic calendar (TradingEconomics free tier is dead and skipped). | `lib/oracle/macro-feed.ts` |
| **Coinbase Commerce** | inbound webhook | Subscription payments (`crypto_payment_*`). **This is billing, not treasury.** | `app/api/payments/*` |
| **Anthropic** | outbound | Narration + chat. | several routes |
| NinjaTrader | — | **Does not exist.** Only mentioned as a future possibility in the chat's system prompt. | `app/api/oracle/chat/route.ts:606` |
| Telegram | — | **Does not exist.** | — |
| StrategyQuant (SQX) | — | **Does not exist** (no file, type or table references it). | — |
| Order placement (any venue) | — | **Does not exist.** No code anywhere sends an order. | — |

## 3. Brief departments → what the code has today

| Department | Existing modules | Status |
|---|---|---|
| **01 Market Intelligence** | Scanner (`lib/scanner/conditions.ts`, 9 conditions × 14 assets), Order Flow engine (`lib/manu/{market-state,change-detection,event-engine,relationships}.ts`), GEX (`lib/gex`, `lib/manu-gex`), Options Flow (`lib/options-flow`, `lib/manu-options-flow`), Macro/Pulse (`lib/oracle/macro-engine.ts`, `macro-feed.ts`, `risk-regime.ts`), Nexus correlations (`/api/market/correlations` over `lib/market-data.ts`), Atlas technical (`lib/oracle/technical-engine.ts`), news, quotes, history | **Real and the strongest part of the system.** Each engine is isolated; outputs have bespoke shapes. |
| **Research / Strategy** | Oracle score engine (`lib/oracle/score-engine.ts`: technical + macro + timing → `OracleScore`, `Rating`, `Bias`), setup rules (`lib/oracle/setup-rules.ts`, `/api/oracle/setup-score`), historical validation + forward returns for Order Flow patterns (`lib/manu/historical-validation.ts`, `forward-returns.ts`), Options Flow 24h outcome scoring (`brief_outcomes`) | **Partial.** Scores and biases exist; there is no thesis object, no strategy concept, no registry, no backtest storage. |
| **Risk** | Lot/position-size calculator (`app/dashboard/calculators`, `components/tools/LotCalculator.tsx`, client-side only), pre-trade checklist flag `pre_risk` (`trade_journal_checklists`), VIX risk regime | **Minimal.** Nothing evaluates exposure, drawdown, daily loss or correlation, and nothing can approve or block anything. |
| **Portfolio** | Open trades in `trade_journal_entries` (`result = 'OPEN'`, manual entries only — MT5 sends closed deals) | **Missing.** No positions source of truth, no exposure aggregation. |
| **MANDO** | `/dashboard` cockpit (regime sentence, aggregate bias, radar, agenda, AI brief), M.A.N.U. chat (`/api/oracle/chat`), Quantum City rollup (`mando` in `/api/quantum-city/state` = "N/M engines with recent activity") | **Partial.** It aggregates and narrates; it has no action state. See conflict §7.1. |
| **Execution** | — | **Missing.** |
| **Treasury** | — (Coinbase payments are subscriptions, not trading capital) | **Missing.** No balance, equity or margin source. |
| **Governance / Audit** | Trade journal + checklists + MT5 auto-import (`/dashboard/tools`), psychology mirror (`/dashboard/mind`), `ai_usage_log`, `brief_outcomes`, `orderflow_briefs.snapshot` (stores the data each brief saw) | **Partial.** Trades are recorded, but a trade is not linked to the signal, brief or state that preceded it. |

## 4. Database (14 tables, `quantumtraders` schema)

| Group | Tables | Notes |
|---|---|---|
| Market intelligence | `orderflow_briefs`, `market_events`, `gex_snapshots`, `gex_briefs`, `options_flow_briefs`, `oracle_alerts` | `market_events` is Order-Flow-only and keeps **only HIGH/CRITICAL**. `oracle_alerts` has its own type/severity vocabulary. |
| Research feedback | `brief_outcomes` | Options Flow lean vs. 24h price; the only prediction-vs-actual table. |
| Journal | `trade_journal_entries` (with `source manual|mt5`, `lot_size`, `exit_price`, `commission`, `swap`, `closed_at`), `trade_journal_checklists` | The existing journal. **Must be extended, not duplicated.** |
| Ops | `ai_usage_log` | Cost observability. |
| Unrelated to the floor | `academy_*`, `crypto_payment_*` | Leave alone. |

There is **no** generic events table, no strategies table, no positions/accounts
table, no decisions table.

## 5. Current data flow

```
Data sources (OANDA · Binance · Deribit · Tradier · Yahoo · ForexFactory)
        ↓  per request
Deterministic engines in lib/ (scanner, manu, gex, options-flow, oracle)
        ↓  optional
Claude narration (fallback without key, logged)
        ↓
Persisted briefs/events (Supabase)          MT5 EA ──► trade_journal_entries
        ↓  read-only aggregation
/api/quantum-city/state · /events  ──►  Quantum City (polling 20 s)
        └──────────────── no Risk, no Portfolio, no Execution after this ─────┘
```

The loop the brief describes (event → research → risk → portfolio → MANDO →
execution → P&L → learning) stops after "narrate and display". Nothing downstream
exists yet.

## 6. Findings A–G

**A. Already exists and works** — the Market Intelligence engines; persisted briefs;
Options Flow outcome scoring; Order Flow historical validation; the owner-only gate;
AI-with-fallback and cost logging; MT5 → journal bridge; the Quantum City floor,
event bus reader and M.A.N.U. → floor signal; the honesty rule
(`implemented: false` stations render dark, `DATA UNAVAILABLE` states on GEX/Options).

**B. Partially implemented**
- Event model: `market_events` (Order Flow, HIGH/CRITICAL only), `oracle_alerts`,
  and `/api/quantum-city/events` (a read-only merge of five tables into `CityEvent`).
- Market state / regime: per-symbol micro regime (`lib/manu/types.ts`
  `TRENDING_UP|TRENDING_DOWN|RANGING|VOLATILE|UNKNOWN`) and portfolio-wide VIX
  regime (`Risk-On|Neutral|Risk-Off`) + aggregate bias — never reconciled.
- Research: scores and biases, no thesis/strategy objects.
- Risk: one client-side sizing calculator and a checklist boolean.
- Governance: journal without decision lineage.

**C. Duplicated or overlapping**
- Two "market state"/regime concepts (above).
- Three event shapes (`market_events`, `oracle_alerts`, `CityEvent`).
- "MANDO" means three things: the `/dashboard` cockpit, the M.A.N.U. chat
  (its storage key is `qt_mando_level`), and the center of the floor.
- `lib/oracle/mock-data.ts` is dead code (imported nowhere). Not harmful, but it
  should be deleted so nobody wires it in by mistake.

**D. Reuse as-is** — every engine in `lib/`; `lib/server/{api-cache,endpoint-guards,rate-limit}.ts`;
`lib/supabase/admin.ts`; the journal tables and API; the MT5 bridge and its
shared-secret pattern; `brief_outcomes` + its cron pattern; `/api/quantum-city/*`
as the floor's read model; `lib/quantum-city/tree-route.ts`.

**E. Refactor (wrap, don't replace)**
- Put a normalizing adapter in front of the three event shapes instead of
  migrating them.
- One market-state aggregator that *reads* both regime concepts and outputs one
  object (no new compute engine).
- Make `/api/quantum-city/state` consume that aggregator and per-department states
  instead of per-engine recency only.

**F. Missing** — strategy registry; risk engine/firewall; portfolio and positions;
treasury (no capital data at all); execution; decision log linking signal →
decision → trade; SQX support; any scheduler finer than daily; server push.

**G. Do not touch** — the owner gate (`middleware.ts`, `access-control.ts`); the
MT5 shared-secret check; the `quantumtraders` schema isolation and service-role
pattern; the AI fallback and `ai_usage_log`; Binance browser WebSockets; the
"no fake activity" rule and `implemented` flags; academy and payments.

## 7. Conflicts that need a decision before building

### 7.1 MANDO's "never recommend a trade" rule vs. ACTION STATE
`docs/mando-v2-roadmap.md` §2/§5 and the AI prompts state that M.A.N.U. narrates and
**never** recommends buy/sell. The brief asks MANDO to output `WATCH / PREPARE /
EXECUTE / REDUCE / HEDGE / EXIT / HALT`.
**Recommendation:** keep the AI rule. Produce the action state with
**deterministic, testable rules** (regime + risk limits + portfolio limits), label
it as rule output, and let the AI only explain it. `EXECUTE` stays unreachable
until Phase 9.

### 7.2 "Continuous loop" vs. a serverless app with two daily crons
Nothing runs between user requests. A continuous loop needs a scheduler.
Options: (a) Vercel cron every minute (needs a Pro plan; the current daily-only
crons suggest the plan may be Hobby — **needs confirming**), (b) Supabase `pg_cron`
calling a route, (c) a small always-on worker. **Recommendation:** start with (a) or
(b) at 1–5 min; keep the browser-driven Order Flow path as is.

### 7.3 No capital data → Portfolio and Treasury can't be real yet
AUM, available capital, margin, exposure and open positions have no source. The
cleanest real source is the **existing** MT5 EA: extend it to also POST account
equity, balance, margin and open positions (still read-only, same secret). Until
then these panels must show `DATA STATUS: UNAVAILABLE`.

### 7.4 Execution is a security change, not a feature
Today nothing in the app can move money. Adding order sending (MT5 EA polling an
approved-orders endpoint, or a broker API) changes the threat model: a compromised
owner session or leaked key could trade. **Recommendation:** do not build
execution before Phases 1–8 are done and tested; when it comes, require a
separate secret, a per-order approval record, hard limits enforced server-side,
and a kill switch.

### 7.5 SQX format unknown
No SQX artifacts exist in the repo. Before designing the registry's import, we need
to know what SQX exports for these strategies (MQL5 EA? NinjaScript? only metrics?)
and where they run. If they run as MT5 EAs, their trades already reach the journal
through the bridge and can be tagged by magic number.

## 8. Tree of Life → department map (proposal for Phase 6)

The current floor puts **engines** on the tree (MACRO top, OPTIONS/GEX, ATLAS/FLOW,
M.A.N.U. center…). The brief asks for **departments** on the tree. The 10 circles
and the 19 lines already in `components/quantum-city/stations.ts` fit the
department flow without adding a single line:

| Circle | Department | Why it fits |
|---|---|---|
| Top (keter) | Market State / Regime | single input to the central axis |
| Upper right (chokmah) | Market Intelligence | raw observation |
| Upper left (binah) | Research / Strategy | turns observation into hypotheses |
| Middle right (chesed) | Portfolio | allocation, expansion |
| Middle left (gevurah) | Risk | restriction, limits |
| Center (tiferet) | **MANDO** | synthesis, joined to 8 circles |
| Lower right (netzach) | Treasury / Capital | resources |
| Lower left (hod) | Governance / Audit | records and review |
| Lower center (yesod) | Execution Desk | the only path from MANDO to the market |
| Bottom (malkuth) | Positions / P&L | reality |

Existing lines then read as real flows: Intelligence→Research (chokmah–binah),
Research→Risk (binah–gevurah), Intelligence→Portfolio (chokmah–chesed),
Risk→MANDO, Portfolio→MANDO, Regime→MANDO (keter–tiferet), Treasury→Portfolio
(netzach–chesed), MANDO→Execution (tiferet–yesod), Execution→Positions
(yesod–malkuth), Positions→Governance (malkuth–hod) and the learning loop
Governance→Risk→Research (hod–gevurah–binah). Today's engines become **units inside
their department circle** (Scanner, Flow, GEX, Options, Macro, Nexus, Atlas inside
Market Intelligence; Journal and Review inside Governance; Mind inside Governance or
Risk). Departments without a backend render dark, as today.

## 9. Implementation plan (each phase = one reviewable PR, tests first)

| Phase | Scope | Reuses | Tests |
|---|---|---|---|
| **1 Event model** | `lib/events/` taxonomy + `QcEvent` type with the brief's fields; adapters mapping `market_events`, `oracle_alerts`, briefs and journal rows into it (read-only); a new `system_events` table **only** for events with no home today (`SIGNAL_GENERATED`, `RISK_BREACH`, `DECISION_*`, `SYSTEM_ALERT`). `/api/quantum-city/events` switches to the adapter. | existing tables, `CityEvent` | adapter mapping per source; severity normalization; no event invented when a source is empty |
| **2 Market State** | `lib/market-state/` aggregator: VIX regime + aggregate bias + per-symbol Order Flow regime + calendar risk → one `MarketState` with per-field `dataStatus`. | `risk-regime.ts`, `live-state.ts`, `manu/market-state.ts` | unavailable input → `UNKNOWN`, never a guessed value |
| **3 Department state** | `DepartmentState {status, lastEvent, currentState, activeTask, output, dataStatus}` for the 8 departments, computed from Phases 1–2; departments without a backend return `NOT_IMPLEMENTED`. | `/api/quantum-city/state` | each department's mapping |
| **4 Reaction engine** | Pure functions `react(event, state) → {department, reaction, nextDepartments}` + a route the scheduler (§7.2) calls; writes reactions to `system_events`. | event bus | event propagation; data failure → no reaction |
| **5 MANDO** | Deterministic `ActionState` from market state + risk + portfolio; AI explains only. Exposes what happened / why / what changed / who reacted / proposed action / uncertainty. | `/dashboard` cockpit, M.A.N.U. | rule table; HALT on missing data; EXECUTE unreachable |
| **6 Tree visualization** | Re-map the floor to departments (§8) driven by Phase 3/4 state; engines as units inside circles. | current floor, `tree-route.ts` | route tests already exist |
| **7 Audit / Journal** | `decision_id` + `event_ids` on journal entries (new nullable columns), decision log view "why did the system do this". | existing journal | complete decision trail |
| **8 Simulation** | Explicit `MODE: SIMULATION` path: replay stored events → reactions → simulated fills → journal rows tagged `source: 'simulation'`. | `orderflow_briefs.snapshot`, `market_events` | simulation never touches live tables untagged |
| **9 Live** | Only after 1–8: MT5 account/positions report (read), then guarded execution (§7.4). Strategy registry + SQX import once §7.5 is answered. | MT5 bridge | risk block → no order; rejected order → MANDO/Risk notified |

Risk Engine and Portfolio Engine (brief §5, §6, §22) start in Phase 4/5 as **pure
limit checks over data we actually have** (journal open trades, calculator inputs),
and only become exposure-aware once §7.3 provides positions and capital.

## 10. Decisions needed from the owner

1. **MANDO action state**: OK to output deterministic WATCH/PREPARE/… while the AI
   keeps its "never recommend" rule? (§7.1)
2. **Scheduler**: which Vercel plan is the project on, and is a 1–5 min cron (or
   Supabase `pg_cron`) acceptable? (§7.2)
3. **Capital data**: extend the MT5 EA to report account and open positions? (§7.3)
4. **SQX**: what do the SQX strategies export, and on which platform do they run? (§7.5)
5. **Tree re-map**: move the floor from engines to departments (§8) when Phase 6
   arrives, or keep engines on the tree and show departments as an overlay?
