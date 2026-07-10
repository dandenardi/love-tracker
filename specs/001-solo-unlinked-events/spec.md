# 001 — Solo Unlinked Events

## Overview

Today every event in Love Tracker requires a `contact_id` — you must create a Contact before
logging anything about them. That fits couple mode (one durable partner) well, but adds
friction for casual/solo use: someone dating casually often wants to log a moment ("consegui o
número da Fulana", "fui rejeitado por Ciclana") without committing to tracking that person as a
named, ongoing Contact. This spec makes `contact_id` optional, introducing a true "unlinked"
event — a diary entry about the user's own dating life, not tied to any specific person record.

This is the foundation the AI Insights Engine ([002](../002-ai-insights-engine/spec.md)) needs
to analyze solo dating patterns, since without it there's no way to log a moment that isn't
artificially bound to a Contact.

## User Stories

- As a casual dater, I want to log "consegui o número de alguém" in two taps, without first
  naming or creating a profile for that person.
- As a casual dater, I want to log "fui rejeitado hoje" as a standalone diary moment about my own
  experience, not about a specific person.
- As a user who started casual and later starts seeing one person more seriously, I want the
  option to create a Contact for them and (ideally) look back at my unlinked history to connect
  relevant past entries — this is explicitly a nice-to-have, not a v1 requirement.
- As an existing couple-mode user, I want zero behavior change — every event I log today keeps
  requiring/using a Contact exactly as it does now.

## Functional Requirements

1. `events.contact_id` MUST be nullable in the mobile SQLite schema. (Verified at implementation
   time: the server's `events` table has no `contact_id` column at all — see Sync Behavior below
   — so no server schema change is needed.) Existing rows are unaffected (all currently
   populated).
2. The event logging flow (`mobile/src/app/modal/log-event.tsx`) MUST offer a path to save an
   event with no Contact selected — this is additive; existing contact-selection flow is
   unchanged for users who pick a contact.
3. Unlinked events (`contact_id IS NULL`) MUST support the same fields as linked events (`type`,
   `title`, `note`, `intensity`, `mood_tag`, `occurred_at`, `is_private`) — no reduced schema.
4. `getEventCountByType` and `getDaysSinceLast` (`mobile/src/db/events.ts`), both currently keyed
   by `contactId`, MUST be extended (or given sibling functions) to support querying unlinked
   events — e.g. `getEventCountByType(contactId: string | null, ...)` where `null` means "events
   with no contact," aggregated across the whole solo history rather than per-person.
5. `mobile/src/app/(tabs)/stats.tsx` currently reads stats scoped to `activeContactId` — it MUST
   be able to show a "your solo history" view when there is no active partner Contact (i.e. the
   user hasn't paired), since today the screen implicitly assumes an `activeContactId` always
   exists.
6. Promoting an unlinked event to a Contact (retroactively attaching it) is OUT OF SCOPE for v1
   (see Open Questions) — v1 only requires that new events CAN be logged unlinked, not that old
   ones can be reattached.

## Data Model Changes

### Mobile (`mobile/src/db/schema.ts`)

```sql
-- events.contact_id: drop the implicit "always populated" assumption.
-- SQLite doesn't support ALTER COLUMN to relax NOT NULL, but the current
-- column has no explicit NOT NULL constraint, so no migration is needed —
-- verify this at implementation time; if a NOT NULL constraint is later
-- added, it must be reverted here first.
```

No destructive migration needed — confirmed via `mobile/src/db/schema.ts` that `contact_id` has
no explicit `NOT NULL`, and SQLite doesn't enforce FK constraints against NULL values.

### Server (Postgres) — no change

Confirmed via `server/db/schema.sql` and the sync migrations: the server's `events` table has no
`contact_id` column at all. Server-side identity is entirely `partnership_id`-based. No migration
needed.

### Shared types (`mobile/src/types/shared.ts` AND `server/shared.ts` — kept identical)

```ts
export interface LoveEvent {
  id: string;
  contact_id?: string | null; // was: contact_id: string. null = unlinked solo diary entry
  // ...unchanged fields
}
```

`ServerEvent` is unchanged — it never had a `contact_id` field and doesn't need one (see Sync
Behavior below).

## API / Interfaces

No new endpoints or payload fields. `SyncPushPayload`/`SyncPullResponse` are unchanged.

## Sync Behavior (resolved — simpler than originally assumed)

Unlinked events never reach the server, and this required no new code. `mobile/src/store/
useSyncStore.ts`'s push logic already resolves each event's partner by looking up
`contactsStore.contacts.find(c => c.id === e.contact_id)` and only pushes the event if that
contact has an active `partner_user_id`/`partnershipId`. An unlinked event has `contact_id =
null`, so that lookup returns `undefined`, no partnership is found, and the event is skipped by
the *existing* filter — exactly like today's behavior for events tied to a non-partner casual
Contact. In other words: **only events tied to the paired-partner Contact ever sync to the
server today; everything else (casual-Contact events and now unlinked events) already stays
local-only.** This matches "never partner-visible" correctly, but "local-only" also means **no
cross-device backup** — losing the device without a manual backup means losing this data
permanently. That trade-off was under-examined here; **see
[004-private-event-backup-sync](../004-private-event-backup-sync/spec.md)**, which adds
server-side backup for private/unlinked events scoped strictly to the owning user (never
partner-visible) so this data isn't lost, without changing who can see what.

## Non-Functional

- No performance concerns — this is a nullable-column change plus two extended query functions.
- Offline-first is unaffected; unlinked events behave exactly like linked ones for local
  read/write.

## Out of Scope

- Retroactively attaching unlinked events to a newly created Contact.
- Any UI for "convert this casual person into a tracked Contact" flow.
- Changes to the Poke system (pokes are inherently paired-partner-only and unaffected).

## Open Questions

1. Should unlinked events be visually distinguished in the Timeline (e.g. a "no contact" icon),
   or blend in like any other event with a generic icon? Visal distinction is nice to have
2. Is there a cap on how "unlinked" solo history is presented in Stats — a single aggregate
   bucket, or broken down by event type only (no per-person breakdown, since there's no person)?
3. ~~Confirm actual current DB constraint state on `contact_id`.~~ Resolved at implementation
   time: no `NOT NULL` on mobile, no `contact_id` column at all on the server — see Data Model
   Changes and Sync Behavior above.
