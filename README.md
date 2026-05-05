# Love Tracker

> A privacy-first, offline-first relationship journal built with React Native + Expo.
> Log your moments. Keep what's yours private. Share what matters with your partner.

## Project Overview

**Love Tracker** is an offline-first React Native relationship journal. It lets users log
and track relevant checkpoints of their relationship (intimate moments, conflicts, dates,
milestones, etc.) with privacy controls and a partner-sync feature.

**Structure: flat repo (no workspaces / no Turborepo).** Each app (`mobile/`, `server/`) is fully
independent. The root `package.json` provides convenience scripts only.

---

## Tech Stack

### Mobile (`mobile/`)
| Concern | Library | Version |
|---|---|---|
| Framework | React Native + Expo | RN 0.83.6 / Expo ~55 |
| Language | TypeScript | ~5.9.2 |
| Routing | Expo Router (file-based) | ~55.0.13 |
| State | Zustand | 5.0.12 |
| Local DB | Expo SQLite | ~55.0.0 |
| Persistent KV | AsyncStorage | 2.2.0 (replaces MMKV for better stability) |
| Secure storage | Expo Secure Store | ~55.0.0 |
| Biometrics | Expo Local Authentication | ~55.0.0 |
| i18n | i18next + react-i18next | 26.0.4 / 17.0.2 |
| Date utils | date-fns | 4.1.0 |
| ID generation | uuid | 13.0.0 |
| Charts | Victory Native | 36.9.2 |
| Calendar | react-native-calendars | 1.1314.0 |
| Animations | React Native Reanimated | 4.2.1 |
| Haptics | Expo Haptics | ~55.0.0 |
| Typography | @expo-google-fonts/inter | 0.4.2 |
| Navigation | @react-navigation/native | 7.1.33 |
| Push notifications | expo-notifications | ~55.0.0 |
| Background tasks | expo-task-manager | ~55.0.0 |

### Server (`server/`)
| Concern | Library | Version |
|---|---|---|
| Framework | Express | 4.18.2 |
| Language | TypeScript | 5.0.0 |
| Dev runner | ts-node-dev | 2.0.0 |
| Push notifications | Expo Server SDK | via direct fetch to Expo API |

---

## File Structure

```
love-tracker/
├── mobile/                            # React Native / Expo app
├── CHILD_SAFETY.md                    # Child safety standards (Play Store)
├── PRIVACY_POLICY.md                  # App privacy policy
├── README.md                          # Project documentation
├── mobile/                            # Mobile application source
│   ├── src/
│   │   ├── app/                       # Expo Router screens
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx          # Home: quick-log grid + recent events
│   │   │   │   ├── calendar.tsx       # Monthly calendar with event dots
│   │   │   │   ├── timeline.tsx       # Chronological event list
│   │   │   │   ├── stats.tsx          # Analytics dashboard
│   │   │   │   ├── settings.tsx       # Theme, privacy, language, sync, POKES
│   │   │   │   └── _layout.tsx        # Tab bar setup
│   │   │   ├── modal/
│   │   │   │   ├── log-event.tsx      # Create event (full form)
│   │   │   │   ├── event-detail.tsx   # View / edit / delete event
│   │   │   │   └── add-contact.tsx    # Create contact
│   │   │   ├── _layout.tsx            # Root: init, push setup, background tasks
│   │   │   ├── +html.tsx              # HTML shell for web target
│   │   │   └── +not-found.tsx
│   │   ├── db/
│   │   │   ├── schema.ts              # DB init, table creation, migrations
│   │   │   └── events.ts              # Event CRUD helpers (now async)
│   │   ├── store/
│   │   │   ├── useEventsStore.ts      # Zustand: events state + actions
│   │   │   ├── useSyncStore.ts        # Zustand: auth, sync, push token registration
│   │   │   └── usePokeStore.ts        # Zustand: pokes, slot customization
│   │   ├── services/
│   │   │   ├── syncApi.ts             # REST API client (auth, sync, pokes)
│   │   │   └── notificationService.ts # Push registration, categories, background task
```

---

## Database Schema

### Local (SQLite)
```sql
-- POKES / PITICHES table
CREATE TABLE pitches (
  id              TEXT PRIMARY KEY,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  from_partner_id TEXT,
  message         TEXT,
  emoji           TEXT,
  received_at     INTEGER NOT NULL,
  read_at         INTEGER
);
```

### Server (PostgreSQL)
```sql
-- Added column for Push Notifications
ALTER TABLE users ADD COLUMN push_token TEXT;

-- Quick interactions table
CREATE TABLE pokes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  message        TEXT NOT NULL,
  emoji          TEXT NOT NULL,
  sent_at        BIGINT NOT NULL,
  read_at        BIGINT
);
```

---

## Key Features

- **Quick Poke**: Persistent notification in the system tray with 3 customizable slots. Send "Thinking of you", "I love you", etc., without opening the app.
- **Push Notifications**: Receive instant alerts when your partner logs a new event (Shared events only).
- **Privacy Lock**: 4-digit PIN or Biometrics (FaceID/Fingerprint) with configurable timeout.
- **Partner Sync**: Real-time synchronization of shared events across devices.
- **Offline-first**: Everything works without internet; sync happens automatically when back online.

---

## Implementation Status

### Done
- Local SQLite database (contacts + events CRUD)
- Biometric + PIN lock
- Theme switching (6 themes)
- i18n: English + Portuguese
- Partner pairing via invite codes
- **Push Notifications**: Configured for partner activity alerts (Fixed for standalone builds).
- **Quick Poke System**: Background task + persistent notification buttons + slot customization.
- **Production Deployment**: Initial builds (v1.0.1, versionCode 3) submitted to Google Play Store.
- **Render Server Stability**: Fixed deployment configuration for flat repo structure.
- **Web Stability**: Fully async DB layer.
- **TypeScript Compliance**: Zero errors in both packages.

### Not Yet Started
- Export / import data
- photo attachments on events
- Streak calculation

---

## dev Commands
`npm run server` (server dir) / `npx expo start` (mobile dir)

---

## Deployment

### Backend (Render)
To deploy the server to Render:
1. Create a **Web Service** on Render.
2. Link your GitHub repository.
3. Set **Root Directory** to `server`.
4. Set **Build Command** to `npm install && npm run build`.
5. Set **Start Command** to `npm start`.
6. Add your Environment Variables (`DATABASE_URL`, `JWT_SECRET`, etc.).

### Mobile (EAS)
- **Build:** `eas build --platform android --profile production`
- **Submit:** `eas submit --platform android` (Select latest build, status will be `draft` for first submission).

---

## Architecture Principles
1. **Offline-first.** Local SQLite is source of truth.
2. **Privacy by design.** `is_private = 1` events never leave the device.
3. **Async everywhere.** DB and API calls must be awaited.
4. **i18n strings.** No hardcoded text in components.
5. **Theme context.** No hardcoded hex colors.
6. **Expo SDK consistency.** Use `npx expo install` for native modules.
