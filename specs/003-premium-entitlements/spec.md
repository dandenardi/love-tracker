# 003 — Premium Entitlements

## Overview

Defines the freemium gating model that turns the AI Insights Engine
([002](../002-ai-insights-engine/spec.md)) into a monetized feature: what's free, what's paid,
how entitlement is verified, and where the paywall surfaces in the app. This is the layer that
makes the AI feature a business, not just a feature.

## User Stories

- As a free user, I want to see one shallow, stat-based insight so I understand what AI Insights
  offers before paying for it.
- As a premium subscriber, I want unlimited (rate-limited, per [002](../002-ai-insights-engine/spec.md))
  access to full AI-generated insights for both solo and couple domains.
- As a subscriber whose subscription lapses, I want clarity on what happens to insights I already
  generated — do I keep read-only access, or lose access entirely (flagged as open question).
- As the product owner, I want entitlement checked server-side so a modified/rooted client can't
  fake premium access.

## Functional Requirements

1. **Free tier:** one basic "teaser" insight, generated from simple statistical rules (not a full
   LLM call) — e.g. "you've logged 3 FIGHT events and 1 DATE event this month" style observation.
   This can reuse existing aggregate query patterns already in `mobile/src/db/events.ts`
   (`getEventCountByType`, `getDaysSinceLast`) rather than requiring an LLM call at all — keeps
   the free tier's cost at zero.
2. **Premium tier:** unlocks the full `AIInsightProvider`-backed insight generation from
   [002](../002-ai-insights-engine/spec.md), for both solo and couple domains, subject to the
   rate limits already defined there.
3. **Server-side entitlement check is mandatory** on any endpoint that triggers real AI insight
   generation — the mobile client's local "isPremium" state is a UI hint only, never trusted for
   authorization. The server must independently verify entitlement before calling the
   `AIInsightProvider`.
4. **Entitlement state** lives server-side, associated with the `users` table (new
   `entitlements` concept — e.g. a `subscription_status`, `subscription_expires_at` pair, or a
   dedicated `entitlements` table if multiple concurrent entitlement types are anticipated later).
5. **Paywall entry point:** the existing Stats screen (`mobile/src/app/(tabs)/stats.tsx`) is the
   natural host for an "Unlock AI Insights" card, shown once the free teaser has been viewed —
   this reuses an existing, already-visited screen rather than requiring a new navigation
   destination.
6. IAP integration choice (RevenueCat vs. raw Play Billing) is deliberately left open — see Open
   Questions — but whichever is chosen, the client MUST NOT locally set/trust a "premium" flag
   without a server round-trip confirming it (to prevent tampering).

## API / Interfaces

- New endpoint (name TBD at implementation): `GET /entitlements/me` → returns current
  subscription status for the authenticated user, checked before serving any
  `AIInsightProvider`-backed response.
- Insight-generation endpoints (see [002](../002-ai-insights-engine/spec.md)) must call the
  entitlement check inline, returning a "not entitled" response (with enough info for the client
  to show the paywall) rather than silently degrading to the free teaser.

## Non-Functional

- Entitlement checks must be fast (cached/short-lived check, not a slow round-trip to a billing
  provider on every single insight request) — recommend caching entitlement state server-side
  with a short TTL, invalidated via billing-provider webhooks if using RevenueCat.

## Out of Scope

- Actual pricing (amount, currency, trial length) — business decision, not a spec concern here.
- Non-AI premium features (this spec only covers gating the AI Insights feature specifically).
- Web/iOS billing — Love Tracker is Android-first per `CLAUDE.md`; this spec assumes Google Play
  Billing as the underlying payment rail.

## Open Questions

1. ~~RevenueCat vs. raw Play Billing.~~ **Resolved (2026-07-07): RevenueCat.** Implemented via
   `react-native-purchases` (mobile) + a webhook endpoint (`server/routes/webhooks.ts`) that
   updates cached `premium_active`/`premium_expires_at` on `users`, keyed by `appUserID` set to
   our own JWT user id at SDK configuration time (no separate id-mapping table needed).
2. ~~Lapsed subscription behavior.~~ **Resolved: read-only.** Implemented in
   `insightService.generateOrGetInsight` — a cached row is always returned regardless of current
   premium status; only generating a *new* insight requires an active subscription. Verified
   against the production database (see README's Implementation Status).
3. ~~Free tier teaser frequency.~~ **Resolved: recurring, not one-time.** Implemented as
   `mobile/src/services/teaserInsight.ts` — a pure client-side function computed from the
   current calendar month's local events, so it naturally reflects new data each month with no
   explicit "shown once" gating needed.
4. Whether "deep analysis" (opting into free-text note inclusion, per
   [002](../002-ai-insights-engine/spec.md) Open Questions) becomes a separate paid tier above
   base premium, or is bundled — **still open**; entitlements remain a binary free/premium state
   in this implementation, with no code path for a third tier yet.
5. **New, discovered during implementation:** real purchase flow (RevenueCat SDK init →
   offering fetch → actual Google Play purchase → webhook delivery → entitlement sync) has not
   been tested — this environment has no Android emulator or device. The entitlement *logic*
   (webhook handling, expiry-based gating, lapsed read-only access) was verified end-to-end
   against the real production database by simulating webhook payloads directly, which doesn't
   require an actual RevenueCat account. A real purchase needs manual verification once
   RevenueCat + Google Play Console setup (product, entitlement, offering) is complete.
