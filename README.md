# Love Tracker

> A privacy-first, offline-first relationship journal built with React Native + Expo.
> Log your moments. Keep what's yours private. Share what matters with your partner.



## Project Overview

**Love Tracker** is an offline-first React Native relationship journal. It lets users log
and track relevant checkpoints of their relationship (intimate moments, conflicts, dates,
milestones, etc.) with privacy controls and groundwork for a future partner-sync feature.

**Monorepo managed with Turborepo + npm workspaces.**

---

## Tech Stack

### Mobile (`apps/mobile`)
| Concern | Library | Version |
|---|---|---|
| Framework | React Native + Expo | RN 0.81.5 / Expo ~54 |
| Language | TypeScript | ~5.9.2 |
| Routing | Expo Router (file-based) | ~6.0.23 |
| State | Zustand | 5.0.12 |
| Local DB | Expo SQLite | 16.0.10 |
| Persistent KV | MMKV | 4.3.1 |
| Secure storage | Expo Secure Store | 15.0.8 |
| Biometrics | Expo Local Authentication | 17.0.8 |
| i18n | i18next + react-i18next | 26.0.4 / 17.0.2 |
| Date utils | date-fns | 4.1.0 |
| ID generation | uuid | 13.0.0 |
| Charts | Victory Native | 36.9.2 |
| Calendar | react-native-calendars | 1.1314.0 |
| Animations | React Native Reanimated | 4.1.1 |
| Haptics | Expo Haptics | 15.0.8 |
| Typography | @expo-google-fonts/inter | 0.4.2 |
| Navigation | @react-navigation/native | 7.1.8 |
| Push notifications | expo-notifications | 0.32.16 *(installed, not yet configured)* |
| Async storage | @react-native-async-storage/async-storage | 2.2.0 |

### Server (`apps/server`)
| Concern | Library | Version |
|---|---|---|
| Framework | Express | 4.18.2 |
| Language | TypeScript | 5.0.0 |
| Dev runner | ts-node-dev | 2.0.0 |

### Shared (`packages/shared`)
TypeScript-only types consumed by both mobile and server. No runtime dependencies.

---

## File Structure

```
love-tracker/
├── apps/
│   ├── mobile/
│   │   ├── app/                       # Expo Router screens
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx          # Home: quick-log grid + recent events
│   │   │   │   ├── calendar.tsx       # Monthly calendar with event dots
│   │   │   │   ├── timeline.tsx       # Chronological event list
│   │   │   │   ├── stats.tsx          # Analytics dashboard
│   │   │   │   ├── settings.tsx       # Theme, privacy, language, partner sync
│   │   │   │   ├── two.tsx            # Placeholder tab (unused)
│   │   │   │   └── _layout.tsx        # Tab bar setup
│   │   │   ├── modal/
│   │   │   │   ├── log-event.tsx      # Create event (full form)
│   │   │   │   ├── event-detail.tsx   # View / edit / delete event
│   │   │   │   └── add-contact.tsx    # Create contact
│   │   │   ├── _layout.tsx            # Root layout: init, lock screen, theme
│   │   │   ├── modal.tsx              # Generic modal shell (Expo Router)
│   │   │   ├── +html.tsx              # HTML shell for web target
│   │   │   └── +not-found.tsx
│   │   ├── components/
│   │   │   ├── LockScreen.tsx         # 4-digit PIN keypad
│   │   │   ├── Themed.tsx             # Theme-aware View/Text wrappers
│   │   │   ├── StyledText.tsx         # Typed text components
│   │   │   ├── EditScreenInfo.tsx     # Expo default (unused)
│   │   │   ├── ExternalLink.tsx       # Expo default (unused)
│   │   │   ├── useClientOnlyValue.ts  # SSR helper
│   │   │   ├── useColorScheme.ts      # Dark/light mode helper
│   │   │   └── __tests__/             # Component tests
│   │   ├── db/
│   │   │   ├── schema.ts              # DB init, table creation, migrations
│   │   │   ├── events.ts              # Event CRUD helpers
│   │   │   └── contacts.ts            # Contact CRUD helpers
│   │   ├── store/
│   │   │   ├── useEventsStore.ts      # Zustand: events state + actions
│   │   │   └── useContactsStore.ts    # Zustand: contacts state + actions
│   │   ├── hooks/
│   │   │   └── usePrivacyLock.ts      # Biometric + PIN lock logic
│   │   ├── context/
│   │   │   └── ThemeContext.tsx       # 6 themes, persisted in MMKV
│   │   ├── constants/
│   │   │   ├── eventTypes.ts          # 7 event types, 8 mood tags, colors
│   │   │   └── themes.ts              # Full color palettes for 6 themes
│   │   ├── i18n/index.ts              # i18next configuration
│   │   ├── locales/
│   │   │   ├── en.json                # English strings
│   │   │   └── pt.json                # Portuguese (BR) strings
│   │   ├── assets/                    # Images, fonts, icons
│   │   └── android/                   # Native Android project
│   │
│   └── server/
│       ├── index.ts                   # Stub Express server (see status below)
│       ├── tsconfig.json              # TS config with project reference → shared
│       └── package.json
│
├── packages/
│   └── shared/
│       ├── index.ts                   # Shared TS types: LoveEvent, Contact, EventTypeKey
│       ├── tsconfig.json              # Composite build config
│       ├── dist/                      # Compiled output (generated, not committed)
│       └── package.json
│
├── turbo.json
├── tsconfig.json                      # Root TS config: paths alias @love/shared
├── package.json                       # Workspaces: apps/*, packages/*
└── CLAUDE.md                          # ← this file / project README
```


---

## Database Schema (local SQLite)

File: `apps/mobile/db/schema.ts`

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

## Shared Types (`packages/shared/index.ts`)

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
```

---

## State Management

Both stores live in `apps/mobile/store/`. They talk directly to the SQLite layer in `apps/mobile/db/`.

| Store | State | Key actions |
|---|---|---|
| `useEventsStore` | `events: LoveEvent[]` | `loadEvents`, `logEvent`, `editEvent`, `removeEvent`, `togglePrivate` |
| `useContactsStore` | `contacts: Contact[]`, `activeContactId` | `loadContacts`, `addContact`, `editContact`, `removeContact`, `setActiveContact` |

`ThemeContext` provides the active theme and `setTheme()`. Theme key is persisted to MMKV.

Active contact ID is persisted to MMKV. Events are scoped to the active contact.

---

## Navigation & Screens

### Tab routes (`app/(tabs)/`)
| Route | Screen | Purpose |
|---|---|---|
| `/` | Home | Quick-log grid (tap = instant, long press = full form) + recent 5 events |
| `/calendar` | Calendar | Monthly view with colored event dots; tap day → day modal |
| `/timeline` | Timeline | All events chronologically; tap = edit, long press = delete |
| `/stats` | Stats | Event counts by type, days-since-last per type |
| `/settings` | Settings | Theme picker, privacy lock, language, partner sync (coming soon) |

### Modal routes (`app/modal/`)
| Route | Purpose |
|---|---|
| `/modal/log-event?type=X&contactId=Y` | Full event creation form |
| `/modal/event-detail?id=X` | View, edit, delete a specific event |
| `/modal/add-contact` | Create a new contact |

### Lock screen
Rendered inside `app/_layout.tsx` as an overlay when the app returns from background
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

Config: `i18n/index.ts` · Namespaces: `en.json` / `pt.json`

Key namespaces: `common`, `tabs`, `events`, `moods`, `home`, `contacts`, `calendar`,
`timeline`, `stats`, `settings`, `privacy`, `onboarding`.

Locale is detected from the device via `expo-localization` and can be overridden in Settings.
Override is persisted in MMKV.

---

## Server (Real Sync Relay)

`apps/server` is a Node.js/Express application that acts as a sync relay between partners.

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
- Monorepo setup with Turborepo
- Express backend with PostgreSQL, JWT Auth, and Partner Sync API
- Partner pairing via invite codes
- Real-time / periodic sync between devices

### In Progress / Partial
- photo attachments on events
- push notifications (package installed, not configured)

### Not Yet Started
- Export / import data
- Streak calculation (UI has "Best Streak" placeholder)

---

## Dev Commands

```bash
# From repo root
npm run dev       # Start Expo + server in parallel (Turborepo)
npm run mobile    # Expo dev server only (expo start)
npm run server    # Express server only
npm run android   # Run on Android emulator/device
npm run ios       # Run on iOS simulator/device
npm run build     # Build all packages
npm run lint      # Lint all packages

# Shared package (TypeScript project reference — run after changing packages/shared)
cd packages/shared && npx tsc --build
```

---

## Architecture Principles (follow these when making changes)

1. **Offline-first.** All reads/writes go to SQLite first. Server sync is additive.
2. **DB layer is separate from state.** `db/` files hold SQL, `store/` holds Zustand.
   Never call SQLite directly from a component — always go through the store or a db helper.
3. **Shared types live in `packages/shared`.** If a type is used by both mobile and server,
   it belongs there. Do not duplicate types.
4. **Theme colors must come from `ThemeContext`.** Never hardcode hex colors in screens or
   components — use `theme.primary`, `theme.surface`, etc.
5. **All user-facing strings must go through i18next** (`t('key')`). Add keys to both
   `en.json` and `pt.json` when introducing new UI text.
6. **Privacy respect.** When querying events for partner-visible features, use the
   `is_private = 0` filter helpers (`getPublicEventsForMonth`, etc.).
7. **MMKV for preferences, Secure Store for secrets.** PIN hash goes in Secure Store,
   theme and language preferences go in MMKV.
8. **Keep the server thin.** The server is a sync relay, not the source of truth.
   The device database is the source of truth.
9. **TypeScript project references for cross-package imports.** `packages/shared` is a
   composite TypeScript project. Consumers (server, mobile) reference it via `"references"`
   in their `tsconfig.json` and import from its compiled `dist/` output — never from
   `.ts` source directly. After changing `packages/shared`, run `npx tsc --build` inside it.
