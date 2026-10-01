# MANDO v2 — roadmap derived from auditing `ai-investment-skills`

Source audited: https://github.com/tellmefrankie/ai-investment-skills (MIT license,
confirmed in its `LICENSE` file). This doc corrects a few claims from the first pass
over that repo against what's actually in it, then turns the parts worth keeping into
concrete, sequenced work against MANDO's real codebase (`lib/options-flow/`,
`lib/manu-options-flow/`, `lib/manu-gex/`, `lib/oracle/`).

## 0. What's actually in the repo (reality check)

`options-flow-analyzer/`, `investment-briefing-agent/`, and `multi-agent-orchestrator/`
each contain **one file**: a `SKILL.md`. These are Claude Code skill *prompts* (plus a
sales pitch for a $29 Gumroad bundle) — not implementations. There is no Polygon.io
client, no 9-wave pipeline, no orchestrator code anywhere in the public repo. The "real
calls = strike within 5% of spot" and "anomaly thresholds: P/C shift >0.3, OI surge
>30%, IV spike >20%" lines are prose in that pitch, unverified by any test in the repo.

The only real, tested code is under `test/`:
- `test/lottery-filter.test.ts` + `test/fixtures/{rxrx-noisy,cel-clean}-options.json` —
  a ~20-line reference implementation of the lottery filter, with before/after fixtures.
- `test/fixtures/eval-fixture-schema.ts` + `test/eval-fixture.test.ts` — a well-designed
  TypeScript schema for separating **signal** (raw observed data) from **reasoning**
  (what an AI "critic" concluded) from **outcome** (what actually happened), plus
  accuracy-scoring helpers.

MANDO already has more real, tested backend than this entire repo (147 tests across
`lib/options-flow/`, live Deribit integration, persisted briefs). So: audit for ideas,
don't port code — there's barely any code to port, and what MANDO already has is more
mature.

**Correction to the earlier read of this repo**: the actual lottery-filter threshold in
the only working code is `bid <= 0.05 && ask <= 0.05` on calls — a flat 5-cent price
cap, not "delta < 0.15 and premium < $0.10". Worth knowing exactly what was tested
before adapting it.

## 1. Noise/lottery filter — adapted for Deribit, not ported

The repo's filter leans on **equity options' bid/ask** (full NBBO available at trade
time via Polygon). **Our Deribit trade feed doesn't have that** —
`lib/options-flow/deribit-source.ts` normalizes `/public/get_last_trades_by_currency`,
which gives `price`, `amount`, `direction`, `index_price`, `iv` per print, but no
bid/ask. A literal port (`bid <= 0.05`) is not applicable to our data. We need a
crypto-native equivalent of "penny lottery ticket":

Proposed `classifyNoise(trade: OptionTrade, spotPrice: number): { isNoise: boolean; reason: string | null }`
in a new `lib/options-flow/noise-filter.ts`, flagging a trade as likely noise when
**any** of (thresholds are a starting guess, not borrowed — they need our own
calibration against real Deribit flow, same as the repo's author calibrated theirs
against 17 tickers over 2 months):
- `premium !== null && premium < NOISE_PREMIUM_FLOOR_USD` (e.g. $50) — a dollar-value
  floor, since Deribit premium is already USD-denominated (see
  `deribit-source.ts`'s premium calc).
- Deep OTM relative to spot AND short-dated: `Math.abs(strike - spotPrice) / spotPrice > 0.4`
  and `dte <= 7` — the "cheap, far-out-of-the-money, about-to-expire" pattern that
  makes a contract a speculative lottery ticket rather than a real position.

Then, mirroring the eval-fixture schema's **R3 lesson explicitly** ("raw and adjusted
are different information, both must reach the Critic — don't pre-filter"): compute
**both** the existing score/ratios (raw) and a second pass over the non-noise subset
(adjusted), and surface both in the API response and in the M.A.N.U. brief's facts —
never silently replace the raw numbers with the filtered ones. This is an additive
field, e.g. `OptionsFlowBriefFacts.adjustedCallPutRatio` / `noisePct`, used in a new
"CALIDAD DE LA SEÑAL" blurb in the brief rather than changing what RAW already shows.

**Scope for a first PR**: `lib/options-flow/noise-filter.ts` + tests (mirroring the
repo's RXRX-signal-inversion / CEL-no-change pair: one fixture where noise filtering
flips the lean, one where it doesn't — same shape as `test/lottery-filter.test.ts`),
then wire `noisePct` + `adjustedCallPutRatio` into `compute-snapshot.ts` and the brief
facts. No UI changes required for v1 (API-only), UI exposure can follow once the
thresholds are validated against real data.

## 2. Evidence → Analysis → Interpretation → Outcome

This is the single most valuable idea in the repo, and it already has a real backing
implementation to study (`eval-fixture-schema.ts`), not just a slide. Mapped onto
MANDO's actual architecture:

| Repo's term | MANDO's existing equivalent |
|---|---|
| Signal (raw + adjusted metrics, `noise_flags`) | `OptionTrade[]`, `PremiumTotals`, `OptionsFlowScore` — already deterministic, already computed server-side (`lib/options-flow/`) |
| Reasoning (`ReasoningTrace`, `reasoning_steps`, `verdict`) | The M.A.N.U. brief's narrative (`lib/manu-options-flow/narrative.ts`, `lib/manu-gex/narrative.ts`) — except MANDO's AI never issues an "approve/reject verdict" on a trade; it only narrates. That part of the schema doesn't transfer — MANDO's own rule (never recommend buy/sell) is stricter than this repo's Critic pattern, and that's correct, keep it. |
| Outcome (`price_change_pct`, `critic_correct`) | **Doesn't exist yet.** This is the real gap worth closing — see §3. |

Do **not** adopt the repo's `SignalContext`/`ReasoningTrace` types verbatim — they're
built around an agent that approves/rejects trades, which is explicitly not what
MANDO's AI layer does (per the original Options Intelligence Engine spec's "AI only
interprets, never computes or invents" rule, which also implies: never recommends).
Keep the *separation*, not the *shape*.

## 3. Outcome tracking — the concrete, buildable gap

MANDO already timestamps every brief (`created_at` on `gex_briefs`, `orderflow_briefs`,
`options_flow_briefs`) and already has historical price data
(`fetchMarketHistory` in `lib/market-data.ts`, Deribit's `index_price` on every option
trade for crypto spot). Nothing is missing to build this — it's wiring, not new data
infrastructure:

- Add nullable outcome columns to each brief table (`outcome_price_change_pct`,
  `outcome_direction`, `outcome_recorded_at`, `outcome_horizon`) — or a single shared
  `brief_outcomes` table keyed by `(brief_table, brief_id)` if we'd rather not alter
  three tables identically (`brief_outcomes` is cleaner and matches the "shared
  infrastructure, not three copies" principle already used for `ai_usage_log`).
- A backfill job (cron route, same pattern as `app/api/cron/gex-snapshot/route.ts`)
  that, once a day, finds briefs older than a fixed horizon (start with 24h — one
  horizon, not the repo's five, until this proves useful) without a recorded outcome,
  fetches the current price, and records whether the brief's lean/status was
  directionally correct.
- A small aggregation endpoint (mirrors the repo's `computeAccuracyReport`, but
  simplified — no `by_source`/`by_horizon` breakdown needed until there's enough
  volume to make that meaningful) reporting, per engine (GEX / Order Flow / Options
  Flow): brief count, % directionally correct. Surface it on the Settings page next
  to the AI usage card — "is M.A.N.U. actually right" is at least as useful to see as
  "how much did M.A.N.U. cost."

This is the one idea from the audit that's both novel (MANDO doesn't have it) and
fully buildable with existing infrastructure — prioritize it over the others.

## 4. Wave-style layering — adopt the idea, not the agents

The "9 waves" and "multi-agent orchestrator" are prompt templates for spawning several
Claude agents that each do one kind of analysis and get synthesized. MANDO's actual
architecture is already better suited to a **library of deterministic engines +
backend-computed facts + one narration pass**, not a swarm of sub-agents reasoning
over unstructured text — that's exactly what `buildFacts()` in `gex-analyze/route.ts`
and `options-flow-analyze/route.ts` already do. Spawning agents to re-derive numbers
the backend already computed would be slower, costlier, and strictly less reliable
("no inventes ni recalcules") than what's already built.

What's worth borrowing is purely organizational: naming the fact-gathering stages
("Wave 1 — Market State", "Wave 2 — Price/Structure", …) as a checklist when a new
cross-asset brief is designed, so nothing gets skipped — not as a literal pipeline of
spawned agents. GEX's brief already cross-references Order Flow
(`fetchOrderFlowCrossContext`); a future "Market State brief" that cross-references
GEX + Options Flow + Order Flow for the same asset would use the same pattern again,
not a new orchestration layer.

## 5. What not to adopt (confirmed)

- `price-monitor-alert`, Telegram delivery, portfolio stop-loss logic, buy/sell
  recommendations — out of scope, and the last one conflicts with MANDO's explicit
  "never recommend a trade" rule.
- The repo's specific thresholds (P/C shift >0.3, OI surge >30%, IV spike >20%,
  `bid<=0.05`) as if they were proven — they're one author's unvalidated heuristics
  from prose, not even covered by the repo's own tests (only the lottery filter has a
  test). Any threshold MANDO adopts needs its own fixture-backed test against real
  Deribit data, the same discipline already used in `lib/options-flow/*.test.ts`.
- The repo's "Critic approve/modify/reject" framing — MANDO's AI narrates, it doesn't
  issue verdicts on trades.

## 6. Suggested build order

1. `lib/options-flow/noise-filter.ts` (§1) — small, additive, testable in isolation,
   doesn't touch the UI yet.
2. `brief_outcomes` table + backfill cron + accuracy endpoint (§3) — the highest-value
   new capability, fully buildable today.
3. Wire `noisePct`/`adjustedCallPutRatio` into the Options Flow brief's facts and a new
   "CALIDAD DE LA SEÑAL" line (§1 UI follow-up), once §1's thresholds have been sanity
   checked against a few real sessions.
4. Revisit wave-style cross-referencing (§4) only when a concrete new brief (e.g. a
   unified "Market State" brief spanning GEX + Options Flow + Order Flow) is actually
   requested — not speculatively.
