# Love Tracker — Project Guide for Claude

## Project structure

Monorepo with two packages:

- `mobile/` — Expo (React Native) app, Android-first, deployed to Google Play via EAS
- `server/` — Node.js/Express REST API, deployed to Render

The mobile app is the primary focus of most development work.

## Version management

**How versioning works:**

- `mobile/app.json` → `android.versionCode` is the build number (integer, auto-incremented by EAS on each production build via `autoIncrement: true` in `eas.json`)
- `mobile/app.config.js` → dynamically computes `version` as `"1.0.{versionCode}"` using `EAS_BUILD_NUMBER` env var at build time (falls back to `versionCode` from `app.json` locally)
- The Settings screen reads `Constants.expoConfig?.version` to display the version — this is the source of truth for what the user sees

**Rules:**
- Never manually bump `versionCode` in `app.json` before a build — EAS handles it via `autoIncrement`
- `versionCode` in `app.json` reflects the last known build number; it will be incremented by EAS on the next build
- Do not hardcode version strings in UI — always derive from `Constants.expoConfig?.version`

## Deployment flow

```
eas build --profile production   # builds AAB, auto-increments versionCode
eas submit --profile production  # submits to Play Store (internal track)
```

This is the only moment that constitutes a "deploy." Local `expo start` and `eas build --profile preview` are NOT deploys.

## Changelog discipline

**File:** `CHANGELOG.md` at the repo root.

**Rules:**
- `[Unreleased]` section: accumulate all notable changes during development
- On deploy (`eas submit`): rename `[Unreleased]` to `[1.0.X] - YYYY-MM-DD` (where X is the new versionCode), then add a fresh empty `[Unreleased]` block
- Never add entries for local dev or preview builds
- Entries should be user-facing and meaningful (skip chores, refactors, and infra-only changes unless they affect the user experience)

## Before finishing any task

1. Check whether the change is user-visible or affects the deployment flow
2. If yes, add a bullet to the `[Unreleased]` section in `CHANGELOG.md`
3. If the change affects setup, architecture, or running the project, update `mobile/README.md` accordingly

## Key files

| File | Purpose |
|---|---|
| `mobile/app.json` | Static Expo config; `versionCode` is the build counter |
| `mobile/app.config.js` | Dynamic Expo config; computes version string at build time |
| `mobile/eas.json` | EAS build profiles; `autoIncrement: true` for production |
| `mobile/src/app/(tabs)/settings.tsx` | Settings screen; displays version via `Constants.expoConfig?.version` |
| `CHANGELOG.md` | Deploy-gated changelog |
