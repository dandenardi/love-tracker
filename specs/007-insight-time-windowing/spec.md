# 007 — Time-Windowed AI Insights

## Overview

[002](../002-ai-insights-engine/spec.md) originally planned "windowing" — a rolling window
(suggested 180 days) or "since pairing" for couple mode — so `buildEventSummaries` wouldn't
re-send a user's entire lifetime history on every request. It shipped without it (documented as
Open Question 3, "not implemented in the first pass"): today the query has no date bound at all,
`ORDER BY occurred_at ASC` with no `WHERE occurred_at`.

This spec closes that gap, but reframes it slightly from the original cost-driven motivation: the
primary driver now is a **user-facing capability** — "analyze the last 3 months" instead of always
the full history — with the original cost/relevance benefit as a side effect. Full history stays
the default; nothing changes for a user who never touches the new control.

## User Stories

- As a Premium user, I want to optionally scope an AI Insight to a specific time range (e.g. "the
  last 3 months") instead of always my entire logged history, so I can check in on a recent period
  specifically (e.g. "how have things been since we moved in together").
- As a Premium user who doesn't care about this, I want the default experience (full history)
  completely unchanged.

## Functional Requirements

1. `GET /insights/:domain?locale=&from=&to=` — `from`/`to` are optional epoch-ms query params.
   Omitted (either or both) → today's full-history behavior, byte-for-byte unchanged.
2. `InsightService.buildEventSummaries` (or its `couple`/`solo` sub-queries) gains an optional
   `occurred_at` lower/upper bound in its `WHERE` clause when `from`/`to` are supplied.
3. Period-scoped results are **never persisted** to `ai_insights`. The single row per
   `(user_id, domain)` remains exclusively the full-history cache/identity. A period-scoped
   request always calls the AI provider live and returns the result without an upsert.
4. Shared cost throttle: new nullable `users.ai_insight_last_generated_at` (BIGINT), updated on
   **every** successful insight generation — full-history or period-scoped alike. All generation
   requests (regardless of period) are gated by the same 24h window against this single timestamp,
   so period-scoped queries don't get a separate, larger budget than the default view for free.
5. Mobile (`ai-insights.tsx`): a period selector — presets "Todo o histórico" (default), "Últimos
   30 dias", "Últimos 3 meses", "Últimos 6 meses", and "Personalizado" (custom range, reusing the
   existing `mobile/src/components/DateTimePickerWrapper.tsx`). Selecting a non-default period
   re-triggers the fetch with `from`/`to`.

## Data Model Changes

```sql
ALTER TABLE users ADD COLUMN ai_insight_last_generated_at BIGINT;
```

No changes to `ai_insights` itself — the existing `UNIQUE(user_id, domain)` cache row is
untouched by this spec.

## Privacy & Safety

No change to what data is included or excluded — same fields, same `is_private` filtering, same
exclusion of raw note text. This spec only adds a temporal bound to an already-scoped query.

## Non-Functional

- Period-scoped requests are never cached, so each one is a real Anthropic API call — this is why
  the shared 24h throttle (Functional Requirement 4) matters; without it, period-scoped queries
  would be an unmetered cost/abuse surface distinct from the existing daily-refresh limit.

## Out of Scope

- Saving/comparing multiple periods side by side.
- Applying period selection to the `profile` domain ([008](../008-relationship-profile/spec.md)) —
  that domain has its own 7-day cadence instead, which already serves the "long-term view" need.
- Any change to the free-tier local teaser (`mobile/src/services/teaserInsight.ts`), which is
  unrelated to this pipeline.

## Open Questions

None blocking — this is a direct, additive extension of the existing pipeline with no new
architectural surface.
