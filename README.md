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
| Persistent KV | MMKV | 4.3.1 |
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
| Push notifications | expo-notifications | ~55.0.0 *(installed, not yet configured)* |
| Async storage | @react-native-async-storage/async-storage | 2.2.0 |

### Server (`server/`)
| Concern | Library | Version |
|---|---|---|
| Framework | Express | 4.18.2 |
| Language | TypeScript | 5.0.0 |
| Dev runner | ts-node-dev | 2.0.0 |

### Shared Types
- **Mobile**: `mobile/src/types/shared.ts` — local copy of domain + API contract types
- **Server**: `server/shared.ts` — local copy of domain + API contract types
- Both files are kept in sync manually (they are identical in content).

---

## File Structure

```
love-tracker/
├── mobile/                            # React Native / Expo app
│   ├── src/
│   │   ├── app/                       # Expo Router screens
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx          # Home: quick-log grid + recent events
│   │   │   │   ├── calendar.tsx       # Monthly calendar with event dots
│   │   │   │   ├── timeline.tsx       # Chronological event list
│   │   │   │   ├── stats.tsx          # Analytics dashboard
│   │   │   │   ├── settings.tsx       # Theme, privacy, language, partner sync
│   │   │   │   └── _layout.tsx        # Tab bar setup
│   │   │   ├── modal/
│   │   │   │   ├── log-event.tsx      # Create event (full form)
│   │   │   │   ├── event-detail.tsx   # View / edit / delete event
│   │   │   │   └── add-contact.tsx    # Create contact
│   │   │   ├── _layout.tsx            # Root layout: init, lock screen, theme
│   │   │   ├── +html.tsx              # HTML shell for web target
│   │   │   └── +not-found.tsx
│   │   ├── components/
│   │   │   └── LockScreen.tsx         # 4-digit PIN keypad
│   │   ├── db/
│   │   │   ├── schema.ts              # DB init, table creation, migrations
│   │   │   ├── events.ts              # Event CRUD helpers
│   │   │   └── contacts.ts            # Contact CRUD helpers
│   │   ├── store/
│   │   │   ├── useEventsStore.ts      # Zustand: events state + actions
│   │   │   ├── useContactsStore.ts    # Zustand: contacts state + actions
│   │   │   └── useSyncStore.ts        # Zustand: auth + partner sync state
│   │   ├── hooks/
│   │   │   └── usePrivacyLock.ts      # Biometric + PIN lock logic
│   │   ├── context/
│   │   │   └── ThemeContext.tsx       # 6 themes, persisted in MMKV
│   │   ├── constants/
│   │   │   ├── eventTypes.ts          # 7 event types, 8 mood tags, colors
│   │   │   └── themes.ts              # Full color palettes for 6 themes
│   │   ├── services/
│   │   │   └── syncApi.ts             # REST API client (auth + sync)
│   │   ├── types/
│   │   │   └── shared.ts              # Local copy of domain + API types
│   │   ├── i18n/index.ts              # i18next configuration
│   │   └── locales/
│   │       ├── en.json                # English strings
│   │       └── pt.json                # Portuguese (BR) strings
│   ├── assets/                        # Images, fonts, icons
│   ├── android/                       # Native Android project
│   ├── app.json                       # Expo config (plugins, scheme, icons)
│   ├── eas.json                       # EAS Build configuration
│   ├── tsconfig.json                  # TS config: @/* → ./src/*
│   └── package.json
│
├── server/                            # Express sync-relay backend
│   ├── index.ts                       # Entry point
│   ├── shared.ts                      # Inlined domain + API types
│   ├── db/                            # DB pool + schema
│   ├── middleware/                    # Auth middleware
│   ├── routes/                        # Express route handlers
│   ├── services/
│   │   ├── authService.ts             # JWT auth, invite codes, pairing
│   │   └── syncService.ts             # Push/pull event sync
│   ├── tsconfig.json
│   └── package.json
│
├── render.yaml                        # Render Blueprint for backend deployment
├── package.json                       # Root: convenience scripts only (no workspaces)
└── README.md
```


---

## Database Schema (local SQLite)

File: `mobile/src/db/schema.ts`

WAL mode and foreign keys are enabled on every open. The base tables are created with `CREATE TABLE IF NOT EXISTS`. New columns are added via safe migrations (ALTER TABLE wrapped in try/catch — idempotent).

```sql
-- Base tables (created on first launch)

CREATE TABLE contacts (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  nickname        TEXT,
  avatar_emoji    TEXT DEFAULT '👤',
  color           TEXT DEFAULT '#E85D75',
  is_partner      INTEGER DEFAULT 0,
  partner_user_id TEXT,         -- reserved for future partner sync
  created_at      INTEGER NOT NULL
);

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  contact_id  TEXT REFERENCES contacts(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- EventTypeKey (INTIMACY|FIGHT|AFFECTION|DATE|SPECIAL|MILESTONE|CUSTOM)
  title       TEXT,
  note        TEXT,
  intensity   INTEGER DEFAULT 0,  -- 0–5
  mood_tag    TEXT,               -- emoji (🥰 😄 😔 😤 😌 🔥 😢 😎)
  occurred_at INTEGER NOT NULL,   -- Unix ms
  logged_at   INTEGER NOT NULL,
  synced      INTEGER DEFAULT 0,  -- 0 = local only, 1 = synced
  server_id   TEXT
);

CREATE TABLE pitches (            -- reserved, not yet used in UI
  id              TEXT PRIMARY KEY,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  from_partner_id TEXT,
  message         TEXT,
  emoji           TEXT,
  received_at     INTEGER NOT NULL,
  read_at         INTEGER
);

-- Indexes
CREATE INDEX idx_events_contact  ON events(contact_id);
CREATE INDEX idx_events_occurred ON events(occurred_at);
CREATE INDEX idx_events_type     ON events(type);

-- Migrations (applied idempotently via try/catch)
ALTER TABLE events ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0;
  -- 1 = private (never synced to partner), 0 = shared
```


---

## Shared Types

Both `mobile/src/types/shared.ts` and `server/shared.ts` contain identical type definitions:

```typescript
type EventTypeKey = 'INTIMACY' | 'FIGHT' | 'AFFECTION' | 'DATE' | 'SPECIAL' | 'MILESTONE' | 'CUSTOM'

interface LoveEvent {
  id: string
  contact_id: string
  type: EventTypeKey
  title?: string
  note?: string
  intensity: number        // 0–5
  mood_tag?: string        // emoji
  occurred_at: number      // Unix ms
  logged_at: number
  synced: number
  server_id?: string
  is_private: number       // 0 | 1
}

interface Contact {
  id: string
  name: string
  nickname?: string
  avatar_emoji: string
  color: string
  is_partner: number
  partner_user_id?: string
  created_at: number
}

// + Auth, Pairing, Sync API contract types (see the files for full list)
```

---

## State Management

Both stores live in `mobile/src/store/`. They talk directly to the SQLite layer in `mobile/src/db/`.

| Store | State | Key actions |
|---|---|---|
| `useEventsStore` | `events: LoveEvent[]` | `loadEvents`, `logEvent`, `editEvent`, `removeEvent`, `togglePrivate`, `syncEvent` |
| `useContactsStore` | `contacts: Contact[]`, `activeContactId` | `loadContacts`, `addContact`, `editContact`, `removeContact`, `setActiveContact` |
| `useSyncStore` | `userId`, `partnerId`, `lastSyncedAt` | `init`, `register`, `login`, `logout`, `generateInvite`, `pairWithCode`, `sync` |

`ThemeContext` provides the active theme and `setTheme()`. Theme key is persisted to MMKV.

Active contact ID is persisted to MMKV. Events are scoped to the active contact.

---

## Navigation & Screens

### Tab routes (`src/app/(tabs)/`)
| Route | Screen | Purpose |
|---|---|---|
| `/` | Home | Quick-log grid (tap = instant, long press = full form) + recent 5 events |
| `/calendar` | Calendar | Monthly view with colored event dots; tap day → day modal |
| `/timeline` | Timeline | All events chronologically; tap = edit, long press = delete |
| `/stats` | Stats | Event counts by type, days-since-last per type |
| `/settings` | Settings | Theme picker, privacy lock, language, partner sync |

### Modal routes (`src/app/modal/`)
| Route | Purpose |
|---|---|
| `/modal/log-event?type=X&contactId=Y` | Full event creation form |
| `/modal/event-detail?id=X` | View, edit, delete a specific event |
| `/modal/add-contact` | Create a new contact |

### Lock screen
Rendered inside `src/app/_layout.tsx` as an overlay when the app returns from background
after the configured timeout (0 = immediate, 1/5/15 min). Shows 4-digit PIN keypad
and optional biometric button.

---

## Event Types & Mood Tags

**Event types** (`constants/eventTypes.ts`):

| Key | Icon | Color |
|---|---|---|
| INTIMACY | 🔥 | #E85D75 |
| FIGHT | ⚡ | #F4A261 |
| AFFECTION | ❤️ | #FF6B6B |
| DATE | 🌙 | #A78BFA |
| SPECIAL | ⭐ | #FFD166 |
| MILESTONE | 💋 | #E63946 |
| CUSTOM | ✏️ | #4ECDC4 |

**Mood tags:** 🥰 In Love · 😄 Happy · 😔 Sad · 😤 Frustrated · 😌 Peaceful · 🔥 Passionate · 😢 Hurt · 😎 Confident

---

## Themes (6 available)

Defined in `constants/themes.ts`, persisted via MMKV:

| Key | Name | Primary |
|---|---|---|
| `romantic` | Romantic 🌹 | #E85D75 |
| `darkEmber` | Dark Ember 🔥 | #F4A261 |
| `ocean` | Ocean 🌊 | #4ECDC4 |
| `forest` | Forest 🌿 | #74B49B |
| `midnight` | Midnight 🌙 | #A855F7 |
| `minimal` | Minimal ⬛ | #64748B |

Each theme exposes: `primary`, `primaryLight`, `primaryDark`, `accent`, `background`,
`surface`, `surfaceAlt`, `border`, `text`, `textSecondary`, `textMuted`, `success`,
`warning`, `error`, `tabBar`, `tabBarActive`, `tabBarInactive`.

---

## i18n

Config: `src/i18n/index.ts` · Namespaces: `en.json` / `pt.json`

Key namespaces: `common`, `tabs`, `events`, `moods`, `home`, `contacts`, `calendar`,
`timeline`, `stats`, `settings`, `privacy`, `onboarding`.

Locale is detected from the device via `expo-localization` and can be overridden in Settings.
Override is persisted in MMKV.

---

## Server (Real Sync Relay)

`server/` is a Node.js/Express application that acts as a sync relay between partners.

### Architecture
- **Framework**: Express with TypeScript
- **Database**: PostgreSQL (hosted on Supabase)
- **Auth**: JWT-based (Access token in memory, Refresh token in DB)
- **Security**: Password hashing with `bcryptjs`, protected routes via `auth` middleware
- **Sync**: Push/Pull architecture using `client_id` and `deleted_at` (soft-delete)

### Endpoints
- `POST /auth/register` — Create account
- `POST /auth/login` — Get JWT tokens
- `POST /auth/invite` — Generate 8-char pairing code
- `POST /auth/pair` — Pair with a partner using a code
- `POST /sync/push` — Upload local changes
- `GET /sync/pull?lastPulledAt=...` — Download partner changes

---

## Implementation Status

### Done
- Local SQLite database (contacts + events CRUD)
- All 5 main tab screens
- All 3 modal screens (log, detail/edit, add-contact)
- Quick-log from home (tap = instant, long press = detailed form)
- Event editing & deletion
- Private event toggle (is_private flag, 🔒 badge in UI)
- Biometric + 4-digit PIN lock with configurable timeout
- Theme switching (6 themes)
- i18n: English + Portuguese
- Calendar view with multi-type dot markers
- Stats: count by type, days since last event
- MMKV persistence for preferences and active contact
- Express backend with PostgreSQL, JWT Auth, and Partner Sync API
- Partner pairing via invite codes
- Real-time / periodic sync between devices
- **Monorepo abandoned** — flat structure (`mobile/`, `server/`), no Turborepo, no npm workspaces
- Shared types inlined per-app (`mobile/src/types/shared.ts`, `server/shared.ts`)

### In Progress / Partial
- photo attachments on events
- push notifications (package installed, not configured)

### Not Yet Started
- Export / import data
- Streak calculation (UI has "Best Streak" placeholder)

---

## Dev Commands

```bash
# From repo root (convenience scripts)
npm run mobile    # expo start (inside mobile/)
npm run server    # npm run start (inside server/)
npm run android   # expo run:android (inside mobile/)
npm run ios       # expo run:ios (inside mobile/)

# Inside mobile/
cd mobile
npm run start           # Expo dev server
npm run android         # Run on Android emulator/device
npm run ios             # Run on iOS simulator/device
npm run build:preview   # EAS build (Android APK for testers)
npm run build:production # EAS build (Android AAB for Play Store)

# Inside server/
cd server
npm run dev    # ts-node-dev (hot reload)
npm run start  # Compiled JS
npm run build  # tsc compile
```

---

## Deployment

### Backend (Render + Supabase)

1.  **Database**: Ensure your Supabase tables are created using `server/db/schema.sql`.
2.  **Render**: 
    - Create a new **Blueprint** on Render pointing to this repository.
    - It will detect `render.yaml` and create the `love-tracker-server` service.
    - Set the `DATABASE_URL` environment variable in the Render dashboard (using your Supabase URI).
    - The `JWT_SECRET` will be generated automatically, but you can override it.

### Mobile (Google Play Store)

1.  **Update URL**: The production backend URL is set in `mobile/app.json` (`extra.apiUrl`).
2.  **EAS Build**:
    - Log in: `npx eas login` (inside `mobile/`)
    - Build APK for testers: `npm run build:preview` (inside `mobile/`)
    - Build AAB for Play Store: `npm run build:production` (inside `mobile/`)

---

## Architecture Principles (follow these when making changes)

1. **Offline-first.** All reads/writes go to SQLite first. Server sync is additive.
2. **DB layer is separate from state.** `db/` files hold SQL, `store/` holds Zustand.
   Never call SQLite directly from a component — always go through the store or a db helper.
3. **Shared types live per-app.** `mobile/src/types/shared.ts` and `server/shared.ts` are
   kept in sync manually. Do not import across app boundaries.
4. **Theme colors must come from `ThemeContext`.** Never hardcode hex colors in screens or
   components — use `theme.colors.primary`, `theme.colors.surface`, etc.
5. **All user-facing strings must go through i18next** (`t('key')`). Add keys to both
   `en.json` and `pt.json` when introducing new UI text.
6. **Privacy respect.** When querying events for partner-visible features, use the
   `is_private = 0` filter helpers (`getPublicEventsForMonth`, etc.).
7. **MMKV for preferences, Secure Store for secrets.** PIN hash goes in Secure Store,
   theme and language preferences go in MMKV.
8. **Keep the server thin.** The server is a sync relay, not the source of truth.
   The device database is the source of truth.
9. **No workspaces or Turborepo.** Each app is independent. Run commands inside
   `mobile/` or `server/` directly, or use root-level convenience scripts.
