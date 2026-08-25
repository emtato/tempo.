# tempo. : keep pace with your day.

An intent first calendar built to make planning feel faster, clearer, and more natural.

[**View the live application →**](https://calendar.ems.lol)

**In Active development.** The full stack calendar foundation is live.
coming soon:
- AI powered richer natural language scheduling
- recurrence
- travel intelligence
- planning assistance
are being developed in stages.

## Overview

Smart Calendar is a full stack calendar application exploring a simple product question:

> What if creating an event started with what you meant, instead of a form you had to fill out?

The current release combines a responsive React calendar with a custom event editor, lightweight title interpretation, and persistent MongoDB storage. It is the foundation for a larger system that will turn natural language requests into structured, reviewable events while keeping every assumption visible and editable.

## Preview

<img width="4374" height="2630" alt="sc1" src="https://github.com/user-attachments/assets/9cabc65a-1b63-4aaa-a056-ea6bc61e858a" />
<img width="4374" height="2630" alt="sc2" src="https://github.com/user-attachments/assets/231f2651-3cdc-4142-9075-041a2bdd2fd1" />
<img width="4375" height="2632" alt="sc3" src="https://github.com/user-attachments/assets/22c470e2-d011-4d6d-8088-4d551c0c4cee" />

## What works today

  Day, week, scrollable month, and year views built on FullCalendar.  
  Click or drag across the calendar to create a draft event.  
  Create and edit timed, all day, single day, and multi day events.  
  Custom time entry with selectable values and AM/PM controls.  
  Event metadata for guests, location, and description.  
  Title parsing to change event times for explicit 12 hour and 24 hour times, noon, and midnight.  
  Logic for event start/end dates and times, ensuring positive event durations.   
  MongoDB backed event creation, loading, updating, deletion, and restoration.   
  Five second undo flow after deleting an event.   
  Responsive calendar layout with a collapsible scheduling assistant sidebar.   
  Keyboard workflows, including `N` for a new event, `Escape` for closing the active surface, `Backspace`/`Delete` (mac) to delete the opened event. 

## Engineering highlights

### Date and time correctness

Times are represented internally as minutes after midnight and converted at the API boundary. The application also translates between inclusive dates in the editor and FullCalendar's exclusive all day end dates. `Temporal` is used for date arithmetic rather than manual string manipulation.

### Recoverable deletion

Creation and restoration are separate backend operations. The client temporarily retains the deleted event and offers an accessible five second Undo action, while restoration preserves the event's stable application ID.

### Layered backend

The backend separates HTTP routing, request handling, application rules, domain types, and database operations. This creates clear extension points for validation, recurrence, and AI assisted interpretation without coupling them directly to Express or MongoDB.

### Custom responsive UI

The interface extends FullCalendar with a continuous scrolling month view, custom event rendering, responsive sizing, a collapsible sidebar, and a purpose built event editor. The visual system uses scalable `em` based dimensions and a consistent muted purple palette.

Repo layout

```text
.
├── react18/
│   ├── src/Calendarapp.tsx         # Calendar views and interaction state
│   ├── src/EventDetails.tsx        # Event editor and form behavior
│   ├── src/components/             # Reusable interface controls
│   ├── src/api/                    # REST client
│   └── src/utils/                  # Title time/location interpretation
├── backend/
│   └── src/
│       ├── routes/                 # API paths
│       ├── controllers/            # HTTP translation
│       ├── services/               # Calendar workflows
│       ├── repositories/           # MongoDB operations
│       ├── domain/                 # Shared event shapes
│       └── config/                 # Environment and database setup
└── .github/workflows/deploy.yml    # Frontend deployment workflow
```

## Technology

| Area | Tools |
|     |     |
| Frontend | React 18, TypeScript, Vite |
| Calendar UI | FullCalendar 7 |
| Date handling | Temporal polyfill |
| Backend | Node.js, Express 5, TypeScript |
| Database | MongoDB |
| Styling | Handwritten responsive CSS, Nunito variable font |
| Deployment | GitHub Actions and GitHub Pages for the frontend; Railway backend |


## Run locally

### Prerequisites

  Node.js 22+
  npm
  A MongoDB database

### 1. Start the backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```dotenv
MONGODB_URI=your_mongodb_connection_string
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

  Interpret title, date, time, duration, and location from natural language
  Preview the interpreted event before saving
  Surface uncertain assumptions
  Detect basic scheduling conflicts
  Keep every generated field manually editable

### 2. Flexible recurrence and scheduling

  Expressive rules such as “every 10 days” or “the last weekday of each month”
  Exceptions and end dates
  Dynamic titles such as milestone counts and anniversaries
  Automatic placement into available time windows

### 3. Location and travel intelligence

  Place autocomplete and saved locations
  Walking, cycling, transit, and driving estimates
  Travel feasibility warnings between events
  Suggested departure buffers and optional travel blocks

### 4. Planning assistant

  Plan or rebalance complete days
  Respect fixed commitments, opening hours, travel, meals, and breaks
  Explain scheduling decisions
  Support conversational edits while preserving user control
