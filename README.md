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
| Real-time | Socket.io Client | 4.8.1 |
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
| Real-time | Socket.io | 4.8.1 |
| Language | TypeScript | 5.0.0 |
| Dev runner | ts-node-dev | 2.0.0 |
| Push notifications | Expo Server SDK | via direct fetch to Expo API |

---

## File Structure

```
love-tracker/
├── mobile/                            # React Native / Expo app
│   ├── app.json                       # Mobile configuration
│   ├── src/                           # Mobile source code
│   │   ├── app/                       # Expo Router screens (tabs, modals, notifications)
│   │   ├── components/                # Reusable UI components
│   │   ├── db/                        # SQLite schema and helpers
│   │   ├── store/                     # State management (events, contacts, pokes, activities)
│   │   └── services/                  # API and Notification services
├── server/                            # Express backend
│   ├── index.ts                       # Server entry point
│   ├── routes/                        # API routes
│   ├── middleware/                    # Express middleware
│   ├── db/                            # PostgreSQL connection
│   └── shared.ts                      # Shared types (copy)
├── CHILD_SAFETY.md                    # Child safety standards
├── PRIVACY_POLICY.md                  # App privacy policy
└── README.md                          # Project documentation
```

---

## Database Schema

-- EVENTS table (Source of truth for Journal & Pokes)
CREATE TABLE events (
  id           TEXT PRIMARY KEY,
  contact_id   TEXT REFERENCES contacts(id),
  type         TEXT NOT NULL,
  title        TEXT,
  note         TEXT,
  intensity    INTEGER DEFAULT 0,
  mood_tag     TEXT,
  occurred_at  INTEGER NOT NULL,
  logged_at    INTEGER NOT NULL,
  synced       INTEGER DEFAULT 0,
  is_private   INTEGER DEFAULT 0,
  delivered_at INTEGER, -- For POKEs
  read_at      INTEGER  -- For POKEs
);
```

### Server (PostgreSQL)
```sql
-- Added column for Push Notifications
ALTER TABLE users ADD COLUMN push_token TEXT;

-- Partnerships table
CREATE TABLE partnerships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_1   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_2   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  BIGINT NOT NULL,
  unpaired_at BIGINT,
  UNIQUE(user_id_1, user_id_2)
);

-- Events table (Sync)
CREATE TABLE events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id      TEXT NOT NULL,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  title          TEXT,
  note           TEXT,
  intensity      INTEGER DEFAULT 0,
  mood_tag       TEXT,
  occurred_at    BIGINT NOT NULL,
  logged_at      BIGINT NOT NULL,
  deleted_at     BIGINT,
  is_private     INTEGER NOT NULL DEFAULT 0,
  created_at     BIGINT NOT NULL
);

-- Quick interactions table
CREATE TABLE pokes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  partnership_id UUID REFERENCES partnerships(id) ON DELETE SET NULL,
  message        TEXT NOT NULL,
  emoji          TEXT NOT NULL,
  sent_at        BIGINT NOT NULL,
  delivered_at   BIGINT,
  read_at        BIGINT
);
```

---

## Key Features

- **Quick Poke**: Persistent notification in the system tray with 3 customizable slots. Send "Thinking of you", "I love you", etc., without opening the app.
- **Poke Status Icons**: WhatsApp-style checkmarks (Sent, Delivered, Read) for all pokes in the Notification Center.
- **Poke Ping-Pong**: Get notified when your partner receives your poke, with quick buttons to send another one back immediately.
- **Action Feedback**: Instant confirmation notification when sending pokes from the system tray buttons.
- **Respond Now**: Received pokes now show your 3 slots as buttons in the notification tray, allowing for instant replies.
- **Definitive Break-up**: Option to permanently remove unpaired partners with a choice to wipe all local history associated with them.
- **Push Notifications**: Receive instant alerts when your partner logs a new event (Shared events only).
- **Privacy Lock**: 4-digit PIN or Biometrics (FaceID/Fingerprint) with configurable timeout.
- **Partner Sync**: Real-time synchronization of shared events across devices.
- **Notification Inbox vs. Timeline History**: A smart separation where the Notification Center acts as an "Inbox" (clearable, persistent state) while the Timeline serves as a permanent relationship journal, including all "Toques" (Pokes) exchanged.
- **Offline-first**: Everything works without internet; sync happens automatically when back online.

---

## Implementation Status

### Done
- Local SQLite database (contacts + events CRUD)
- Biometric + PIN lock
- Theme switching (6 themes)
- i18n: English + Portuguese
- Partner pairing via invite codes
- **Push Notifications**: FCM V1 integration stable for standalone Android builds (Fixed EAS Project ID and Google IAM permissions).
- **Real-time WebSockets**: Instant pokes and event synchronization (Socket.io).
- **Quick Poke System**: Background task + persistent notification buttons + slot customization. (Fixed registration for "killed" app state and enhanced with instant replies).
- **Notification Center**: Unified activity hub for pokes and partner events with badge count.
- **Production Deployment**: Builds submitted to Google Play Store (Current: v1.0.2).
- **App Branding & Versioning**: Proper "Love Tracker" name, premium Splash Screen, and dynamic versioning in Settings.
- **Render Server Stability**: Fixed deployment configuration for flat repo structure.
- **Web Stability**: Fully async DB layer.
- **TypeScript Compliance**: Zero errors in both packages.
- **Testing Infrastructure**: Jest + RNTL configured; Maestro smoke test added; Development Client setup.
- **Adaptive API URL**: Automatic host IP detection for physical device debugging.
- **Sync Stability**: Fixed duplicate partner contacts and improved WebSocket diagnostics.
- **Google Sign-In**: Fully integrated and debugged for Android (Fixes "black screen" and DEVELOPER_ERROR).
- **Notification Reliability**: Fixed background task registration, added response listeners, and implemented token persistence/cleanup. (Resolved critical 403 Permission Denied issues and EAS Project ID mapping).
- **Poke Status & Delivery**: Implemented real-time delivery/read indicators (checks), tray feedback, and delivery notifications ("Poke Ping-Pong").
- **Persistence & Inbox Logic**: Fixed duplicate notification bug by persisting sync state (`lastPokeCheckedAt`) and integrated "Toques" into the Timeline history for permanent record-keeping.
- **Poke System 2.0 (Total Stability)**: Refactored state management to use SQLite as source of truth for Poke status. Implemented a 48h Status Reconciler to ensure read receipts are recovered even if sockets fail. Unified the Notification Inbox and Timeline history flows.

### Not Yet Started
- Export / import data
- photo attachments on events
- Streak calculation

---

## Dev Commands

### General
- `npm run server` (server dir)
- `npm run db:reset` (server dir) - **Wipes and recreates PostgreSQL schema**

### Mobile (`mobile/`)
- `npm run dev` - Starts the Metro bundler for **Development Client**.
- `npx expo start` - Starts Metro for **Expo Go** (limited).
- `npm test` - Runs Jest unit/component tests.
- `npm run build:dev` - Builds the local Development Client APK.
- `npm run build:preview` - Builds a Preview APK via EAS.

---

## Testing Strategy

1. **Unit/Component (Jest)**: Run `npm test`. Focus on stores and reusable components.
2. **Integration (Dev Client)**: Use `npm run dev`. Tests native modules like notifications and biometrics.
3. **E2E (Maestro)**: Run `maestro test .maestro/smoke-test.yaml`. (Requires Maestro CLI installed).
4. **Internal Distribution**: Use `build:preview` to share APKs with testers.

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
7. **Adaptive API URL.** Automatically detect host IP via `hostUri` in local dev, fallback to environment-defined production URL.
8. **Google Sign-In SHA-1.** Ensure the SHA-1 fingerprints for BOTH local dev (from `./gradlew signingReport`) AND production (from Google Play Console -> App Integrity) are added to the Google Cloud Console (OAuth 2.0 Client IDs).
