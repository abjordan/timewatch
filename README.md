# TimeWatch

A minimal, offline time tracking webapp for allocating hours across clients and tasks. Runs entirely in the browser as a single HTML file — no build tools, frameworks, or dependencies.

## Features

- **Toggle timer** — Click a task to start, click again to stop, click another to switch
- **Task management** — Add, rename (double-click), and remove tasks
- **Daily tracking** — Each day starts fresh; browse history with date navigation
- **Live display** — Running timer shows elapsed HH:MM:SS and decimal hours
- **Auto-recovery** — Timer state persists in localStorage; survives browser crashes and restarts
- **Export** — Download the day's entries as CSV or copy a text summary to clipboard
- **Dark theme** — Minimal dark UI with subtle color accents
- **Fully offline** — All data stays in localStorage, no server required

## Usage

Open `index.html` in any modern browser. That's it.

### Tracking Time

1. Click **+ Add Task** or the **+** button to create tasks
2. Click a task button to start the timer
3. Click it again to stop, or click a different task to switch
4. View totals in the Time Summary table (hover hours for exact HH:MM:SS)

### Managing Tasks

- **Rename** — Double-click a task button
- **Remove** — Click the **x** that appears on hover (historical entries are preserved)

### Navigating Dates

Use the **left/right arrows** to browse past days. Click **Today** to jump back.

### Exporting Data

- **Export CSV** — Downloads a CSV file with Date, Task, Start, End, and Hours columns
- **Copy Summary** — Copies a plain text tally to the clipboard

## Data Storage

All data is stored in the browser's localStorage under three keys:

| Key | Description |
|---|---|
| `timewatch_tasks` | Master list of tasks/clients |
| `timewatch_entries` | Completed time entries with start/end timestamps |
| `timewatch_activeTimer` | Currently running timer (for crash recovery) |

To reset all data, clear these keys from localStorage or use your browser's dev tools.

## License

[MIT](LICENSE)
