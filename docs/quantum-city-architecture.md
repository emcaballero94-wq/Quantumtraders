# Quantum City — Architecture Audit & Integration Plan

Audit performed before writing any Quantum City code, per the product brief's own rule: understand the real system first, never invent agents or data the backend doesn't actually produce.

## 1. Current architecture

- **Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 3, Supabase (Postgres + Auth), Vercel (hosting + Cron). No Redux/Zustand — state is local `useState`/`useEffect` per page.
- **Runtime model**: almost everything is a **stateless serverless API route** (`app/api/**/route.ts`) that computes something on request and optionally persists a row to Supabase. There is no long-running backend process, no job queue, no worker pool.
- **Two scheduled jobs** (`vercel.json`): `/api/cron/gex-snapshot` (daily close-of-day GEX snapshot) and `/api/cron/options-flow-outcomes` (daily outcome scoring), both auth'd via a `CRON_SECRET` bearer token (`rejectIfNotCron`), unrelated to Supabase user sessions.
- **AI narration**: Anthropic Claude (`claude-haiku-4-5-20251001`) is called from a handful of routes to turn deterministic numbers into Spanish prose. Every call is optional — if `ANTHROPIC_API_KEY` is missing, a deterministic (non-AI) narrative is built instead from the same facts. Every call is logged to `ai_usage_log` (route, tokens, estimated cost).
- **Auth**: Supabase Auth (email/password + Google OAuth). `lib/supabase/middleware.ts` is a **default-deny gate**: only the landing page, `/login`, `/auth`, the Coinbase webhook, cron routes, and two read-only quote/history endpoints are public. Everything else (the whole `/dashboard` and most `/api/*`) requires a logged-in **owner** (`isOwnerEmail`) — this is a recent, single-owner demo-phase restriction, not a multi-tenant RBAC system.
- **Data isolation**: all app tables live in a dedicated `quantumtraders` Postgres schema (shared project with other apps), accessed only through the service-role key (`lib/supabase/admin.ts`), which bypasses RLS.

## 2. Existing relevant modules (mapped to the brief's proposed "departments")

| Brief's concept | What actually exists today | Real or to-be-built |
|---|---|---|
| **MANDO** (command center) | `/dashboard` (`app/dashboard/page.tsx`, component `CommandPage`) is **already branded "MANDO"** in the sidebar nav (`labelKey: 'mando'`, `MandoIcon`) and is already the aggregation cockpit: regime sentence, aggregate bias meter, session timeline, key instruments, top opportunities (from Scanner's radar), market-state column, economic agenda, AI brief, recent trade audit. | Real, and already the best candidate for the literal MANDO station. |
| **SCANNER** | `/dashboard/scanner` + `/api/scanner` + `lib/scanner/conditions.ts`. Evaluates 9 fixed conditions (breakout, trend, reversal, high/low volatility, RSI extreme, MA cross, ATR expansion/compression) over 14 fixed assets (`SCANNER_ASSETS`) and 5 timeframes. | Real, but **stateless** — computed fresh on every GET request, no persisted "status" field, nothing "running in the background." |
| **MACRO** | `/dashboard/pulse` + `lib/oracle/macro-engine.ts` + `lib/oracle/risk-regime.ts` (VIX → Risk-On/Neutral/Risk-Off) + economic calendar (ForexFactory current-week feed; TradingEconomics' free tier is dead — HTTP 410, already patched to skip rather than fail). | Real. |
| **FLOW** | `/dashboard/orderflow` + `lib/manu/market-state.ts`, `change-detection.ts`, `event-engine.ts`, `relationships.ts`. The most sophisticated engine: the **browser** holds a raw WebSocket to Binance (trade tape, order book, liquidations, derivatives — see `components/orderflow/*`), accumulates CVD/liquidation totals client-side, and POSTs a snapshot to `/api/manu/analyze` roughly every 5–60s. That route computes `MarketState`, classifies `ChangeClass` per variable, derives `MarketEvent[]`, and persists a brief to `orderflow_briefs` (HIGH/CRITICAL events also go to `market_events`). | Real, and the closest thing to the brief's "Scanner detects → event → Strategy" pipeline — except there is no Strategy after it today. |
| **OPTIONS** | Two separate engines: (a) **GEX & Options** (`/dashboard/gex`, `lib/gex/*`, `lib/manu-gex/*`) — equity + crypto gamma exposure, daily snapshot via cron; (b) **Options Flow** (`/dashboard/options`, `lib/options-flow/*`, `lib/manu-options-flow/*`) — Deribit BTC/ETH flow, noise/lottery filter, 24h outcome tracking (`brief_outcomes`, just shipped). Both generate a "brief" **on page open/refresh**, not on a fixed loop. | Real. If Deribit/Tradier data is unavailable the UI already shows "no data" states — this already matches the brief's "DATA UNAVAILABLE" rule. |
| **TECHNICAL** | `/dashboard/atlas` — embedded TradingView chart + 20-symbol watchlist + Oracle Scanner score + "JARVIS zones" + filtered news. No separate "Technical" backend engine; it reuses `lib/oracle/score-engine.ts` and the Scanner conditions. | Real (as a page), not a standalone engine. |
| **NEXUS** (not in the brief's list, but a real existing department) | `/dashboard/nexus` — Pearson correlation matrix across assets + sector rotation strength. | Real. Worth including as its own station since it already has its own brand color and nav slot. |
| **STRATEGY** | **Does not exist.** No thesis-builder, no code that combines Scanner+Technical+Flow+Options+Macro into a directional bias beyond the Command page's simple "average Scanner score" aggregate. | Not implemented. |
| **RISK** | **Does not exist.** No position-sizing, no exposure/R:R/drawdown validation, no approve/reject gate anywhere in the codebase. | Not implemented. |
| **EXECUTION** | **Does not exist.** No MT5/NinjaTrader/exchange order-placement integration. `trade_journal_entries.source` has an `'mt5'` enum value reserved for a *future* auto-import, but nothing writes it today — all journal entries are manually typed by the trader after the fact. | Not implemented. |
| **JOURNAL** | `/dashboard/tools` (Trade Audit — manual entry + pre/post checklist, `trade_journal_entries`/`trade_journal_checklists`) and `/dashboard/mind` (tilt/psychology monitor, rules, emotion-vs-P&L mirror). | Real. |
| **REVIEW** | Narrow but real: `brief_outcomes` (built this session) scores whether Options Flow's BULLISH/BEARISH/NEUTRAL lean was right 24h later, via a daily cron — the only engine with an honest directional lean today. GEX's "status" is a gamma-regime read, not a directional call; Order Flow briefs are free text. No prediction-vs-actual review exists for trades themselves (Journal has no outcome grading). | Partially real, scoped to one engine. |
| **M.A.N.U.** (global AI) | `components/layout/QuantumAI.tsx` — a floating chat panel on every `/dashboard/*` page, calling `/api/oracle/chat`. Its own `localStorage` key is literally `qt_mando_level`, i.e. **internally this chat is also colloquially "Mando"** — a naming overlap with the `/dashboard` page's own "MANDO" nav label that the product should resolve explicitly (see §11, open question). | Real. |

## 3. Existing data flow

```
Market data sources
  Yahoo Finance history (lib/market-data.ts) · Binance WS (client-side, Order Flow only)
  Deribit REST+WS (crypto options) · Tradier (equity options) · TradingView embed (Atlas chart)
  ForexFactory calendar (macro)
        ↓
Engine compute (pure TS, per-request)
  lib/scanner, lib/manu, lib/manu-gex, lib/manu-options-flow, lib/oracle/*
        ↓
Optional AI narration (Claude Haiku, behind ANTHROPIC_API_KEY, logged to ai_usage_log)
        ↓
Persistence (Supabase `quantumtraders` schema, service-role only)
  orderflow_briefs · market_events · gex_briefs/gex_snapshots · options_flow_briefs
  brief_outcomes · trade_journal_* · oracle_alerts
        ↓
Client polling (setInterval + fetch, 30–60s cadence) renders React state
```

There is **no push layer** from the backend to the browser. "Realtime" today means either (a) the browser's own WebSocket straight to an exchange, or (b) polling our own REST endpoints on a timer — the same pattern `app/dashboard/page.tsx` (Command/MANDO), `Sidebar.tsx` (session strip), and every other live page already use.

## 4. Existing agent architecture

There is no "agent" abstraction and no event bus. Each engine is an isolated API route + lib module. The only cross-engine communication found is **one-way and on-demand**: `/api/manu/analyze` (Order Flow) reads the latest **persisted** GEX brief (`fetchGexCrossContext`) to give its AI prompt cross-context — it does not subscribe to GEX, it just reads the last row written, with a 24h staleness cutoff.

## 5. Existing realtime infrastructure

- **Server → browser push: none.** No Supabase Realtime channel (`supabase.channel(...).on('postgres_changes', ...)`) exists anywhere in the repo (verified by search). No SSE, no custom WebSocket server.
- **Browser → exchange**: raw WebSocket connections live in `components/orderflow/{TradeTape,OrderBookHeatmap,LiquidationsFeed,DerivativesPanel}.tsx`, talking directly to Binance/Deribit from the client.
- **Browser → our backend**: `fetch` on a `setInterval`, typically 30–60s.

## 6. Existing Market State

Two distinct, **unreconciled** concepts both called "market state" in the codebase:

1. **Micro, per-symbol** (`lib/manu/types.ts` → `MarketState`, used only by Order Flow): price/CVD/funding/OI deltas over 1m/5m/15m windows, `marketRegime: TRENDING_UP | TRENDING_DOWN | RANGING | VOLATILE | UNKNOWN`, `dataQuality: GOOD | DEGRADED | INSUFFICIENT`.
2. **Macro, portfolio-wide** (Pulse/Command page): VIX-derived `Risk-On | Neutral | Risk-Off` (`lib/oracle/risk-regime.ts`) + aggregate Scanner-radar bias (`computeAggregateBias`) + sector strength + active trading sessions.

Nothing today produces the brief's single global label (`CALM | TRENDING | RANGING | HIGH VOLATILITY | RISK ON | RISK OFF | TRANSITION`) — it would need a **thin new aggregator** combining the two existing signals, not a new compute engine.

## 7. Existing Scanner

Confirmed stateless and synchronous: a GET request evaluates conditions over freshly-fetched candles and returns rows in the same response — `IDLE`/`ANALYZING`/`OPPORTUNITY_FOUND` are not states the backend holds between requests; they would have to be **inferred client-side** from request lifecycle (loading → done) or from how recently a Scanner-sourced opportunity was written into Command's radar.

## 8. Existing MANDO

See §2. Two things already carry the "Mando" name: the `/dashboard` cockpit page (nav label, the obvious visual anchor) and the M.A.N.U. chat panel's storage key. Recommend treating **`/dashboard`'s own aggregated state** (regime, bias, radar, agenda, AI brief) as what the Quantum City MANDO station visualizes — it already *is* the orchestrator view, just rendered as 2D cards today.

## 9. Existing database/events

`quantumtraders` schema tables relevant to Quantum City: `oracle_alerts`, `orderflow_briefs`, `market_events` (Order-Flow-specific event log, **HIGH/CRITICAL severity only** — LOW/MEDIUM events are shown live and discarded, never persisted), `gex_snapshots`, `gex_briefs`, `options_flow_briefs`, `brief_outcomes`, `trade_journal_entries`/`trade_journal_checklists`, `ai_usage_log`. There is **no generic `agent_events` table** — every engine has its own bespoke shape. `market_events` is the closest thing to a generic event log but is scoped to Order Flow only and lossy by design (only serious events survive).

## 10. Existing UI system

Tailwind with CSS-variable-driven theme tokens (`app/globals.css`, light/dark via `:root` / `.dark` blocks). Four brand accent colors already exist and are reused everywhere (nav dots, badges, glows, shadows): `atlas` (green/teal), `nexus` (violet), `pulse` (orange/amber), `oracle` (gold/blue — also the AI's own color). A `.glass-card` utility already implements the "premium dark glass panel" look the brief asks for. Fonts: IBM Plex Sans/Mono/Serif. **No 3D library is installed** — `three`, `@react-three/fiber`, `@react-three/drei` are not in `package.json`.

## 11. Recommended Quantum City integration

- **Route**: new `/dashboard/city` page, inheriting the existing owner-only gate automatically (no new auth work — `middleware.ts`'s default-deny already covers any new path under `/dashboard`).
- **3D runtime**: React Three Fiber + drei, **lazy-loaded** via `next/dynamic({ ssr: false })` exactly like `TradingViewChart` already is on Atlas — the 3D bundle never loads for any other page.
- **Data access — the hard constraint**: Quantum City must **never re-run engine logic or trigger new AI calls**. It should read a **new, thin aggregator endpoint** (`/api/quantum-city/state`) that does nothing but fetch the *already-persisted* latest row from each engine (`orderflow_briefs`, `gex_briefs`, `options_flow_briefs`, `market_events`, Scanner's own on-demand read reusing the existing 60s `withApiCache`, Pulse's risk-regime + radar, recent `trade_journal_entries`, `brief_outcomes` accuracy) and shapes them into one normalized response. This is a read-only, zero-cost aggregation layer, not a new engine.
- **"Realtime"**: client-side polling against that one endpoint, same `setInterval(fetch, …)` pattern every other page already uses — no new infra, per the brief's own §20 instruction to reuse what exists.
- **Open naming question for the product owner**: should the MANDO station visualize `/dashboard`'s existing aggregate state, or should it also absorb the M.A.N.U. chat panel into the 3D view? Recommendation above assumes the former (lower risk, no change to the chat panel).
- **Stations with no backend to visualize** (Strategy, Risk, Execution, and whole-trade Review): per the brief's own §0/§37 rule, these must either be **omitted from the floor entirely** until real logic exists, or rendered permanently `IDLE`/`NOT IMPLEMENTED` — never animated to look like they're working.

## 12. Dependencies required

`three`, `@react-three/fiber`, `@react-three/drei` (new). Nothing else — the data layer reuses existing Supabase admin client and API patterns.

## 13. Risks

- **Bundle/perf**: mitigated by route-level lazy loading (established pattern already in the repo).
- **Naming collision** on "MANDO" (§11) — needs a product decision, not a blocker to Phase 1.
- **Fake-activity temptation**: Strategy/Risk/Execution/whole-trade-Review don't exist — must not be animated. This is the single easiest way to violate the brief's own §37 "no fake AI" rule, so it's called out explicitly here.
- **AI cost**: the aggregator must only *read* persisted briefs, never call `/api/manu/analyze`, `/api/manu/gex-analyze`, etc. itself.
- **Mobile**: no 3D exists yet to benchmark against low-end devices — must validate the "Lite" fallback (reuse the existing `FeatureGrid` card pattern) early rather than as an afterthought.

## 14. Implementation phases (adapted from the brief's §33, scoped to what's real)

1. **Shell**: route, camera (isometric, zoom/pan), static floor, placeholder stations for the engines that actually exist (Mando, Scanner, Atlas, Nexus, Pulse/Macro, Flow, GEX, Options, Journal, Mind), responsive 2D fallback. No live data yet — stations render `IDLE`.
2. **Read-only state wiring**: build `/api/quantum-city/state`, poll it, drive each station's idle/active visual from real recency (e.g. "a brief was generated <2 min ago" → active glow) — still no agent movement/animation between stations.
3. **Event visualization**: surface `market_events` (Flow) and brief creation timestamps (GEX/Options) as a timeline/event log UI element; agent-to-agent "travel" animation only for flows that are real (e.g. Flow → GEX cross-context read in §4).
4. **Click/inspect**: Agent Inspector panel per station, reusing each engine's existing brief/facts shape — no new data model, just a new presentation of data the pages already fetch.
5. **Polish/perf pass**: instancing, LOD, mobile Lite mode validation, FPS/memory observability.
6. Anything involving Strategy/Risk/Execution/Review-of-trades is explicitly **out of scope** until those backends exist for real.
