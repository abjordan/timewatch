# TimeWatch Improvement Plan

## Overview

Incremental improvements to TimeWatch, a zero-dependency browser-based time tracker.
Each stage is self-contained and ships working code. Tackle in order; revisit as needed.

---

## Stage 1: UI Redesign
**Goal**: Replace the generic dark UI with a distinctive, polished design using the `frontend-design` skill.
**Files**: `index.html`, `styles.css`
**Success Criteria**:
- Visually distinctive — doesn't look like a default dark theme
- Better typography hierarchy (app name, timer display, task grid, summary)
- Micro-animations on task activation and timer updates
- Retains full functional parity with current UI
- Still works at 640px max-width on mobile
**Notes**: No new HTML structure changes needed yet — those come in Stage 2
**Status**: Complete

---

## Stage 2: Custom Modals (Replace `prompt` / `confirm`)
**Goal**: Replace all three browser dialog calls with custom inline modals.
**Files**: `index.html`, `styles.css`, `js/app.js`
**Affects**:
- `promptAddTask()` — uses `prompt("Task name:")`
- `promptRenameTask()` — uses `prompt("Rename task:", task.name)`
- `confirmRemoveTask()` — uses `confirm('Remove task "..."?')`
**Success Criteria**:
- All three interactions use styled, non-blocking in-page modals
- Keyboard support: Enter to confirm, Escape to cancel
- Focus is trapped inside modal while open
- Accessible: `role="dialog"`, `aria-modal`, focus management
**Status**: Complete

---

## Stage 3: Test Harness for Logic Functions
**Goal**: Add a simple, zero-dependency test runner covering all pure logic functions.
**Files**: `js/tests.js` (new), optionally `tests.html` (new)
**Functions to cover**:
- `formatHMS()` — seconds to HH:MM:SS
- `shiftDate()` — date arithmetic
- `formatDateDisplay()` — date formatting
- `entryHours()` — ms difference to decimal hours
- `getEntriesForRange()` — date range filtering
- `exportCSVRange()` — CSV output format
- `setCSVPreset()` — date preset logic
**Success Criteria**:
- Tests run in the browser (open `tests.html`) or via Node.js
- All pure functions covered with at least 2 cases each
- Edge cases: midnight boundaries, same-day ranges, zero-duration entries
**Status**: Complete — `tests.html` covers 7 suites, 40 test cases

---

## Stage 4: Input Validation
**Goal**: Guard against bad input at all entry points.
**Files**: `js/app.js`
**What to add**:
- Task name: max 60 chars, reject blank/whitespace-only, trim on save
- Duplicate task name warning (not hard block — same name may be intentional)
- `recordEntry()`: validate start < end, both are valid ISO strings
- `addTask()` / `renameTask()`: return false on invalid, surface error in UI
**Status**: Complete — `validateTaskName()` helper, `addTask`/`renameTask` validate + soft-warn on duplicate, `recordEntry` validates start < end

---

## Stage 5: Entry Editing
**Goal**: Allow correction of past time entries without editing raw JSON.
**Files**: `index.html`, `styles.css`, `js/app.js`
**Approach**:
- Add an edit icon (pencil) on each row of the tally table
- Opens a modal with: task selector (dropdown), start time, end time, date
- On save: validates start < end, updates entry in localStorage, re-renders
- On delete: removes entry with confirmation, re-renders
**Success Criteria**:
- Can fix a start/end time on a past entry
- Can reassign an entry to a different task
- Can delete a single entry without deleting the whole task
**Status**: Complete — per-entry tally rows with edit buttons, edit-entry modal with task/date/time fields, `updateEntry`/`deleteEntry` data functions, delete-with-confirmation flow

---

## Stage 6: Undo (Last Action)
**Goal**: Single-level undo for destructive actions.
**Files**: `js/app.js`, minor CSS
**Actions to make undoable**:
- Remove task (+ stop timer if active)
- Stop timer (accidental stop)
- Restore from backup (already auto-backups, but surface undo in UI)
**Approach**: Store a single `undoStack` entry in memory (not localStorage). Show "Undo" in toast for 5 seconds after each undoable action.
**Status**: Not Started

---

## Stage 7: Accessibility Pass
**Goal**: Make the app usable with keyboard and screen readers.
**Files**: `index.html`, `styles.css`, `js/app.js`
**What to fix**:
- ARIA labels on all icon-only buttons (×, +, ←, →)
- `role="grid"` and `aria-pressed` on task buttons (toggle state)
- Keyboard navigation between task buttons (arrow keys)
- Focus outline visible in all themes
**Status**: Complete — ARIA labels on task-remove/add buttons, `role="gridcell"` + `aria-pressed` on task buttons, roving tabindex with arrow-key nav, `:focus-visible` outline uses `var(--accent)` across all themes

---

## Stage 8: Weekly / Monthly Summary View
**Goal**: Add aggregated summary beyond the single-day view.
**Files**: `index.html`, `styles.css`, `js/app.js`
**Approach**:
- Toggle between "Day", "Week", "Month" views in the tally section
- Week: Mon–Sun spanning the selected date, grouped by task with daily breakdown
- Month: current calendar month, same grouping
**Success Criteria**:
- Summary table updates when switching view mode
- CSV export respects current view's date range automatically
**Status**: Not Started

---

## Stage 9: Timezone & Date Robustness
**Goal**: Eliminate the `T12:00:00` workaround and string-slice date math.
**Files**: `js/app.js`
**What to change**:
- Replace all `dateStr + "T12:00:00"` with a proper local-date parser
- Use `Intl.DateTimeFormat` for consistent local date formatting
- Add a helper `localDateStr(date)` that always returns YYYY-MM-DD in local time
- Fix `todayStr()` which uses `toISOString()` (UTC) instead of local time
**Status**: Complete — `localDateStr(date)` + `parseLocalDate(str)` helpers added; `todayStr`, `shiftDate`, `formatDateDisplay`, `recordEntry`, `renderTally`, `copySummary`, `setCSVPreset` all updated

---

## Stage 10: Multi-Tab Safety
**Goal**: Prevent data corruption when the app is open in multiple tabs.
**Files**: `js/app.js`
**Approach**:
- Listen for `storage` events (fires when another tab writes localStorage)
- Re-render and reconcile active timer state on storage change
- Show a toast if a conflicting active timer is detected
**Status**: Complete — `window.addEventListener("storage", ...)` re-renders and shows toasts for timer changes in other tabs

---

## Stage 11: Color Themes
**Goal**: Let users choose from a curated set of color themes, persisted across sessions.
**Files**: `index.html`, `styles.css`, `js/app.js`
**Approach**:
- Define 4–6 themes as named sets of CSS custom property overrides (e.g. `data-theme="amber"` on `<html>`)
- Themes to include: current Amber (default), Ocean (blue-teal), Forest (green), Dusk (purple), Monochrome (grey), and a high-contrast option
- Add a small theme picker to the header — icon-only swatches, no labels needed
- Store chosen theme in localStorage under `timewatch_theme`, apply on page load before first render to avoid flash
- No new dependencies; pure CSS variable swap
**Success Criteria**:
- Switching themes is instant with no page reload
- Choice persists across sessions and page refreshes
- All UI elements (timer, task buttons, tally, modals, toasts) respond correctly to each theme
- Picker itself is visually unobtrusive — doesn't compete with the date nav
**Status**: Complete — 5 themes (Amber, Ocean, Forest, Dusk, Mono), swatch picker in header, flash-free init

---

## Backlog (Deferred)

- **Import from other tools** — CSV import for migration from Toggl, Harvest, etc.
- **Task archiving** — Hide tasks without deleting their history
- **Idle detection** — Auto-pause when system is idle (Page Visibility API)
- **Light mode toggle** — CSS variable swap, store preference in localStorage (superseded by Stage 11)
- **PWA / offline install** — Service worker + manifest for installable app
