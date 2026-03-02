# Banner Highway

An interactive 3D highway experience built with Three.js. The app renders a clothoid-curve road loop with banner ad billboards, plays MIDI-driven audio, and includes a browser-based editor backed by a Bun + SQLite API.

## Features

- **3D highway scene** with banner ad billboards, sky effects, and navigation controls.
- **MIDI audio** playback with tunable DSP settings.
- **Built-in editor** for roads, banner ad billboards, assets, parts, and songs.
- **SQLite-backed data pipeline**
  - The editor writes scene data (roads, banner ad billboards, parts, songs, audio settings) to SQLite.
  - At build time, `extract-data.ts` reads all tables and emits a single `generated/data.json`.
  - Vite bundles this JSON into the JS output — no separate data file, no runtime database dependency.
  - In dev mode, the frontend fetches live data from the editor server instead.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Node.js >= 20 (for tooling compatibility)

## Getting Started

```bash
cd website
bun install
```

### Development

Run the Vite dev server and the editor backend together:

```bash
bun run dev
```

This starts:

- **Frontend** at `http://localhost:3000` (Vite dev server)
- **Editor backend** at `http://localhost:4000` (Bun HTTP server)

To run only the frontend:

```bash
bun run dev:vite
```

To run only the editor backend:

```bash
bun run editor
```

### Database

Scene data (roads, banner ad billboards, audio settings) lives in a SQLite database at `data/highway.sqlite`.

To re-initialize the database from scratch:

```bash
bun run seed
```

To extract the database into a static JSON file (done automatically during build):

```bash
bun run extract
```

## Production Build

```bash
bun run build
```

This extracts data from SQLite into `generated/data.json`, then runs `vite build`. Output goes to `dist/`.

To preview the build locally:

```bash
bun run start
```

Serves the static site at `http://localhost:3000`.

## Deploy with Coolify

Deployed to [https://highway-01.banner-depot-2000.net/](https://highway-01.banner-depot-2000.net/), hosted on our own server using Coolify.

1. Set **Build Pack** to **Nixpacks**
2. Set **Base Directory** to `/website`

Nixpacks auto-detects Bun + Node, runs `bun run build`, and serves the static `dist/` folder. No environment variables needed.

## Notes

- The editor API is a Bun server in `server/index.ts` and serves both JSON APIs and uploaded assets.
- Build-time extraction is handled by `scripts/extract-data.ts`.
- Editor is not included in the production build.

## Project Structure

```text
website/
├── scripts/          # Frontend source code
│   ├── main.ts       # App entry point
│   ├── core/         # Scene, navigation, render pipeline
│   ├── road/         # Road mesh generation
│   ├── banners/      # Banner ad billboard rendering
│   ├── audio/        # Audio engine & MIDI playback
│   ├── shaders/      # GLSL shaders
│   ├── data/         # Data loading
│   ├── utils/        # Shared frontend utilities
│   └── extract-data.ts  # Build-time data extraction script
├── shared/           # Shared types & math utilities
├── editor/           # Editor UI (separate entry point)
├── server/           # Editor backend (Bun HTTP server)
├── assets/           # Static media (banners, MIDI, fonts)
├── data/             # SQLite database
├── generated/        # Build-time extracted JSON
└── dist/             # Build output
```
