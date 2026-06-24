# Zamanix Artemis — Repository Audit & Migration Plan

**Repo audited:** `Xxamanie/Xamanix-Trading-Bot` (branch `main`, 44 commits)
**Audit date:** 2026-06-24
**Auditor role:** Principal Architect / Quant / Backend / Frontend / AI Systems / DevOps / Security
**Verdict in one line:** A capable-looking React demo that is **not safe to run with real money** and is **not yet a platform**. It must not be treated as a foundation to "harden" — several of its core behaviors (browser-held exchange secrets, LLM-fabricated backtests, no risk gate on live orders) have to be removed, not improved.

---

## 0. What the repository actually is

A single-page application generated from Google's **AI Studio** template:

- **Stack:** React 18 + TypeScript + Vite 6. Tailwind via CDN. Chart.js via CDN. React/genai loaded from `aistudiocdn.com` through an HTML import map.
- **Runtime shape:** 100% client-side. **No backend, no database, no server, no worker.** Everything runs in the browser tab.
- **Exchange integration:** Direct calls to the **Bybit v5 REST API** from the browser (`services/bybitService.ts`), signed with HMAC-SHA256 via Web Crypto. The user pastes their **API key + secret** into a form.
- **AI integration:** Google Gemini (`@google/genai`) used for code analysis, code generation, "backtesting", trading suggestions, and formatting (`services/geminiService.ts`).
- **"Strategy":** A ~400-line Python script stored as a **string constant** (`DEFAULT_SCRIPT` in `constants.ts`). It is never executed by any Python runtime — it is sent to Gemini as text.
- **"Live bot":** A `setInterval` loop inside the React app (`DeployedBot.intervalId: number`). It dies when the tab closes.

Observed source map (from `App.tsx` imports):

```
App.tsx                      ~1,944 lines  — God component, ~51 useState/useEffect
constants.ts                 mock data + the Python strategy string
types.ts                     domain types (Asset, Position, Trade, Backtest, ...)
GeminiConnector.tsx          AI panel
services/geminiService.ts    6 Gemini calls
services/bybitService.ts     live Bybit trading (balances, positions, orders)
services/websocketService.ts market data socket
services/soundService.ts     alert sounds
contexts/APIContext.tsx      holds apiKey / apiSecret / environment in React state
components/                  RecommendationsPanel, BacktestResults, CodeViewer,
                             DashboardHeader, icons
```

---

## 1. Architecture Report

**Current architecture:** Monolithic client-only SPA. One God component (`App.tsx`) owns UI, state, polling, notifications, trade execution, and AI orchestration. Business logic lives in the UI layer; services are thin HTTP wrappers with no domain model behind them.

**Against the principles you asked for:**

| Principle | Status | Evidence |
|---|---|---|
| Clean Architecture / Hexagonal | ✗ | No domain layer. Bybit shapes (`any`) flow straight into components. |
| DDD | ✗ | No bounded contexts; "Position" is a UI type, not a domain entity. |
| CQRS / Event-Driven | ✗ | No events, no command/query split. Polling via `setInterval`. |
| SOLID | ✗ | `App.tsx` violates SRP wholesale; no dependency inversion. |
| Vertical slices | ✗ | Features are tangled across one file. |
| No God classes | ✗ | `App.tsx` is the God class. |
| No business logic in UI | ✗ | Position sizing, trade construction, risk text all in components. |

**Key structural gaps for the stated vision (autonomous, multi-agent, risk-controlled):**

1. There is no server, so there is nowhere safe to run an autonomous agent, hold secrets, enforce risk, or persist state.
2. There is no execution boundary between "decide" and "trade" — `executeLiveTrade()` is called directly from a React handler.
3. The Scout/Analyst/Risk/Commander/Execution agent model in your brief **does not exist in any form**. It would be built from zero.

---

## 2. Dependency Report

**Declared (`package.json`):** `react`, `react-dom`, `@google/genai@^1.23.0`, `react-simple-code-editor@0.13.1`; dev: `vite@^6`, `typescript@~5.8`, `@vitejs/plugin-react`, `@types/node`.

**Undeclared but relied upon (loaded from CDNs in `index.html`):** `tailwindcss` (cdn.tailwindcss.com — explicitly *not for production*), `chart.js@4.4.2`, `date-fns`, `chartjs-adapter-date-fns`, `chartjs-chart-financial`, `hammerjs`, `chartjs-plugin-zoom`, `prismjs@1.29`, plus React/genai re-loaded from `aistudiocdn.com` via import map.

**Findings:**

- **Dual module sources.** React is both an npm dependency *and* an import-map CDN entry. This is fragile and can yield two React instances.
- **No lockfile discipline noted / supply-chain exposure.** Seven-plus third-party scripts are loaded from public CDNs with **no Subresource Integrity (SRI)**. Any one of them can read the in-memory Bybit secret. This is a direct path to credential theft.
- **`cdn.tailwindcss.com`** is a dev-only convenience and ships an unpurged runtime; not acceptable in production.
- **No backend dependencies at all** — no DB driver, no queue, no auth, no validation, no logging library. Everything in the target vision is greenfield.

---

## 3. Technical Debt Report

| Debt | Severity | Notes |
|---|---|---|
| `App.tsx` God component (~1,944 lines, ~51 hooks) | High | Unmaintainable; every change risks regressions. |
| Business logic in UI | High | Sizing, order building, risk messaging in components. |
| `any` types on all exchange responses (12+ sites) | High | Defeats TypeScript; silent runtime breakage. |
| Python strategy stored as a giant string literal | High | No typing, no tests, no execution, no version control of logic. |
| Polling via `setInterval` for balances/positions | Medium | No backoff, no cancellation safety, rate-limit risk. |
| No tests, no CI, no linting config committed | High | Zero safety net; brief targets 80–95% coverage from 0%. |
| Mock data interleaved with live paths | Medium | `constants.ts` mock assets/positions still wired in. |
| Dead/placeholder functions | Low | `transferFunds`, `clearSessionBalances` are stubs. |

---

## 4. Security Report — **most urgent section**

1. **Gemini API key is shipped in the client bundle.** `vite.config.ts` injects `process.env.API_KEY = GEMINI_API_KEY` at build time via `define`. In a static Vercel deployment this key is **embedded in the public JS bundle** and readable by anyone via DevTools/View-Source. It is, for practical purposes, already leaked on the live site. **Action: rotate it now**, then move all Gemini calls behind a server.
2. **Bybit API secret lives in the browser.** `bybitService.ts` signs requests client-side using the user's secret held in React state (`APIContext`). Any XSS, any compromised CDN script, any malicious browser extension can exfiltrate it. With trade permissions enabled this is full account compromise.
3. **No Subresource Integrity on 7+ CDN scripts.** Supply-chain compromise → secret theft (compounds #2).
4. **No authentication, authorization, or RBAC.** Anyone with the URL has the full app. The brief's JWT/refresh/RBAC requirements are unimplemented.
5. **No input validation / no rate limiting / no CSRF posture** — because there is no server to enforce them.
6. **No secret management.** Keys are env-injected at build or typed into a form. No vault, no rotation, no per-user isolation.
7. **Fail-open by construction.** Live order placement has no risk gate (see §10). The brief demands "never fail open." Today the system *only* fails open.

---

## 5. Scalability Report

- **Single-user, single-tab, no horizontal anything.** State is in-memory React state; closing the tab loses everything (including any "running" bot).
- **No persistence layer** — the brief's 12 Prisma models (User, Account, Trade, Order, Position, Strategy, Agent, AgentMemory, RiskProfile, MarketData, Portfolio) do not exist.
- **No queue / event bus.** Redis + BullMQ required by the vision are absent. Autonomous, multi-strategy, multi-symbol execution cannot scale inside a browser interval loop.
- **Rate limits.** Browser-side polling against Bybit per client will hit limits and has no central throttling.

---

## 6. Performance Report

- **Re-render pressure:** ~51 hooks in one component → broad re-renders on every poll tick. No memoization boundaries.
- **CDN cold loads:** ~10 external scripts block first paint; `cdn.tailwindcss.com` compiles styles at runtime.
- **Polling vs. streaming:** balances/positions polled on intervals rather than driven by the websocket already present — wasteful and laggy.
- **LLM in the hot path:** "backtests" and suggestions are synchronous Gemini round-trips (seconds of latency) with no caching.
- **Note:** none of this is the real bottleneck. Correctness and safety dominate; performance tuning is premature until the architecture exists.

---

## 7. Naming Report

Mostly intent-revealing already (`verifyAndFetchBalances`, `executeLiveTrade`, `closeLivePosition`) — good. Problem areas:

- Generic `makeRequest`/`signRequest` are acceptable but belong inside a named `BybitExchangeAdapter`.
- `DEFAULT_SCRIPT` hides a whole strategy engine behind a vague constant name.
- `GeminiConnector` mixes "connector" (exchange term) with an AI panel — confusing in a trading context.
- Stub `transferFunds`/`clearSessionBalances` names imply behavior they don't have.

---

## 8. Dead Code Report

- `transferFunds()` — always rejects; never wired to a real flow.
- `clearSessionBalances()` — explicit no-op ("legacy from the simulation").
- `MOCK_*` constants and `generateCandleData` — simulation leftovers still imported alongside live paths; ambiguous which path renders.
- `.tsx` (an empty/stray root file listed in the tree) — appears to be an artifact.
- `max_consecutive_losses` in backtest summary is hard-coded to `0` ("Placeholder").

---

## 9. Refactoring Opportunities (behavior-preserving first)

1. **Extract an `ExchangeAdapter` port** and move `bybitService` behind it (typed responses, no `any`).
2. **Decompose `App.tsx`** into feature slices (Markets, Positions, Portfolio, Strategy, AI) with a state container; lift business logic out of components.
3. **Type the Bybit DTOs** and map them to domain entities at the boundary.
4. **Replace `setInterval` polling** with the existing websocket + a typed market-data store.
5. **Promote the Python strategy** out of a string into a real, testable module (and decide whether strategies run server-side in Python or are reimplemented in TS).

---

## 10. Immediate Risks (capital & legal) — read first

> These are not style issues. They can lose real money or leak credentials **today**.

- **R1 — LLM-fabricated backtests.** `runBacktest()` prompts Gemini to *"act as a sandboxed Python execution environment"* and return an equity curve, Sharpe, win rate, etc. **No Python runs.** Every backtest number the UI shows is a plausible-looking hallucination. Any decision made on these is built on fiction. **Must be removed or replaced with a real deterministic backtest engine.**
- **R2 — Live orders with no risk gate.** `executeLiveTrade()` places real Bybit orders (market/limit, with leverage via `linear`) directly from a UI handler. There is **no max-daily-loss, max-drawdown, max-exposure, or position-limit check anywhere in the executed path.** The risk logic that exists is inside the *unexecuted* Python string. The system fails open.
- **R3 — Leaked Gemini key.** Shipped in the client bundle (see §4.1). Rotate immediately.
- **R4 — Browser-held exchange secret.** One XSS or bad CDN script = account drain (see §4.2).
- **R5 — Mainnet one click away.** The connect form accepts `mainnet` with no guardrail, confirmation, or test-first enforcement.

**Recommended immediate containment (before any feature work):**
1. Rotate the Gemini API key and remove it from any client build.
2. Add a hard, loud warning + default-to-testnet, and disable live order placement until a risk gate exists.
3. Stop presenting LLM "backtests" as real results (label them, or remove).

---

## Target Architecture (your brief) vs. reality — migration plan

Your target monorepo (`apps/web|api|worker`, `packages/database|ui|exchange|risk|analytics|strategies|agents|shared`, `services/scout|analyst|risk|commander|execution-agent`, `infrastructure/*`) is the right shape for the vision. **None of `api`, `worker`, `database`, `risk`, `agents`, or the services exists yet.** This is ~90% greenfield with the current SPA becoming `apps/web`.

This cannot and should not be done as a big-bang rewrite. Proposed sequence, each step shippable and safe:

**Phase 0 — Stop the bleeding (days).** Rotate keys; force testnet; gate/disable live trades; label fake backtests. No new features.

**Phase 1 — Monorepo + server boundary (1–2 weeks).** Stand up the workspace (`apps/web`, `apps/api`). Move **all** Gemini and Bybit secrets server-side behind `apps/api`. The browser never sees a secret again. Introduce `packages/shared` (types) and `packages/exchange` (typed `ExchangeAdapter`, Bybit first).

**Phase 2 — Persistence + risk engine (2–3 weeks).** Add PostgreSQL + Prisma with the core models. Build `packages/risk` as a **mandatory pre-trade gate** every order must pass (max daily loss, drawdown, exposure, position/asset limits). Fail-safe by default.

**Phase 3 — Real backtesting + strategy framework (2–3 weeks).** Replace the LLM "backtest" with a deterministic engine (Python service or vetted TS lib). Implement the `TradingStrategy` interface and 1–2 real strategies.

**Phase 4 — Events + worker (2–3 weeks).** Redis + BullMQ; move the "live bot" out of the browser into `apps/worker`. Emit `SignalDetected`, `TradeApproved`, `OrderFilled`, `RiskLimitTriggered`, etc.

**Phase 5 — Agent system (3–5 weeks).** Build Scout → Analyst → Risk → Commander → Execution as worker consumers over the event bus, with `AgentMemory` persisted. Commander holds final authority; Risk has veto.

**Phase 6 — Observability, authn/z, testing, hardening (ongoing).** Structured logging, metrics, health checks, audit log; JWT + refresh + RBAC; test coverage toward 80% / 95% on trading-critical paths.

Realistic order-of-magnitude for a small team: **3–6 months** to reach a genuinely production-grade autonomous platform. Anyone promising it in one pass is not being straight with you.

---

## Recommended first slice

Do **Phase 0 + the secret-boundary half of Phase 1** first. It is the highest value per unit risk: it stops the credential leak, stops fail-open live trading, and creates the server we need for everything else. Concretely:

1. Scaffold the monorepo with `apps/web` (the current SPA, lightly adapted) and `apps/api` (Express + TypeScript + validation + structured errors).
2. Proxy Gemini and Bybit through `apps/api`; secrets live only on the server.
3. Insert a minimal but real **pre-trade risk gate** in the API so no order reaches Bybit without passing it; default environment = testnet.

That is a coherent, safe, demonstrable increment — and a true foundation for Zamanix Artemis rather than lipstick on the demo.
