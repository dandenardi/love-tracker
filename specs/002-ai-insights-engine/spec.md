# 002 — AI Insights Engine

## Overview

The core premium feature: turn a user's logged event history into structured, evidence-backed
insights about their dating/relationship patterns. This spec covers the data pipeline, the
provider abstraction, the two insight domains (solo and couple), and — most importantly — the
privacy boundaries required before any user data reaches a third-party LLM API. It depends on
[001](../001-solo-unlinked-events/spec.md) for solo-mode data to be meaningful, and is gated by
[003](../003-premium-entitlements/spec.md) for monetization.

## User Stories

- As a solo user with a history of casual dating events, I want an insight like "you tend to
  disengage before the 4th date" so I can recognize a pattern I didn't consciously see.
- As a paired user, I want an insight like "your partner's/your own logged low-libido days cluster
  between day X and Y of a monthly cycle" so we can talk about it with actual data behind it.
- As any user, I want to see WHY the AI reached a conclusion (which logged events support it),
  not just an unexplained claim — trust requires evidence, not just a verdict.
- As a privacy-conscious user, I want to explicitly opt in before any of my data is sent to an
  external AI service, and I want to know what's sent vs. withheld.
- As a free-tier user, I want to see a shallow example of what AI Insights offers, so I understand
  the premium value before paying (see [003](../003-premium-entitlements/spec.md)).

## Functional Requirements

1. Define an `AIInsightProvider` interface, implemented server-side only. Mobile client never
   holds an API key or calls an LLM directly.
   ```ts
   interface InsightRequest {
     userId: string;
     domain: 'solo' | 'couple';
     events: AnonymizedEventSummary[];   // see Data Pipeline below
     locale: string;                      // insight text respects i18n
   }
   interface InsightResult {
     id: string;
     title: string;
     body: string;
     evidenceEventIds: string[];         // which input events support this conclusion
     confidence: 'low' | 'medium' | 'high';
     generatedAt: number;
   }
   interface AIInsightProvider {
     generateInsight(input: InsightRequest): Promise<InsightResult>;
   }
   ```
   Concrete implementations (Anthropic/OpenAI/Gemini/etc.) are chosen at deploy time, not
   hardcoded into route handlers — route handlers depend only on the interface.
2. A minimum-data threshold gates insight generation: e.g. at least N distinct dated events (N
   TBD, suggest starting at 5) before attempting solo pattern analysis, to avoid the AI
   overfitting or hallucinating a "pattern" from 1-2 data points. Below threshold, show a
   "log a few more events to unlock this" message instead of calling the AI.
3. Insight output is ALWAYS rendered as a structured card (title, body, supporting evidence list
   linking back to real logged events, confidence label) — never raw unstructured LLM text
   dumped into the UI.
4. Insight generation is rate-limited per user (see Cost Control) — even premium users get a
   capped refresh frequency (e.g. once per day), not unlimited on-demand calls.
5. Couple-domain insights MUST only be generated from: (a) shared (non-private) events visible to
   both partners, plus (b) the REQUESTING user's own private events. A partner's private events
   are NEVER included, mirroring the existing sync privacy boundary — see Privacy & Safety.

## Data Pipeline

What gets aggregated into `AnonymizedEventSummary` before being sent to the LLM:

- Included: `type`, `intensity`, `mood_tag`, `occurred_at` (or a derived relative offset, e.g.
  "day 14 of tracked history" rather than absolute calendar dates, to reduce identifiability),
  whether the event had a contact link (solo) and which contact it was tied to — represented as a
  pseudonymous per-analysis token, never the contact's real name — for cross-event pattern
  detection within the same person.
- Excluded by default: the free-text `note` field. This is the field most likely to contain
  identifying or highly sensitive content (names, specific acts, locations). Sending it to a
  third-party API requires an explicit, separate opt-in (see Privacy & Safety) — default
  analysis works off structured fields only (type/intensity/mood/timing).
- Windowing: rolling window (suggest 180 days, tunable) or "since pairing" for couple mode,
  whichever is more relevant to the domain — avoids re-sending a user's entire lifetime history
  on every request (cost + relevance).

## Insight Domains

### Solo
Pattern-spotting across a user's own unlinked + contact-linked events: recurring behavioral
patterns (e.g. disengagement timing, rejection frequency by context, mood correlation with
event type). Requires [001](../001-solo-unlinked-events/spec.md) for unlinked events to exist as
analyzable data.

### Couple
Pattern-spotting across the shared relationship timeline plus the requesting user's own private
layer. Two users in the same partnership requesting an insight get PERSONALIZED results (since
each sees their own private layer blended with the shared layer) — this is intentional, not a
bug: insights are always scoped to "what does this look like from my seat," never a merged view
that would leak one partner's private data into the other's results.

## Privacy & Safety

This is the most load-bearing section of this spec — Love Tracker's existing privacy posture
(`is_private` never syncs to a partner) sets user expectations that must not be violated by
introducing a third party (the LLM provider) into the data flow.

1. **Explicit opt-in required** before a user's data is ever sent to generate any AI insight —
   a dedicated consent screen/toggle, not bundled into general ToS acceptance. Framed clearly:
   "this sends your event history to [provider] to generate insights."
2. **Default analysis excludes free-text notes.** Structured fields only, unless the user opts
   into a separate "deep analysis" mode that includes note text — clearly labeled as a distinct,
   higher-sensitivity choice.
3. **Partner boundary is absolute.** A partner's `is_private = 1` events must never appear in
   any `InsightRequest`, for any user, under any circumstance — same invariant as sync, enforced
   at the same query layer (reuse/extend the existing privacy filter helpers rather than
   reimplementing the rule ad hoc for AI code paths).
4. **Data retention on the server:** define how long prompts/completions are retained
   server-side for debugging/caching purposes (recommend: cached only long enough to serve the
   rate-limited "one refresh per day" re-read, then discarded — not retained indefinitely).
5. **Dependency, not part of this spec:** `privacy_policy.md` must be updated to disclose the AI
   provider relationship, what data is shared, and retention policy, before this feature ships.
   Writing that update is out of scope for this spec but is a hard release blocker.
6. Given the sensitive/intimate nature of some event types (`INTIMACY`, mood/libido-adjacent
   data), treat this as sensitive personal data requiring extra caution — no analytics/logging
   pipeline should incidentally capture raw note text or event content in application logs.

## Non-Functional

- **Cost control:** cap request frequency (e.g. 1 generation per user per day regardless of
  tier — free tier gets the teaser only, see [003](../003-premium-entitlements/spec.md)); cap
  the event window sent per request; cache the last generated insight and serve it from cache
  until the next allowed refresh instead of regenerating on every screen visit.
- **Latency:** insight generation is not expected to be instant — UI should show a loading/
  generating state, not block other app functionality (offline-first principle: the rest of the
  app must work with zero dependency on this feature being available).
- **Offline behavior:** if offline, show the last cached insight (with a "generated N days ago"
  label) rather than an error state.

## Out of Scope

- The actual prompt text/templates (implementation detail, iterate freely without re-spec'ing).
- Multi-turn chat/conversational AI — this is one-shot insight generation, not a chatbot.
- Any specific LLM vendor choice (see Open Questions).

## Open Questions

1. ~~Which LLM provider to use.~~ **Resolved (2026-07-07):** Claude API (Anthropic),
   `claude-sonnet-5` — chosen over Opus for cost given the low call volume (≤1/user/day) and
   small-to-medium expected scale. Structured output via `output_config.format` (Zod schema),
   system prompt cached (`cache_control: ephemeral`) since it's identical across all users.
2. ~~Exact minimum-event threshold.~~ **Resolved: 5**, implemented in
   `server/services/insightService.ts`.
3. Exact rolling window length for "recent history" (suggested 180 days) — **not implemented in
   the first pass**: `buildEventSummaries` currently sends the user's full history with no
   windowing. Flagged as a follow-up once real usage data shows whether this matters for
   cost/relevance.
4. Should "deep analysis" (opting into free-text note inclusion) be a separate premium sub-tier,
   or bundled into the same premium purchase as structured-only analysis? Affects
   [003](../003-premium-entitlements/spec.md) — **still open**; not built in this pass (default
   structured-only analysis only, no deep-analysis toggle exists yet).
5. ~~The server has no way to group events by which casual dating contact they belong to.~~
   **Tracked as its own spec:** [006-pseudonymous-contact-tokens](../006-pseudonymous-contact-tokens/spec.md),
   written up 2026-07-07, not yet implemented. Until it ships, this implementation analyzes the
   flat event stream only (timing, type, intensity, mood) — no per-person pattern detection.
6. **New:** no entitlement/paywall gating exists yet — every authenticated, opted-in user gets
   the full engine for free until [003](../003-premium-entitlements/spec.md) is built.
