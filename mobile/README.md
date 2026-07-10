# Love Tracker — Mobile App

React Native / Expo app for the Love Tracker relationship journal. Android-first, distributed via Google Play.

## Requirements

- Node 22.x
- EAS CLI (`npm install -g eas-cli`)
- `google-services.json` in `mobile/` (not committed; provided via EAS secret for CI builds)

## Running locally

```bash
cd mobile
npm install
npx expo start
```

Use a development build (not Expo Go) for full feature support (SQLite, notifications, secure store).

## Building & deploying

```bash
# Preview APK (internal distribution)
eas build --profile preview

# Production AAB → Google Play
eas build --profile production
eas submit --profile production
```

`autoIncrement: true` in `eas.json` bumps `android.versionCode` in `app.json` automatically on each production build. The displayed version (`1.0.{versionCode}`) is computed at build time in `app.config.js`.

## After a production deploy

1. Move `[Unreleased]` in `CHANGELOG.md` to `[1.0.X] - YYYY-MM-DD`
2. Add a fresh empty `[Unreleased]` block
3. Verify the Settings screen shows the new version on the installed build

## Project structure

```
mobile/
  app.json          # static config; versionCode is the build counter
  app.config.js     # dynamic config; computes version string at build time
  eas.json          # EAS build profiles
  src/
    app/            # Expo Router screens (file-based routing)
    components/     # shared UI components
    constants/      # themes, event types
    context/        # ThemeContext
    hooks/          # usePrivacyLock, etc.
    i18n/           # translations (EN, PT)
    services/       # notifications, factoryReset
    store/          # Zustand stores (contacts, sync, poke)
```
