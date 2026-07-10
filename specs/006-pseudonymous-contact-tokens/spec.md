# 006 — Pseudonymous Contact Tokens for Per-Contact Insight Patterns

## Overview

Discovered while implementing [002](../002-ai-insights-engine/spec.md): the server has no way
to tell that two events belong to the same casual dating contact. Contact identity is
device-local only (`mobile/src/db/contacts.ts`'s `Contact` records are never synced or backed
up — only *events* are, per [004](../004-private-event-backup-sync/spec.md)), so today's AI
Insights pipeline analyzes a flat event stream with no notion of "these 3 events are about the
same person." This blocks exactly the kind of insight the product spec's own example names:
"you tend to disengage before the 4th date" inherently requires knowing which events share a
person.

This spec adds a **pseudonymous per-contact token**: a one-way, device-local hash of the local
`contact_id`, pushed alongside solo-mode events tied to a casual (non-partner) Contact. The
server and Anthropic see only an opaque grouping tag — never a name, never anything that could
be reversed to real contact information — but it's enough for the AI to notice "these events
recur with the same (unnamed) person."

## User Stories

- As a solo user with a dating history involving several different people, I want an insight
  like "you tend to disengage before the 4th date" — which requires the AI to recognize which
  logged events are about the same person, without me or the app ever revealing who that person
  is to the server or the AI provider.

## Functional Requirements

1. Mobile computes `contactToken = oneWayHash(contact_id)` before push, for events that are:
   - solo-domain relevant (i.e., pushed as own-only backup per
     [004](../004-private-event-backup-sync/spec.md)), **and**
   - linked to a casual (non-partner) Contact — `contact.is_partner === 0`.
   Partner-linked events and unlinked events never get a `contactToken` (partner: only one
   relevant relationship, no ambiguity to resolve; unlinked: no contact to group by at all).
2. `ServerEvent` / `LoveEvent` gain an optional `contactToken?: string` field. Server persists it
   on a new nullable `events.contact_token` column — stored and returned as-is, never resolved,
   never joined against anything.
3. `insightService.buildEventSummaries` (solo domain only) includes `contactToken` on each
   `AnonymizedEventSummary` when present. The AI system prompt is updated to explain the
   semantics: events sharing a `contactToken` involve the same (anonymous) person; use this to
   detect person-specific recurring patterns, not just aggregate timing/mood trends.
4. `evidenceEventIds` in the insight result are unaffected — still keyed by `client_id`, same as
   today.

## Data Model Changes

```sql
ALTER TABLE events ADD COLUMN contact_token TEXT;
```
No FK, no index needed beyond what already exists — this is an opaque tag, not a joinable key.

```ts
export interface ServerEvent {
  // ...existing fields
  contactToken?: string | null; // NEW — solo-domain, casual-contact events only
}
```

## Privacy & Safety

- `contactToken` MUST be a one-way derivation (e.g., a truncated SHA-256 of `contact_id`), not
  the raw local UUID — defense in depth, so that even a full server-DB breach combined with
  physical access to the original device's local SQLite cannot trivially cross-reference a token
  back to a named Contact record (open question below on exact hash choice).
- No new Contact data (name, avatar, color, etc.) ever leaves the device — this spec only adds an
  opaque per-event tag, it does not change [004](../004-private-event-backup-sync/spec.md)'s
  "Contacts are never synced" boundary.
- Couple-domain insight generation is unaffected — this spec is solo-domain only.

## Non-Functional

- No latency/cost impact — `contactToken` is one extra string field per event, computed
  client-side with a cheap hash.

## Out of Scope

- **Cross-device consistency.** Since casual Contact records are never synced
  ([004](../004-private-event-backup-sync/spec.md)), the same real person logged on two
  different devices gets two different local `contact_id`s, hence two different tokens.
  Per-contact pattern detection in this spec only works within a single device's own event
  history. Solving this would require syncing Contact identity itself, which is a much larger,
  deliberately out-of-scope change.
- Retroactively backfilling `contactToken` onto events already pushed before this spec ships —
  only new pushes going forward include it, unless a backfill migration is added later.
- Any change to couple-domain insight generation.

## Open Questions

1. **Resolved.** SHA-256 (via `expo-crypto`'s `digestStringAsync`) truncated to the first 16 hex
   chars. Implemented in `mobile/src/services/contactToken.ts`.
2. **Resolved — no reconciliation needed.** Confirmed at implementation time: the couple domain's
   `buildEventSummaries` query never selects `contact_token`, so a promoted contact's historical
   tokens are simply inert once solo events stop being generated for them. No migration/cleanup
   required.

## Implementation Notes

- Shipped and verified against the real Supabase production DB (isolated `zz-spec006-test` rows,
  fully cleaned up) and a real Anthropic API call: 17 synthetic events (3 pseudonymous contacts
  who each stop after exactly 3 dates, 1 who continues past 8) correctly produced the insight
  "Padrão de três encontros antes de seguir em frente" with `evidenceEventIds` scoped to exactly
  the 3-date pattern — confirming per-contact grouping actually changes AI output, not just that
  the field round-trips.
- `contactToken` is computed on push in `useSyncStore.ts`'s sync loop, only when
  `contact.is_partner === 0` — this single condition already implies "own-only backup" (a casual
  contact's `partner_user_id` is never set, so it can never resolve to a shared/partnershipId
  push), so no separate check was needed beyond the spec's stated two conditions.
