# tempo. : keep pace with your day.

An intent first calendar built to make planning feel faster, clearer, and more natural.

[**View the live application →**](https://calendar.ems.lol)

**In active development.** The full-stack calendar foundation is live. Upcoming work includes:

- richer AI-assisted natural language scheduling
- recurrence
- travel intelligence
- planning assistance

## Overview

Tempo is a full-stack calendar application exploring a simple product question:

> What if creating an event started with what you meant, instead of a form you had to fill out?

The current release combines a responsive React calendar with a custom event editor, deterministic natural language interpretation, user accounts, and personal event storage. It is the foundation for a larger system that turns scheduling intent into structured, reviewable events while keeping the result visible and editable.

## Preview

<img width="4374" height="2630" alt="sc1" src="https://github.com/user-attachments/assets/9cabc65a-1b63-4aaa-a056-ea6bc61e858a" />
<img width="4374" height="2630" alt="sc2" src="https://github.com/user-attachments/assets/231f2651-3cdc-4142-9075-041a2bdd2fd1" />
<img width="4375" height="2632" alt="sc3" src="https://github.com/user-attachments/assets/22c470e2-d011-4d6d-8088-4d551c0c4cee" />

## What works today

- Day, week, continuously scrollable month, and year views built on FullCalendar.
- Click or drag to create timed, all-day, single-day, and multi-day events, then edit their time, location, guests, and description.
- Natural language title parsing for individual times and time ranges in 12- or 24-hour formats, including `noon` and `midnight`.
- Date-range parsing for expressions such as `Aug 25 to Aug 28, with flexibility in formats (spaces, au vs aug vs August)
- Username-based sign-up, sign-in, persistent sessions, sign-out, and account controls.
- Personal calendars: authenticated events are stored in MongoDB and scoped to the current account; signed-out users keep their own events locally in the browser.
- Create, load, update, delete, and restore events, with a five-second Undo action after deletion.
- A dedicated mobile layout with a compact view selector, bottom navigation, a responsive event editor, and an expandable scheduling sidebar.
- Keyboard workflows, including `N` for a new event, `Escape` to close the active surface, and `Backspace`/`Delete` on macOS to delete an open event.

## Engineering highlights

### Editable natural language interpretation

Title interpretation is deterministic and runs before an event is saved. It recognizes dates and times embedded in the title, supports single values and ranges, normalizes 12- and 24-hour input, and populates editable fields in the event editor. Malformed time ranges are rejected instead of being partially interpreted.

### Account-scoped persistence

Better Auth provides username authentication and cookie-backed sessions. The backend derives event ownership from the active session and includes the user ID in database reads, updates, and deletes, keeping account calendars isolated. Routing, application rules, and MongoDB operations remain separated behind the event API, which routes signed-out users to browser storage so the core create, edit, delete, and Undo workflows still work without an account.

### Date, time, and range correctness

Times are represented internally as minutes after midnight and converted at the API boundary. The application validates positive event durations, handles date and time ranges that cross day or year boundaries, and translates between inclusive dates in the editor and FullCalendar's exclusive all-day end dates. `Temporal` is used for date arithmetic rather than manual string manipulation.

### Continuous & responsive calendar UI

The interface extends FullCalendar with a recentering continuous-month view that preserves the visible date while its window shifts. Desktop controls collapse into a compact mobile view selector, the sidebar becomes an expandable bottom section or icon bar, and the event editor is resized and repositioned for phone screens.

## Repo layout

```text
.
├── react18/
│   └── src/
│       ├── Calendarapp.tsx         # Calendar views, continuous scrolling, and app state
│       ├── EventDetails.tsx        # Event editor, sidebar, and form behavior
│       ├── components/             # Auth, account, and reusable interface controls
│       ├── api/
│       │   ├── auth-client.ts      # Better Auth browser client
│       │   └── eventsAPI.ts        # Account API and signed-out local persistence gateway
│       ├── utils/                  # Deterministic title, date, time, and location parsing
│       ├── data/defaultEvents.json # Initial signed-out calendar data
│       ├── index.css              # Calendar and responsive layout styles
│       └── auth-user.css          # Authentication and account styles
├── backend/
│   └── src/
│       ├── auth.ts                 # Better Auth server and MongoDB adapter
│       ├── middleware/             # Session-to-calendar ownership boundary
│       ├── routes/                 # REST API paths
│       ├── controllers/            # HTTP request and response translation
│       ├── services/               # Calendar application workflows
│       ├── repositories/           # Account-scoped MongoDB operations
│       ├── domain/                 # Calendar event types
│       └── config/                 # Environment and database setup
└── .github/workflows/deploy.yml    # Frontend deployment workflow
```

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 6 |
| Calendar UI | FullCalendar 7 with a custom continuous-month view |
| Natural-language parsing | Deterministic TypeScript parsing for dates, locations, and 12/24-hour time values and ranges |
| Date handling | Temporal polyfill and minutes-after-midnight time representation |
| Authentication | Better Auth with username login and cookie-backed sessions |
| Backend API | Node.js, Express 5, TypeScript, REST |
| Persistence | MongoDB for account calendars; `localStorage` for signed-out calendars |
| Styling | Handwritten responsive CSS and Nunito variable font |
| Deployment | GitHub Actions and GitHub Pages for the frontend; Railway for the backend |


## Run locally

### Prerequisites

- Node.js 22+
- npm
- A MongoDB database

### 1. Start the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```dotenv
MONGODB_URI=your_mongodb_connection_string
BETTER_AUTH_SECRET=your_random_secret
BETTER_AUTH_URL=http://localhost:5001
PORT=5001
```

Then start the development server:

```bash
npm run dev
```

The API defaults to `http://localhost:5001`.

### 2. Start the frontend

In a second terminal:

```bash
cd react18
npm install
```

Create `react18/.env`:

```dotenv
VITE_SERVER_URL=http://localhost:5001
```

Then run:

```bash
npm run dev
```

Vite will print the local application URL.

### Quality checks

```bash
# Frontend
cd react18
npm run typecheck
npm run build

# Backend
cd ../backend
npm run build
```

## Product roadmap

The long term vision is an editable, intent first planning system in which AI interprets requests while deterministic application logic remains responsible for validation and scheduling decisions.

### 1. Smart event creation

- Expand natural language support beyond the current explicit date and time formats
- Interpret duration and richer location phrases
- Preview the interpreted event before saving
- Surface uncertain assumptions
- Detect basic scheduling conflicts
- Keep every generated field manually editable

### 2. Flexible recurrence and scheduling

- Expressive rules such as “every 10 days” or “the last weekday of each month”
- Exceptions and end dates
- Dynamic titles such as milestone counts and anniversaries
- Automatic placement into available time windows

### 3. Location and travel intelligence

- Place autocomplete and saved locations
- Walking, cycling, transit, and driving estimates
- Travel feasibility warnings between events
- Suggested departure buffers and optional travel blocks

### 4. Planning assistant

- Plan or rebalance complete days
- Respect fixed commitments, opening hours, travel, meals, and breaks
- Explain scheduling decisions
- Support conversational edits while preserving user control
