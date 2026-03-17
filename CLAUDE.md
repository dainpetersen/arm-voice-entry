# Cropwise ARM Voice Entry + Farm Dashboard

## What This Project Is

Two apps in one repo, both for **agricultural research trial management**:

1. **Voice Entry App** (mobile-first) — Field technicians walk plots and record data by voice or keypad. Supports offline use with Supabase cloud sync.
2. **Farm Management Dashboard** (desktop-only) — Back-office trial management with interactive maps, workflow scheduling, client management, financials, and ARM protocol import.

Both apps serve the workflow of a **contract research organization (CRO)** that runs field trials for agrochemical companies (Syngenta, BASF, Corteva, etc.). The CRO plants crops, applies treatments per protocol, collects assessment data on defined schedules, and delivers results.

**Live URL:** `https://arm-voice-entry.vercel.app`
- Voice entry: `/#/` (mobile)
- Dashboard: `/#/dashboard` (desktop only, 900px+ width)

---

## Tech Stack

- **React 19** + **TypeScript** (strict mode) + **Vite 6**
- **Hash routing** via `react-router-dom` (required for Vercel SPA)
- **Leaflet** + `react-leaflet` + `leaflet-draw` for maps (Esri satellite tiles)
- **Supabase** for auth + cloud sync (optional — works offline without it)
- **PWA** via `vite-plugin-pwa` (service worker + manifest)
- **localStorage** for all dashboard data (season-scoped) and voice entry data
- **No CSS framework** — custom CSS in `index.css` (mobile) and `dashboard.css` (desktop dark theme)

---

## Project Structure

```
src/
├── App.tsx                    # All routes (voice + dashboard)
├── main.tsx                   # HashRouter entry point
├── types.ts                   # Voice app types
├── index.css                  # Mobile/voice styles
│
├── components/AuthGate.tsx    # Supabase auth wrapper
├── pages/                     # Voice entry pages
│   ├── HomePage.tsx           #   Trial list + sessions
│   ├── SetupPage.tsx          #   Create/edit trial config
│   ├── RecordPage.tsx         #   Voice/keypad data entry (756 lines, most complex)
│   └── ReviewPage.tsx         #   Data table + CSV export
├── hooks/                     # Voice entry hooks
│   ├── useSpeechRecognition.ts #  Web Speech API + spoken number parsing
│   ├── useTrialStorage.ts     #   localStorage persistence
│   ├── useAuth.ts             #   Supabase auth state
│   └── useSync.ts             #   Offline queue monitoring
├── lib/
│   ├── supabase.ts            #   Supabase client init
│   └── sync.ts                #   Offline queue + cloud sync engine
├── utils/
│   ├── csvExport.ts           #   CSV generation for ARM import
│   └── audio.ts               #   Sound effects
│
└── dashboard/
    ├── types.ts               # All dashboard domain types (286 lines)
    ├── seedData.ts            # Demo data: 30 trials, 10 clients, 6 fields
    ├── workflowEngine.ts      # 6 built-in templates + auto-scheduling engine
    ├── protocolParser.ts      # ARM .prt0 binary + .prt text parser
    ├── dashboard.css          # Dark theme styles
    ├── hooks/
    │   └── useDashboardStorage.ts  # localStorage with auto-seed on first visit
    ├── components/
    │   ├── DashboardLayout.tsx     # Top bar + sidebar + mobile gate
    │   ├── Sidebar.tsx             # Nav links
    │   ├── FarmMap.tsx             # Leaflet map
    │   ├── MapDrawTools.tsx        # Draw field boundaries
    │   ├── ClientForm.tsx          # Client CRUD
    │   ├── TrialForm.tsx           # Trial CRUD
    │   ├── TrialList.tsx           # Trial table
    │   └── AutoPlanner.tsx         # Workflow assignment UI
    └── pages/
        ├── DashboardHomePage.tsx   # Stats overview
        ├── MapPage.tsx             # Interactive farm map
        ├── TrialsPage.tsx          # Trial management
        ├── TrialDetailPage.tsx     # Single trial detail
        ├── ClientsPage.tsx        # Client management
        ├── SchedulePage.tsx       # Activity calendar + status management
        ├── WorkflowsPage.tsx      # Workflow template editor
        └── ProtocolImportPage.tsx # Drag-and-drop .prt0 import
```

---

## Key Domain Concepts

### Trials
A **trial** is a contracted field experiment. A client (e.g., Syngenta) sends a **protocol** specifying treatments, replications, assessment schedules, and plot dimensions. The CRO executes the trial and returns data.

- **Treatments:** Numbered 1–N, each with product/rate/description. Treatment 1 is usually the untreated check (CHK).
- **Replications:** Each treatment is replicated R times in a randomized block design.
- **Plots:** Treatment × Replication grid, physically laid out in a field. Each plot has dimensions (e.g., 10ft × 50ft).
- **Status flow:** draft → planned → active → completed → invoiced → cancelled

### Workflow Engine (`workflowEngine.ts`)
Asana-style dependency-based scheduling. Each workflow template defines **stages** with:

- **Activity type:** planting, spray_application, assessment, harvest, etc.
- **Dependencies:** Which stages must complete first
- **Offset anchor:** When to schedule relative to:
  - `planting` — Days After Planting (DAP)
  - `emergence` — Days After Emergence (DAE), estimated at planting+7
  - `treatment` — Days After Treatment (DAT), calculated when spray completes
  - `dependency` — Days after the dependency stage completes
  - `calendar` — Fixed date
- **Assessment variables:** What to measure (weed control %, phytotoxicity %, disease severity, etc.)
- **Photo requirements:** Per-plot, per-rep, or per-trial, with conditional logic

When an activity is marked complete, `evaluateWorkflowRules()` auto-schedules downstream activities. Completing a spray records the application date for DAT calculations. Completing planting estimates emergence at +7 days for DAE calculations.

**6 built-in templates:** Corn Herbicide POST, Soybean Fungicide, Wheat Variety, Corn Insecticide, Sugar Beet, Generic (wildcard).

### ARM Protocol Import (`protocolParser.ts`)
Parses ARM's native `.prt0` binary protocol files. These files use:
- UTF-16LE encoding for text strings (space-padded between characters)
- `\x80` byte field markers with 2-char codes (`TT`=title, `#P`=protocol ID, `YR`=year, `PW`=plot width, `PL`=plot length, `#R`=reps, etc.)
- Binary treatment record separators (`\x80\x80\x80\x80\x80`)
- Embedded RTF for rich text fields (objectives, etc.)
- Treatment types: CHK (check), FERT (fertilizer), HERB (herbicide), FUNG (fungicide), ADDI (additive/adjuvant)

Also supports plain text `.prt` exports as fallback.

### Voice Entry
Mobile field data collection. Technician walks plots in serpentine or sequential order, speaks readings ("twelve point five", "skip"), and the app records per-variable per-subsample data. Supports photos and notes per plot. Exports CSV formatted for ARM software import.

**Speech recognition quirks:** iOS requires single-shot mode with auto-restart (300ms delay). Number parsing handles English number words, decimals, and special commands (skip/dash/missing → null).

### Season Scoping
All dashboard data is scoped to a **season** (e.g., "Season 2026: Mar 1 – Nov 30"). The season selector is in the top bar. Seed data generates one season.

### Data Persistence
- **Dashboard:** All data in localStorage via `useDashboardStorage` hook. Auto-loads seed data on first visit.
- **Voice entry:** Trial configs and sessions in localStorage. Optional Supabase sync with offline queue.
- **To clear dashboard data:** `localStorage.removeItem('dashboard-data')` in dev console, then refresh.

---

## Deployment

- **Platform:** Vercel, auto-deploys from `main` branch
- **Remote:** `arm-voice` → `https://github.com/dainpetersen/arm-voice-entry.git`
- **Branch:** Push to `main` triggers deploy
- **Build:** `npm run build` (Vite)
- **No server-side code** — pure static SPA

### Supabase (Optional)
Set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable cloud sync. Schema is in `supabase-schema.sql`. Without these, the voice entry app works fully offline. The dashboard doesn't use Supabase yet — it's all localStorage.

---

## Running Locally

```bash
git clone https://github.com/dainpetersen/arm-voice-entry.git
cd arm-voice-entry
npm install
npm run dev
# → http://localhost:5173
# Dashboard: http://localhost:5173/#/dashboard
# Voice entry: http://localhost:5173/#/
```

---

## Known Issues & Pending Work

### Bugs
- **Map draw tools:** Only allows 3 vertices, no drag to reshape. Leaflet-draw rectangle mode is limited — may need to switch to polygon draw mode with vertex editing.
- **Oversized buttons:** "Add New" buttons on Clients and Trials pages are too large and block other elements.
- **Sticky plot labels on map:** Plot labels can get stuck on the map and persist after navigation. Hard refresh doesn't always clear them.

### Not Yet Implemented
- **AutoPlanner not wired to MapPage** — The AutoPlanner component exists but isn't connected to the map page for visual plot+workflow integration.
- **Dashboard Supabase sync** — Dashboard data is localStorage only. No cloud persistence yet. Would need new tables for clients, trials, fields, plots, activities, workflows.
- **.prt0 parser refinement** — The binary parser handles the known format but ARM has multiple versions. May need updates as more real protocol files are tested.

### Design Decisions Made
- **No multi-product treatment modeling** — ARM software handles mixing and application details. This system tracks treatments as single labeled items, not individual products/rates within a tank mix.
- **Desktop-only dashboard** — Mobile users at `/#/dashboard` see a gate message redirecting them to the voice entry app. Threshold: 900px viewport width.
- **Hash routing** — Required for Vercel SPA deployment without server-side rewrites.
- **Seed data on first visit** — Dashboard auto-generates 30 demo trials so it's not empty. Clear with `localStorage.removeItem('dashboard-data')`.

---

## Key Files Quick Reference

| What | Where |
|------|-------|
| All routes | `src/App.tsx` |
| Dashboard types | `src/dashboard/types.ts` |
| Voice app types | `src/types.ts` |
| Workflow engine | `src/dashboard/workflowEngine.ts` |
| Protocol parser | `src/dashboard/protocolParser.ts` |
| Seed data | `src/dashboard/seedData.ts` |
| Dashboard storage | `src/dashboard/hooks/useDashboardStorage.ts` |
| Voice recording | `src/pages/RecordPage.tsx` |
| Speech recognition | `src/hooks/useSpeechRecognition.ts` |
| Cloud sync engine | `src/lib/sync.ts` |
| Supabase schema | `supabase-schema.sql` |
| Mobile styles | `src/index.css` |
| Dashboard styles | `src/dashboard/dashboard.css` |
| Vite config | `vite.config.ts` |

---

## Trial Status Colors (carry through all UI)

| Status | Color | Hex |
|--------|-------|-----|
| Draft | Gray | `#9ca3af` |
| Planned | Blue | `#3b82f6` |
| Active | Green | `#237a2d` |
| Completed | Teal | `#059669` |
| Invoiced | Purple | `#8b5cf6` |
| Cancelled | Red | `#ef4444` |

These colors are defined in `TRIAL_STATUS_COLORS` in `src/dashboard/types.ts` and should be used consistently across the dashboard — trial cards, progress timelines, schedule badges, etc.
