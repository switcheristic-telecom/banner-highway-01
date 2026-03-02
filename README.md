# Banner Highway

This is the repository for Banner Highway 01: Get on the Fast Lane, 汽车是旅行的工具, as featured in the HTML Review, March 2026 issue. 

Access the live experience at [https://highway-01.banner-depot-2000.net/](https://highway-01.banner-depot-2000.net/).

Banner Highway is a series of browser-based visual poetry. It is a reimagination of the classic Burma-Shave roadside advertisement-poems for the Information Superhighway. The reader drives down a virtual highway lined with billboards featuring static frames of 1990s-early 2000s web banner ads. As each billboard comes into view, fragments of early web advertising texts appear in sequence, forming messages that resemble mid-century roadside commercial verse. Just as the Burma-Shave signs have become symbols for 1950s Americana, early web banners may now have begun to evoke a similar nostalgia, reminding us of a time when the Internet still felt like a road worth traveling, and every sign along the way promised something just ahead. 

This repository consists of an interactive 3D highway experience built with Three.js. The app renders a procedural road network with billboard banners, plays MIDI-driven audio, and includes a browser-based editor backed by a Bun + SQLite API.

## Features

- 3D highway scene with banners, sky effects, and navigation controls.
- Playback of MIDI audio with tunable DSP settings.
- Built-in editor for roads, banners, assets, parts, and songs.
- SQLite-backed data pipeline with build-time JSON extraction.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- Node.js >= 20 (for tooling compatibility)

## Quick Start

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
- Frontend at `http://localhost:3000`
- Editor backend at `http://localhost:4000`

Run only the frontend:

```bash
bun run dev:vite
```

Run only the editor backend:

```bash
bun run editor
```

### Database

Scene data lives in SQLite at `website/data/highway.sqlite`.

Re-initialize the database:

```bash
bun run seed
```

Extract a static JSON snapshot (done automatically during build):

```bash
bun run extract
```

### Production Build

```bash
bun run build
```

This extracts data into `website/generated/data.json`, then runs `vite build`. Output goes to `website/dist/`. Editor is not included in the production build.

Preview the build locally:

```bash
bun run start
```

## Project Layout

```
assets/                 # Source banners + MIDI originals
website/                # Main web app
  scripts/              # Frontend source code
  editor/               # Editor UI (separate entry point)
  server/               # Bun HTTP API for the editor + assets
  shared/               # Shared types & geometry helpers
  assets/               # Runtime assets (banners, MIDI, fonts)
  data/                 # SQLite database
  generated/            # Build-time extracted JSON
  dist/                 # Build output
```

## Notes

- The editor API is a Bun server in `website/server/index.ts` and serves both JSON APIs and uploaded assets.
- Build-time extraction is handled by `website/scripts/extract-data.ts`.

## Deploy (Coolify)

1. Set Build Pack to Nixpacks
2. Set Base Directory to `/website`
3. Set Port to `80`

Nixpacks auto-detects Bun + Node, runs `bun run build`, and serves the static `dist/`  as the root folder.
