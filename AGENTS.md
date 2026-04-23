# AI Assistant Guidelines — Love Tracker

These rules apply to **every AI assistant** (Claude, Gemini, Antigravity, Copilot, Cursor, etc.)
working on this codebase. Follow them strictly on every session.

---

## Mandatory Workflow

### 1. Always read `README.md` before any implementation
Before writing a single line of code or proposing any change, open and read
`README.md` at the repo root. It is the single source of truth for:
- Project architecture and tech stack
- Database schema and migration history
- File structure (where things live)
- State management patterns
- Implementation status (what is done, in progress, or not started)
- Architecture principles to follow

Do not make assumptions about the codebase. Read the README first, every time.

### 2. Update `README.md` after every successfully implemented plan
Once a feature or fix has been fully implemented and verified, update `README.md`
to reflect the new state. Specifically:

- Add new files to the **File Structure** section
- Update the **Implementation Status** section (move items from "Not Yet Started"
  or "In Progress" to "Done")
- Update the **Database Schema** section if any migrations were added
- Update the **Tech Stack** tables if new libraries were installed
- Update the **Dev Commands** section if new scripts were added
- Update or add to **Architecture Principles** if a new pattern was established

The README must always reflect the *current* state of the project, not a past snapshot.

---

## Planning Rules

- **Plan before coding.** For any non-trivial change, write out the proposed approach
  and confirm it with the user before implementing.
- **Check implementation status first.** If the README says a feature is "In Progress"
  or "Not Yet Started", do not assume how it should be built — ask or investigate.
- **Do not duplicate types.** Shared types belong in `packages/shared/index.ts`.
  Never redefine `LoveEvent`, `Contact`, or `EventTypeKey` inside `apps/`.

---

## Code Style Rules

- **No hardcoded colors.** All colors must come from `ThemeContext` (`theme.primary`,
  `theme.surface`, etc.). Never use raw hex values in screens or components.
- **No hardcoded strings.** All user-visible text must use `i18next` (`t('key')`).
  Add the key to both `en.json` and `pt.json` when introducing new UI text.
- **DB access through the store or db helpers.** Never call SQLite directly from a
  component. Use `useEventsStore`, `useContactsStore`, or a `db/` helper function.
- **Privacy filter on partner-visible queries.** Any query that feeds partner-sync
  or shared features must filter `is_private = 0`.
- **MMKV for preferences, Secure Store for secrets.**

---

## TypeScript / Monorepo Rules

- `packages/shared` is a **composite TypeScript project** (project references).
  After modifying it, run `npx tsc --build` inside `packages/shared/`.
- Consumers import `@love/shared` — never import from a relative path crossing
  package boundaries (e.g., `../../packages/shared/index.ts`).
- Each app's `tsconfig.json` must declare a `"references"` entry pointing to
  `packages/shared` if it imports from `@love/shared`.

---

## Verification Checklist (before declaring work done)

- [ ] `README.md` has been updated to reflect all changes
- [ ] No TypeScript errors (`npx tsc --noEmit` passes in the changed package)
- [ ] New UI strings added to both `en.json` and `pt.json`
- [ ] No raw hex colors introduced in screens or components
- [ ] DB migrations are wrapped in try/catch (idempotent)
- [ ] If `packages/shared` was changed, `npx tsc --build` was run inside it
