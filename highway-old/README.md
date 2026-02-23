# Banner Highway

A Three.js driving experience along a neon-lit highway lined with billboard banners. The highway path is defined with cubic Bezier curves, and a visual editor lets you shape the road and place banners interactively.

## Architecture

```
Frontend (Vite + Three.js)          Editor (Bun HTTP + Canvas 2D)
┌─────────────────────┐             ┌─────────────────────┐
│  constants/          │  ◄── JSON   │  editor/index.html  │
│  scripts/            │             │  server/index.ts     │
│  generated/*.json    │             │  server/db.ts        │
└─────────────────────┘             └──────────┬──────────┘
        ▲                                      │
        │  bun run extract                     │ CRUD API
        │                                      ▼
        └──────────────────────────── data/highway.sqlite
```

**Frontend** — static Vite site. At build time, `extract` reads the SQLite database and writes JSON files into `generated/`. The constants modules load those JSON files via `import.meta.glob`, falling back to hardcoded defaults if the generated files don't exist yet.

**Editor** — a Bun HTTP server (`server/index.ts`) that serves a single-page canvas editor (`editor/index.html`) and exposes a REST API for branches, banners, and exits. All state lives in a SQLite database at `data/highway.sqlite`.

## Prerequisites

- [Bun](https://bun.sh) (runtime for editor server, seed, and extract scripts)
- Node.js >= 20 (for Vite dev/build)

## Quick Start

```bash
# Install dependencies
bun install

# Seed the database with default data (first time only)
bun run seed

# Start the Vite dev server (frontend)
bun run dev

# In another terminal, start the editor
bun run editor
```

| URL | What |
|---|---|
| `http://localhost:5173` | Frontend (Vite dev server) |
| `http://localhost:4000/editor` | Visual editor |
| `http://localhost:4000/api/` | Editor REST API |

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start Vite dev server with HMR |
| `build` | `bun scripts/extract-data.ts && vite build` | Extract data from SQLite, then build for production |
| `preview` | `vite preview` | Preview the production build locally |
| `editor` | `bun server/index.ts` | Start the editor backend on port 4000 |
| `seed` | `bun server/seed.ts` | Populate the database with default path & banner data |
| `extract` | `bun scripts/extract-data.ts` | Export SQLite data to `generated/*.json` for the frontend |

## Workflow

1. **`bun run seed`** — creates `data/highway.sqlite` and populates it with the default highway path and 20 banners.
2. **`bun run editor`** — opens the visual editor at `localhost:4000/editor`. Edit the path, adjust banners, then hit **Save All**.
3. **`bun run extract`** — reads the database and writes `generated/highway-data.json` and `generated/banner-data.json`.
4. **`bun run dev`** (or `build`) — the frontend picks up the generated JSON files automatically.

Steps 2–3 can be repeated as many times as needed. The `build` script runs `extract` automatically before `vite build`.

## Editor Controls

### Canvas

| Action | Effect |
|---|---|
| Left-click drag on empty space | Pan the view |
| Right-click drag | Pan the view |
| Scroll wheel | Zoom in/out (toward cursor) |
| Click a path node | Select it (turns yellow) |
| Drag a node | Move node + handles together |
| Drag a handle | Adjust curve shape (mirrored by default) |
| Alt + drag a handle | Break tangent symmetry (corner point) |
| Click a banner dot | Select banner, open floating editor |
| Escape | Deselect all |
| Delete / Backspace | Delete selected node (min 2 nodes) |

### Toolbar

| Button | Action |
|---|---|
| **Save All** | Persist all branches and banners to the database |
| **+ Node** | Enter insert mode — click near the curve to add a node (De Casteljau split) |
| **Delete Node** | Remove the selected node |
| **Fit View** | Auto-zoom to fit the entire path |
| **+ Banner** | Create a new banner at t=0.5 |

### Banner Tooltip

When a banner is selected (by clicking its dot on the canvas or its entry in the sidebar list), a floating tooltip appears near the banner with editable fields:

- **Position (t)** — 0–1 parameter along the curve
- **Side** — left or right of the road
- **Angle** — rotation of the sign face around the pivot point (far end of the normal arm)
- **Size / Distance / Elevation / Emissive** — scale factors
- **Image File** — path to the banner texture

Changes to t, side, angle, and distance update the canvas in real time. Hit **Save** to persist to the database, or **Delete** to remove the banner.

### Angle Visualization

Each banner on the canvas shows:
- A **dashed arm** from the road surface to the sign position (along the path normal, length = distance factor)
- A **solid line** from the pivot (sign position) showing the sign face orientation
- The sign rotates around the **outer pivot** (far from road), not the road-side end

## Path Definition

The highway is built from **cubic Bezier curves**. Each path node has:

```
PathNode {
  position: Vec3    // anchor point on the curve
  handleIn: Vec3    // incoming control point
  handleOut: Vec3   // outgoing control point
}
```

Adjacent nodes are connected as cubic Bezier segments: `P0 = node[i].position`, `P1 = node[i].handleOut`, `P2 = node[i+1].handleIn`, `P3 = node[i+1].position`. The `HighwaySpline` class wraps these as a `THREE.CurvePath` of `THREE.CubicBezierCurve3` segments.

## Project Structure

```
constants/
  highway.ts          Highway data types, mesh options, fallback path
  banner.ts           Banner types, defaults, fallback definitions

scripts/
  main.ts             App entry point
  core/
    SceneManager.ts   Three.js scene, camera, lighting
    RenderPipeline.ts Post-processing (bloom, etc.)
    NavigationController.ts  Camera movement along the spline
  highway/
    HighwaySpline.ts  Bezier curve path (CurvePath<Vector3>)
    HighwayMesh.ts    Extruded road geometry
    HighwaySystem.ts  Branch manager
  banners/
    Billboard.ts      Single banner mesh + positioning
    BannerManager.ts  Loads and places all banners
  shaders/
    SkyGradientShader.ts
    RetroShader.ts
  utils/
    AssetLoader.ts
    LoadingManager.ts
  extract-data.ts     SQLite → JSON export script

server/
  index.ts            Bun HTTP server (editor API + static files)
  db.ts               SQLite connection + schema
  seed.ts             Populate database with defaults

editor/
  index.html          Single-page visual editor (Canvas 2D)

generated/            (gitignored) JSON files written by extract
data/                 (gitignored) SQLite database
```

## API Reference

All endpoints return JSON. The editor server runs on port 4000.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/branches` | List all branches |
| GET | `/api/branches/:id` | Get a single branch |
| PUT | `/api/branches/:id` | Update branch nodes |
| GET | `/api/banners` | List all banners |
| POST | `/api/banners` | Create a new banner |
| PUT | `/api/banners/:id` | Update a banner |
| DELETE | `/api/banners/:id` | Delete a banner |
| GET | `/api/exits` | List all exits |
