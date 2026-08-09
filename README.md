# Tibo Signal Desk

[中文文档](README_ZH.md) · **English**

![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=101010)
![Vinext](https://img.shields.io/badge/Vinext-Cloudflare_Worker-F38020?logo=cloudflare&logoColor=white)
![SQLite](https://img.shields.io/badge/Sites_D1-SQLite-003B57?logo=sqlite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)

A bilingual, single-page intelligence dashboard for following [Tibo (@thsottiaux)](https://x.com/thsottiaux) across X. It tracks his posts and conversations over a rolling seven-day window, estimates whether a Codex usage-limit reset may be approaching, and preserves verified reset announcements as structured history.

**Production:** [tibo-signal-desk.mumten120.chatgpt.site](https://tibo-signal-desk.mumten120.chatgpt.site) — currently an owner-only ChatGPT Sites deployment.

![Tibo Signal Desk dashboard overview](docs/images/dashboard-overview.png)

## Why this project exists

Tibo's reset announcements rarely live in a clean official changelog. They appear among original posts, replies, quotes, jokes, and conversations. Tibo Signal Desk turns that noisy public stream into three useful layers:

1. **Activity:** what Tibo posted and who he interacted with during the last seven UTC days.
2. **Signal:** a lightweight AI assessment of whether another reset looks imminent.
3. **Evidence:** a durable list of announcements where Tibo explicitly said a reset was completed or propagating.

The probability card is intentionally playful and is not official OpenAI guidance. Every historical reset row links back to the source post.

## Product highlights

- Rolling seven-day totals for original posts, replies, quotes, and reposts.
- Interaction-aware records that retain the account Tibo replied to or quoted.
- Daily activity rhythm and interaction-mix visualizations.
- DeepSeek-powered Codex / ChatGPT Work reset-signal analysis.
- Verified reset history with `completed` and `rolling_out` states.
- Durable Sites D1 storage with idempotent writes and fetch-run health records.
- FxTwitter API v2 as the primary source, with Nitter RSS as a fallback.
- Chinese and English UI, responsive layouts, keyboard focus, and reduced-motion support.
- Graceful stale-data mode when upstream public services are unavailable.

## Screenshots

### Reset radar and verified history

The history panel lives directly below the reset-likelihood card. It excludes teasers, jokes, and unsupported guesses, and keeps the original announcement link visible. The main dashboard screenshot above shows the hero and seven-day overview; this view focuses on the evidence layer.

![Verified Codex reset history](docs/images/reset-history.png)

## Architecture

```mermaid
flowchart LR
    FX["FxTwitter API v2"] --> N["Normalize Tibo activity"]
    NR["Nitter RSS fallback"] --> N
    N --> A["D1 · activities"]
    N --> R["Strict reset-event detector"]
    R --> H["D1 · reset_events"]
    A --> API["Vinext Worker API"]
    H --> API
    API --> UI["React dashboard"]
    A --> DS["DeepSeek analysis"]
    DS --> UI
```

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Vinext |
| Runtime | ChatGPT Sites / Cloudflare Worker |
| Primary source | FxTwitter API v2 with replies enabled |
| Fallback source | Nitter `with_replies` RSS |
| Persistence | Sites D1 / SQLite |
| Signal analysis | DeepSeek Chat Completions API |

## Reset-history methodology

An activity becomes a reset event only when all of the following are true:

- the author is Tibo;
- the text concerns Codex, ChatGPT Work, usage limits, or rate limits;
- it explicitly says the reset was completed or is actively propagating;
- it is not merely a future promise, joke, conditional statement, or unrelated use of the word “reset.”

Events are classified by delivery (`completed` or `rolling_out`), type (`global` or `banked`), and audience scope. Curated historical evidence seeds the database, while newly fetched activities are checked automatically.

OpenAI's Codex App Server can expose an authenticated account's current usage percentage, window duration, next scheduled reset timestamp, and available reset credits through `account/rateLimits/read`. It does **not** provide a public history of Tibo-triggered global resets, so this project uses source-linked public announcements for that timeline. See the [official rate-limit fields](https://learn.chatgpt.com/docs/app-server#6-rate-limits-chatgpt).

## Data model

| Table | Purpose |
| --- | --- |
| `activities` | Normalized X activities keyed by status ID, including type, target handle, source, and publication time. |
| `fetch_runs` | Refresh attempts, source, item count, success state, and diagnostic error text. |
| `reset_events` | Durable verified reset events with status, kind, scope, evidence text, and source URL. |

Activity rows older than 30 days may be pruned because the product window is seven days. Verified reset events are stored separately and are not removed by that activity-retention rule.

## Getting started

### Requirements

- Node.js 22.13 or newer
- npm
- A DeepSeek API key for the reset-likelihood analysis (the activity dashboard still has a clear failure state when analysis is not configured)

### Environment

Copy `.env.example` to `.env` and provide your key:

```dotenv
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
ACTIVITY_SOURCES=fxtwitter,nitter
FXTWITTER_BASE_URL=https://api.fxtwitter.com
X_HANDLE=thsottiaux
NITTER_INSTANCES=https://nitter.net,https://nitter.poast.org,https://nitter.privacyredirect.com
REFRESH_TTL_SECONDS=600
```

FxTwitter does not require an X login, cookie, OAuth token, or project API key. Public Nitter instances are less reliable and remain a best-effort fallback. Never commit a real API key.

### Install and run

```bash
npm ci
npm run dev
```

Open the local URL printed by Vinext, normally `http://localhost:3000`.

### Validate

```bash
npm run build
```

After changing the D1 schema, generate and inspect a migration before building:

```bash
npm run db:generate
```

## API

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/activities/recent` | `GET` | Refreshes sources according to the cache policy, writes D1, and returns activity, seven-day statistics, coverage, and recent reset history. |
| `/api/activities/recent?refresh=1` | `GET` | Requests a refresh without waiting for the normal freshness window. |
| `/api/analyze` | `POST` | Evaluates supplied non-repost Tibo activity for reset signals. |

Abbreviated dashboard response:

```json
{
  "range": { "days": 7, "start": "2026-08-03", "end": "2026-08-09" },
  "stats": { "total": 49, "originals": 7, "interactions": 42 },
  "daily": [],
  "activities": [],
  "resetHistory": [
    {
      "id": "2086188036493344823",
      "kind": "global",
      "status": "completed",
      "scope": "paid_codex_chatgpt_work",
      "evidenceUrl": "https://x.com/thsottiaux/status/2086188036493344823"
    }
  ],
  "coverage": { "oldestDay": "2026-08-03", "storedCount": 49, "complete": true }
}
```

## Project structure

```text
app/                       React page, styling, and Worker API routes
db/                        D1 schema, storage, caching, and aggregation
drizzle/                   Generated SQLite migrations and snapshots
lib/                       Source adapters, reset detector, and shared types
worker/                    Vinext Worker entrypoint
public/                    Runtime visual assets and social preview
docs/images/               README screenshots captured from production
.openai/hosting.json       Sites project and logical D1 binding
client/ + server/          Pre-migration Vue / Express implementation
```

## Deployment

The repository root is the active ChatGPT Sites project. Vinext produces Cloudflare Worker-compatible ESM, `.openai/hosting.json` declares the logical `DB` binding, and hosted secrets are configured in Sites rather than committed to Git.

The current deployment remains private. Changing its audience or making it public should be treated as a separate access-control decision.

## Data boundaries and reliability

- “Interactions” means replies, quotes, and reposts; likes are not treated as communication messages.
- Statistics use UTC calendar days: today plus the previous six days.
- FxTwitter and Nitter are third-party, unofficial X data sources without an availability SLA.
- D1 caching and fallback behavior improve continuity but cannot guarantee complete X coverage.
- Reset likelihood is an entertainment-oriented signal, not a statement from OpenAI.
- Reset history is evidence-backed but depends on public posts remaining available.

More background is available in [X data-source evaluation](docs/x-data-sources.md) and the [ChatGPT Sites migration notes](docs/sites-migration.md).

## License

MIT
