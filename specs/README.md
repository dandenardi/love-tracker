# Love Tracker — Product Specs (SDD)

This folder holds spec-driven-development documents for the next major phase of Love Tracker,
starting after the current open-testing release. Each spec is a contract: it describes target
behavior precisely enough that any implementer (human or AI) can build against it without
re-litigating product decisions mid-implementation.

## The pillar this phase is built on

Love Tracker today is an event journal. The next phase turns that journal into an **AI-analyzed
relationship diary**, serving two distinct usage modes:

- **Solo mode** — a person casually dating logs standalone moments ("consegui o número da
  Fulana", "fui rejeitado") without necessarily naming or formally tracking each person as a
  Contact. Low friction is the priority.
- **Couple mode** — two paired users log shared events (already implemented), plus private
  events visible only to the logger (`is_private` flag, enforced at sync — but see
  [004](004-private-event-backup-sync/spec.md): "never partner-visible" was implemented,
  "backed up so it isn't lost" was not, until this spec).

**AI Insights is the premium feature and the monetization vehicle.** Both modes feed a history
of structured events into an AI analysis layer that surfaces patterns the user can't easily see
themselves — e.g. "you tend to disengage before the 4th date" (solo) or "libido dips between day
X and Y of the cycle" (couple). This is explicitly the paid tier; the free tier is the journal
itself plus a shallow teaser insight.

## Specs in this phase

| # | Spec | Depends on |
|---|---|---|
| [001](001-solo-unlinked-events/spec.md) | Solo unlinked events — `contact_id` becomes nullable, low-friction quick-log | none |
| [002](002-ai-insights-engine/spec.md) | AI Insights Engine — provider-agnostic analysis of solo + couple history | 001 (needs unlinked events to analyze solo patterns) |
| [003](003-premium-entitlements/spec.md) | Premium Entitlements — freemium gating, IAP, paywall UX | 002 (gates access to the AI feature) |
| [004](004-private-event-backup-sync/spec.md) | Private Event Backup Sync — server-side backup for private/unlinked events, scoped to the owning user, never partner-visible | none (fixes a pre-existing gap surfaced while writing 001; applies to couple-mode private events too) |
| [005](005-deletion-sync/spec.md) | Deletion Sync — deleting an event actually propagates to the server (soft-delete + tombstone), instead of only ever deleting locally | 004 (adds `ownDeletedIds` alongside 004's `ownEvents`, same query shape) |
| [006](006-pseudonymous-contact-tokens/spec.md) | Pseudonymous Contact Tokens — one-way hashed per-contact tag so solo insights can detect person-specific patterns without the server ever learning contact identity | 002 (fills a gap discovered in its implementation) — **implemented** |
| [007](007-insight-time-windowing/spec.md) | Time-Windowed AI Insights — optional date-range scoping for an insight request, instead of always the full history | 002 (closes its Open Question 3, "windowing," never implemented in the first pass) |
| [008](008-relationship-profile/spec.md) | Relationship Profile — new `profile` insight domain finding patterns that recur across a user's different relationships/contacts over time, not within just one | 002, 006 (uses `contactToken` grouping; extends it with an equivalent hashed key for partnerships) |

001 → 002 → 003 is the natural build order, not a hard requirement — 002 can be prototyped
against existing contact-linked events before 001 ships, but the full solo-mode value
proposition needs 001 first. 004 is a durability fix that should land before real users start
relying on Solo Diary or private couple events, independent of the AI/monetization track. 007
and 008 are both extensions of 002's already-shipped engine — either can be implemented
independently of the other.

## Cross-cutting principles (inherited from `AGENTS.md` / `CLAUDE.md`)

- **Offline-first.** Local SQLite remains source of truth; AI insight requests are the one
  feature that inherently requires connectivity — degrade gracefully when offline (show cached
  last insight, don't block the rest of the app).
- **Privacy by design.** `is_private = 1` events must never reach a partner — not via sync, not
  via AI analysis ([002](002-ai-insights-engine/spec.md)'s AI-couple boundary), not via the
  backup channel [004](004-private-event-backup-sync/spec.md) adds. "Never leaves the device" and
  "never partner-visible" are different guarantees — 004 changes the former (for durability)
  while keeping the latter absolute, enforced at the query level.
- **No duplicate types.** Any schema/type change lands in both `mobile/src/types/shared.ts` and
  `server/shared.ts` identically.
- **i18n.** All new user-visible strings go into `mobile/src/locales/en.json` and `pt.json`.
- **README discipline.** Once a spec is implemented and verified, update the root `README.md`
  (Implementation Status, Database Schema, File Structure) per `AGENTS.md` — not done as part of
  writing these specs, but required before considering any of them "done."
- **Changelog discipline.** Per `CLAUDE.md`, user-visible changes from these specs get an entry
  in `[Unreleased]` in `CHANGELOG.md`, promoted to a version block on the next `eas submit`.

## What these specs are not

- Not a UI mockup set — visual design is left to implementation, though UX flows and surface
  points (e.g. where a paywall appears) are specified.
- Not a final legal/privacy review — [002](002-ai-insights-engine/spec.md) flags required
  updates to `privacy_policy.md` as a dependency, but the actual policy language is out of scope
  here.
- Not a commitment to a specific AI vendor or IAP vendor — both are deliberately abstracted per
  the user's decision; see Open Questions in each spec.
