# Banner Highway

An interactive 3D highway experience built with Three.js, featuring banners, audio synthesis, and MIDI playback.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)

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

Scene data (roads, banners, audio settings) lives in a SQLite database at `data/highway.sqlite`.

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

1. Set **Build Pack** to **Nixpacks**
2. Set **Base Directory** to `/website`
3. Set **Port** to `80`

Nixpacks auto-detects Bun + Node, runs `bun run build`, and serves the static `dist/` folder. No environment variables needed.

## Project Structure

```
website/
├── scripts/          # Frontend source code
│   ├── main.ts       # App entry point
│   ├── core/         # Scene, navigation, render pipeline
│   ├── road/         # Road mesh generation
│   ├── banners/      # Banner rendering
│   ├── audio/        # Audio engine & MIDI playback
│   ├── shaders/      # GLSL shaders
│   └── data/         # Data loading
├── shared/           # Shared types & math utilities
├── editor/           # Editor UI (separate entry point)
├── server/           # Editor backend (Bun HTTP server)
├── assets/           # Static media (banners, MIDI, fonts)
├── data/             # SQLite database
├── generated/        # Build-time extracted JSON
└── dist/             # Build output
```
