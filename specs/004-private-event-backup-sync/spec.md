# 004 — Private Event Backup Sync

## Overview

Today, any event marked `is_private = 1` — and, since
[001](../001-solo-unlinked-events/spec.md), any unlinked Solo Diary event regardless of its
`is_private` value — never leaves the device. `mobile/src/store/useSyncStore.ts:355` filters
`e.is_private === 0` before ever attempting to push, and unlinked events additionally have no
Contact to resolve a partner through. If a phone is lost, factory-reset, or replaced without a
manual backup, all of that data is gone permanently — this includes existing couple-mode private
events, not just the new Solo Diary feature.

This spec adds server-side backup for private/unlinked events, scoped strictly to the owning
user. A partner must never be able to receive these events under any circumstance — this is not
a new sync channel with relaxed privacy, it's a personal backup channel that happens to use the
same server.

**This corrects an over-simplification in [001](../001-solo-unlinked-events/spec.md)'s Sync
Behavior section**, which treated "never syncs" as an acceptable, low-risk default. It's low-risk
for privacy, but not for durability — the user flagged this trade-off explicitly and it applies
more broadly than 001's scope.

## User Stories

- As a user who marks an event private, I want it backed up to the server so I don't lose it if I
  lose my phone — while being certain my partner can never see it, today or after any future bug.
- As a Solo Diary user (no partner at all), I want my unlinked entries backed up the same way.
- As a paired user, I want the guarantee that this backup channel cannot leak private events to
  my partner to be enforced at the database query level, not just trusted application logic.
- As a user reinstalling the app on a new device, I want to recover my private/solo history the
  same way shared history already recovers today.

## Functional Requirements

1. `mobile/src/store/useSyncStore.ts`'s push logic MUST stop excluding `is_private` events
   outright. New push classification:
   - Non-private, contact-linked, partner-resolvable events → push with `partnershipId` set
     (unchanged from today).
   - Private events (any `contact_id`) and unlinked events (any `is_private`) → push with
     `partnershipId: null`, `is_private` carried through, tagged as user-owned-only.
2. `ServerEvent` (`server/shared.ts` / `mobile/src/types/shared.ts`) gets `is_private: number`
   added (currently absent) and `partnershipId` formalized as `string | null`.
3. `SyncService.pushEvents` (`server/services/syncService.ts`) MUST persist `is_private` on
   insert (currently omitted from the INSERT column list entirely, silently defaulting to `0`)
   and accept `partnership_id = NULL`.
4. A NEW "restore my own data" pull path MUST be added, querying `WHERE user_id = $1 AND
   deleted_at IS NULL` — every row the user owns, regardless of `partnership_id`/`is_private`,
   since a user may always see their own data. Recommend adding this as an `ownEvents` array on
   the existing `SyncPullResponse` rather than a new endpoint, reusing the existing round-trip.
5. **Security-critical, non-negotiable:** the EXISTING partner-facing query in `pullEvents`
   (the branch that fetches the partner's events via `partnership_id = ANY($1) AND user_id !=
   $2`) MUST add an explicit `AND e.is_private = 0` clause. Today this is harmless because no
   private row exists server-side; the moment requirement 3 ships, this is the only thing
   standing between a private event and the partner it's private from. This must ship in the
   same change as requirement 3 — never push #3 without #5.
6. Client pull handling MUST merge `ownEvents` into local storage via `upsertEvent`, marked
   `synced = 1`, without re-triggering a push (avoid a push/pull loop).
7. `privacy_policy.md` MUST be updated to disclose that private events are now stored server-side
   (encrypted in transit; see Non-Functional for at-rest considerations) for backup purposes,
   never for partner visibility. This is a release blocker for this spec, same convention as
   [002](../002-ai-insights-engine/spec.md)'s privacy dependency.

## Data Model Changes

No new columns or migrations — `server/db/schema.sql` already has `user_id NOT NULL`,
`partnership_id` (nullable), and `is_private` on `events`. This is purely an application-logic
gap, not a schema gap.

```ts
// server/shared.ts AND mobile/src/types/shared.ts — kept identical
export interface ServerEvent {
  clientId: string;
  partnershipId?: string | null;   // was implicitly required; now explicit and nullable
  is_private: number;              // NEW — was silently dropped before reaching the server
  type: EventTypeKey;
  // ...unchanged fields
}

export interface SyncPullResponse {
  events: (ServerEvent & { partnerId: string })[];  // partner's shared events — unchanged
  ownEvents: ServerEvent[];                          // NEW — the user's own private/unlinked backup
  deletedIds: string[];
  partners: Partner[];
}
```

## API / Interfaces

- `POST /sync/push` — same endpoint, wider payload (events with `partnershipId: null` now
  accepted).
- `GET /sync/pull` — same endpoint, response gains `ownEvents`.
- No new routes needed.

## Privacy & Safety

- The partner-facing pull query's new `is_private = 0` filter (FR5) is the load-bearing
  guarantee of this entire spec — it must be covered by a test that asserts a private event
  inserted for user A is never present in user B's pull response inside a shared partnership,
  even when both are active.
  - **Verified at implementation time (2026-07-07)** directly against the real production
    database (Supabase Postgres, not Neon — see corrected project memory): two isolated test
    users, an active partnership, and three events (shared/`is_private=0`, private-with-a-
    `partnership_id` set as a defense-in-depth check, and private/unlinked with no
    `partnership_id`) were inserted, the partner-facing and own-events queries were run exactly
    as implemented, and both non-negotiable assertions held — the private event was absent from
    the partner's view in every case, and present in the owner's own-events view. All test rows
    were deleted immediately after; zero rows remain.
- This spec knowingly increases what's stored server-side: private/intimate content (`note`,
  `mood_tag`, etc. — the same sensitive fields flagged in
  [002](../002-ai-insights-engine/spec.md)'s Privacy & Safety section) now reaches Postgres for
  events that today never leave the device. Users should be able to reason about this — consider
  a one-time notice ("your private entries are now backed up, still never shared") rather than a
  silent behavior change, even though it's a durability improvement.

## Non-Functional

- **At-rest encryption:** out of scope for v1 given complexity, but flagged as a fast-follow —
  `note`/`title` on private rows are more sensitive now that they're server-persisted. Track as
  an Open Question, not a blocker, but disclose the current state honestly in
  `privacy_policy.md`.
- **Sync cost:** private/unlinked events add to push/pull payload size — no special windowing
  needed at this scale, revisit if it becomes a real cost driver.

## Out of Scope (v1)

- **Cross-device contact re-linking.** A private couple-mode event's `contact_id` is a local
  SQLite UUID generated on the original device — meaningless on a fresh install. This spec
  guarantees the event's *data* is never lost, but on a brand-new device it may be restored as an
  effectively unlinked entry (no working Contact reference) rather than automatically
  re-attached to the recreated partner Contact. Reconnecting restored private events to a
  Contact after a device switch is a follow-up, not solved here. (Unlinked/Solo Diary events have
  no such problem — they restore identically since they never had a contact link to begin with.)
- Client-side/end-to-end encryption of event content.
- Any change to the AI Insights pipeline ([002](../002-ai-insights-engine/spec.md)) — that spec's
  privacy boundary (a partner's private events never enter the other partner's insight request)
  is unaffected and still holds; this spec doesn't change who can see what, only what's backed up.

## Open Questions

1. Should the one-time "your private entries are now backed up" disclosure be a blocking modal,
   a dismissible banner, or just a `privacy_policy.md` update read passively? Affects perceived
   trust given how sensitive some event types are.
2. At-rest encryption for `note`/`title` on private rows — worth the complexity now, or a
   documented fast-follow?
3. For restored-but-unlinked private couple events (see Out of Scope), should the Timeline show
   any affordance to manually re-attach them to a Contact, or leave that entirely to a future
   "promote to Contact" flow (already deferred once in [001](../001-solo-unlinked-events/spec.md))?
