# Changelog

All notable changes to Love Tracker are documented here.

**Convention:** Only add entries when deploying via `eas build --profile production` + `eas submit`. Local development changes accumulate under `[Unreleased]` and are promoted to a versioned section at deploy time.

The version format is `MAJOR.MINOR.BUILD` where `BUILD` is the EAS `versionCode` (auto-incremented by EAS on each production build).

---

## [Unreleased]

---

## [1.0.14] - 2026-08-21

### Fixed
- The contact strip on the home screen now shows when a partner is no longer paired, instead of looking identical to an active partner
- Push notifications (pokes, partner activity) now arrive in your selected language instead of always in English

---

## [1.0.13] - 2026-08-18

### Fixed
- Notifications you already read no longer reappear as unread after a while
- You no longer receive poke notifications from a partner after unpairing from them

---

## [1.0.12] - 2026-07-14

### Added
- Solo Diary: log dating moments without creating a Contact first — tap "Solo Diary" on the home screen to journal freely, no pairing or profile required
- Private events and Solo Diary entries are now backed up to your account so they survive a lost or replaced phone — still never visible to a partner
- Poke cards customization: each of the 3 notification slots can now use a custom emoji and personalized message instead of a preset
- AI Insights: opt in to get an AI-generated card highlighting patterns in your solo dating or couple history, accessible from the Stats tab
- Solo AI Insights can now recognize when a pattern involves the same person across multiple logged events (e.g. "you tend to stop after the 3rd date") — still without ever sending any name or contact info off your device
- Premium subscription: unlock unlimited AI Insights with a monthly plan — free users get a preview teaser based on their own stats; manage or restore your subscription from Settings

### Fixed
- Deleting an event now actually removes it everywhere — previously a deletion only happened on the device you deleted it from, so the event could reappear via sync with your partner or your other devices

---

## [1.0.9] - 2026-05-25

### Fixed
- Version display in Settings now correctly reads the EAS-deployed version instead of a hardcoded string

---

## [1.0.8] - 2026-05-25

### Added
- Dynamic version numbering: version is now computed from `baseVersion` + EAS `versionCode` (e.g. `1.0.8`)
- Poke / cutucar feature: send quick emotional nudges to your partner with customizable slots
- Notification center and improved notification delivery for pokes and sync events

### Changed
- Partner sync stability improvements and database schema consistency fixes
- Build type set to `app-bundle` for production Play Store submissions

---

## [1.0.4] - initial tracked release

### Added
- Partner sync via invite codes (pair, unpair, forget partner)
- Google Sign-In support alongside email/password auth
- In-app safety reporting (mailto link to developer)
- Notification channel setup for standalone builds

### Changed
- Android package ID stabilised to `com.dandenardi.lovetracker`
- EAS secrets used to resolve `google-services.json` at build time
