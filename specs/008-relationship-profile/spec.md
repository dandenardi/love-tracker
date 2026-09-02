# 008 — Relationship Profile: Cross-Relationship Pattern Insights

## Overview

Every AI insight today ([002](../002-ai-insights-engine/spec.md), extended by
[006](../006-pseudonymous-contact-tokens/spec.md)) is scoped to *one* relationship at a time: the
`solo` domain analyzes casual-dating history as a flat pool (with per-contact grouping via
`contactToken` for within-person patterns), and `couple` analyzes exactly one active partnership.
Neither can surface a pattern that only becomes visible by looking **across** a person's different
relationships over time — e.g. "you recurrently fight around the end of the month, which may
correlate with financial stress" is invisible within any single relationship's data if it only
happened twice there, but obvious if it happened in three different relationships.

002's Data Pipeline section scoped `contactToken` explicitly to "cross-event pattern detection
within the same person," and 006's Out of Scope explicitly ruled out any cross-identity
correlation. This spec is the deliberate, first-class version of that previously out-of-scope
capability: a new insight domain analyzing the user's own behavioral tendencies **across their
entire relationship history** — past partnerships, the current one, and solo/casual dating,
pooled together.

## User Stories

- As a user with more than one relationship or dating contact in my history, I want an insight
  that names a tendency of *mine* that recurs regardless of who the partner was — something only
  visible by looking at the whole picture, not one relationship at a time.

## Functional Requirements

1. New `ai_insights.domain` value: `'profile'`, alongside the existing `'solo'`/`'couple'`. Reuses
   the existing `UNIQUE(user_id, domain)` cache mechanism unchanged — this is a new value in that
   dimension, not a new dimension.
2. New query (`buildRelationshipSummaries` or similar): `SELECT * FROM events WHERE user_id = $1
   AND deleted_at IS NULL` — every event the user has ever authored, including their own private
   events (this is the user analyzing their own data for their own benefit; the "a partner's
   private events never reach the other partner" invariant is unrelated and untouched). No
   partnership-active filter — dissolved partnerships' data is included too (already retained
   server-side per [004](../004-private-event-backup-sync/spec.md)'s own-author backup).
3. Unified `relationshipId` grouping key added to `AnonymizedEventSummary`:
   - Rows with a non-null `partnership_id` → `relationshipId = oneWayHash(partnership_id)`,
     computed **server-side** (the raw ID never leaves the server, unlike `contact_id`, which
     starts on-device for 006). Reuses the same SHA-256-truncated scheme as `contactToken`.
   - Solo/casual rows → `relationshipId = contactToken` (already a hash), passed through as-is.
   - Mutually exclusive per row.
   - **The raw `partnership_id` UUID must never be sent to the AI provider.** It's a live FK that
     joins directly to `partnerships.user_id_1/user_id_2` and from there to real account identity —
     sending it verbatim would be a materially worse privacy posture than `contactToken`, which was
     deliberately built non-joinable. This is the single most important implementation detail in
     this spec.
4. New system-prompt variant for the `profile` domain, instructing the model to find patterns that
   recur **across different `relationshipId` values** — not things specific to one relationship —
   and to state how many distinct relationships support each finding.
5. Data cap: at most the **300 most recent events**, across the whole pooled set (not per
   relationship). `AnonymizedEventSummary` is small (a handful of scalar fields), so 300 stays a
   modest payload; a global cap naturally favors the most active/recent relationships without
   needing per-relationship pagination.
6. New minimum-data threshold, distinct from the existing `MIN_EVENTS_THRESHOLD`:
   - A relationship only counts toward the diversity minimum if it has **≥ 3 events** (filters out
     a single logged encounter masquerading as a "relationship").
   - At least **2** qualifying relationships are required. Below that: new outcome status
     `not_enough_relationships`, distinct from `not_enough_data` (which still covers the absolute
     event floor) — so the mobile copy can say "log another relationship/contact's worth of
     history" instead of "log more events."
7. Refresh cadence: **7 days**, not the 24h default used by `solo`/`couple`. This is an
   identity-level, slow-changing insight, and the domain also carries the largest potential event
   volume of the three — implement as a per-domain cache duration in `insightService.ts`, not a
   single global constant.
8. Consent: reuses the existing single `users.ai_insights_opt_in` toggle — no second, separate
   opt-in. Update `aiInsights.consentBody` copy to explicitly name "including patterns across past
   relationships," keeping the one opt-in honestly scoped to everything it now covers, per 002's
   "clear, explicit framing of what's analyzed" principle.
9. New field `evidenceRelationshipIds?: string[]` on `InsightResult` (and a matching nullable
   `ai_insights.evidence_relationship_ids TEXT[]` column), populated only for the `profile` domain
   — lets the UI show "based on patterns across N relationships" without re-deriving grouping
   client-side. `evidenceEventIds` semantics are unchanged for all domains.
10. Mobile (`ai-insights.tsx`): a third domain option alongside Solo/Casal — **"Seu Padrão em
    Relacionamentos"** — with copy explaining the wider scope, and a dedicated empty state for
    `not_enough_relationships`.

## Data Model Changes

```sql
ALTER TABLE ai_insights DROP CONSTRAINT ai_insights_domain_check;
ALTER TABLE ai_insights ADD CONSTRAINT ai_insights_domain_check
  CHECK (domain IN ('solo', 'couple', 'profile'));
ALTER TABLE ai_insights ADD COLUMN evidence_relationship_ids TEXT[];
```

## Privacy & Safety

- No partner data is used beyond what the requesting user could already see — same boundary as
  002/004: a partner's private events never enter any analysis but that partner's own.
- `relationshipId` must always be a one-way hash, never the raw `partnership_id` — see Functional
  Requirement 3. This is the primary privacy risk this spec introduces and the reason it's called
  out twice.
- This domain covers **dissolved** relationships, not just the active one — consent copy and any
  in-app explanation should say so plainly, since it's a materially different scope than "analyze
  my current relationship."

## Non-Functional

- Cost is bounded by the 300-event cap and the 7-day cadence — meaningfully less frequent AI
  provider usage than `solo`/`couple` despite pulling from the largest data pool of the three.

## Out of Scope

- Per-relationship insight breakdowns/comparison (that's what the existing `couple` domain already
  gives for the active partnership) — `profile` is about the aggregate cross-relationship pattern,
  not a list of separate per-person insights.
- Cross-device correlation for the same real person (same limitation already accepted in
  [006](../006-pseudonymous-contact-tokens/spec.md)).
- Custom time-period selection for this domain — out of scope for
  [007](../007-insight-time-windowing/spec.md) too; the 7-day cadence already serves the "long-term
  view" need this domain exists for.

## Open Questions

1. **Resolved.** Final feature name: **"Seu Padrão em Relacionamentos"**.
2. Whether `profile` ever becomes a separate, higher-priced tier instead of bundled into the
   existing single Premium flag — confirmed bundled for now; revisit only if the product grows
   enough to justify a paid upsell above base Premium.
