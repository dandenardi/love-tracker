# 005 — Deletion Sync

## Overview

Discovered while implementing [004](../004-private-event-backup-sync/spec.md): deleting an event
in the app never tells the server. `mobile/src/store/useEventsStore.ts`'s `removeEvent` calls
`deleteEvent(id)` (`mobile/src/db/events.ts:138`), which does a hard `DELETE FROM events WHERE id
= ?` — purely local. The client has a working `syncApi.delete(clientId)` function
(`mobile/src/services/syncApi.ts:191`) and the server has a working soft-delete route (`DELETE
/sync/:clientId` → `SyncService.deleteEvent`, sets `deleted_at`), but **nothing in the app ever
calls it.** This affects every event type — shared, private, and unlinked alike.

Concretely, today: if user A deletes a shared event, the server still has the row. If user A's
partner hasn't pulled it yet, they'll receive it as if it were never deleted. If user A ever
restores from a second device (via [004](../004-private-event-backup-sync/spec.md)'s own-events
backup), the "deleted" event resurrects, because the server never learned it was deleted.

## User Stories

- As a user, when I delete an event, I want it to actually be gone — not reappear on my other
  device, and not reappear for my partner if they hadn't synced it yet.
- As a user who deletes something while offline, I want that deletion to still take effect once
  I'm back online, not be silently lost because the local record is already gone.
- As a partner, I want to see the other person's deletions of shared events reflected on my
  device (this part already technically works today via `deletedIds` — the missing half is that
  deletions are never sent in the first place).

## Functional Requirements

1. Local deletes MUST become soft-deletes: add a nullable `deleted_at` column to the mobile
   SQLite `events` table (same idempotent try/catch `ALTER TABLE` pattern already used in
   `mobile/src/db/schema.ts` for `is_private`/`delivered_at`/`read_at`).
2. Every local read query in `mobile/src/db/events.ts` (`getEventsByContact`, `getEventsByDate`,
   `getEventsForMonth`, `getAllEvents`, `getPublicEventsForMonth`, `getPublicEventsByDate`,
   `getEventCountByType`, `getDaysSinceLast`) MUST exclude soft-deleted rows (`AND deleted_at IS
   NULL`), the same mechanical, repeated-pattern change as
   [001](../001-solo-unlinked-events/spec.md)'s `contact_id IS ?` change.
3. `useEventsStore.removeEvent` (user-initiated deletion, from the UI) MUST soft-delete locally
   (set `deleted_at`) rather than hard-delete, then trigger a sync attempt — mirroring how new
   events already stay "pending" (`synced = 0`) until successfully pushed. This makes an offline
   deletion durable: if the push fails, the tombstone remains locally and is retried on the next
   sync, instead of the deletion attempt being silently lost forever.
4. During `sync()` (`mobile/src/store/useSyncStore.ts`), a new step pushes every locally
   soft-deleted, not-yet-confirmed event via the existing `syncApi.delete(clientId)` call; only on
   success does the local row get hard-purged. No new push endpoint needed — reuse `DELETE
   /sync/:clientId`.
5. Processing an *incoming* deletion (the existing partner `deletedIds`, and a new own-device
   deletion channel — see FR6) MUST hard-delete locally immediately, with **no** further outbound
   propagation — the deletion is already confirmed server-side; re-announcing it would be a wasted
   round-trip at best. This requires a separate code path from FR3 (do not reuse
   `removeEvent`/`deleteEvent` for both directions).
6. Add "own-device" deletion propagation, mirroring [004](../004-private-event-backup-sync/spec.md)'s
   `ownEvents`: `SyncService.pullEvents` gains an `ownDeletedIds` array (this user's own rows
   where `deleted_at > lastPulledAt`, regardless of partnership), so deleting a private/unlinked
   event on one device is reflected on the user's other devices too — otherwise
   [004](../004-private-event-backup-sync/spec.md)'s backup would let a deleted private event
   resurrect exactly as described in the Overview.

## Data Model Changes

### Mobile (`mobile/src/db/schema.ts`)
```sql
ALTER TABLE events ADD COLUMN deleted_at INTEGER;
```
Idempotent try/catch, same as existing migrations in this file.

### Shared types (`server/shared.ts` / `mobile/src/types/shared.ts`)
```ts
export interface SyncPullResponse {
  events: (ServerEvent & { partnerId: string })[];
  ownEvents: ServerEvent[];
  deletedIds: string[];       // unchanged: partner's deletions of shared events
  ownDeletedIds: string[];    // NEW: this user's own deletions, for cross-device propagation
  partners: Partner[];
}
```

## API / Interfaces

- No new routes. `DELETE /sync/:clientId` already exists and is correctly scoped
  (`WHERE user_id = $1 AND client_id = $2`) — it just needs to actually be called.
- `GET /sync/pull` response gains `ownDeletedIds`.

**Verified at implementation time (2026-07-07)** directly against the real production database
(Supabase Postgres): two isolated test users, an active partnership, and two events (one shared,
one private/unlinked) authored by user A. After simulating the exact soft-delete query for both,
all 8 assertions held — both events disappeared from the own-events view, both appeared in
`ownDeletedIds`, the shared event disappeared from partner B's events view, and it correctly
appeared in the existing partner-facing `deletedIds`. All test rows were deleted immediately
after; zero rows remain.

## Non-Functional

- No batching for FR4's delete-push step at this app's scale (a handful of deletions per sync
  cycle at most) — one `syncApi.delete` call per pending tombstone is fine, consistent with how
  simple the existing single-event delete endpoint already is.
- Soft-deleted local rows are invisible everywhere (FR2) but not purged until the server confirms
  (FR4) — a user who deletes many events offline for a long time accumulates tombstones locally;
  not a concern at personal-journal scale.

## Out of Scope

- Any UI change — deletion already has a confirm dialog (`events.deleteConfirm`); this spec is
  purely about making the existing delete action actually propagate.
- Conflict resolution for the (very unlikely) case of a user editing an event on one device while
  deleting it on another between syncs — last-write-wins via the existing sync order is
  acceptable, not addressed specially here.

## Open Questions

1. Should locally soft-deleted rows still count toward Stats aggregates until purge, or be
   excluded immediately? Recommend excluded immediately (FR2 already does this via `deleted_at IS
   NULL` on every read), so there's no user-visible difference between "soft" and "hard" deleted —
   the distinction is purely an internal sync-durability mechanism.
2. Retention: once a deletion is confirmed and the local row is purged, is there any value in
   keeping the server-side `deleted_at` row indefinitely vs. a periodic hard-purge job on the
   server? Not needed for v1 — flagged for later if storage ever becomes a concern.
