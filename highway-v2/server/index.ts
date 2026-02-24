import { getDb } from './db';
import { join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

const db = getDb();
const PORT = 4000;
const EDITOR_DIR = join(import.meta.dir, '..', 'editor');
const ASSETS_DIR = join(import.meta.dir, '..', 'assets', 'banners');
const MIDI_DIR = join(import.meta.dir, '..', 'assets', 'midi');

mkdirSync(ASSETS_DIR, { recursive: true });
mkdirSync(MIDI_DIR, { recursive: true });

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mid': 'audio/midi',
  '.midi': 'audio/midi',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

// ---------------------------------------------------------------------------
// DB row types
// ---------------------------------------------------------------------------

interface RoadRow {
  id: string;
  waypoints: string;
  is_cyclic: number;
  width: number;
  segment_count: number;
}

interface BannerRow {
  id: string;
  road_id: string;
  t: number;
  angle: number;
  asset_id: string | null;
  distance: number;
  size: number;
  elevation: number;
  emissive_intensity: number;
  caption: string | null;
}

interface AssetRow {
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
  caption: string | null;
  created_at: string;
}

interface JunctionRow {
  id: number;
  from_road: string;
  from_t: number;
  to_road: string;
  to_t: number;
}

interface PartRow {
  id: string;
  road_id: string;
  start_t: number;
}

interface SongRow {
  id: string;
  name: string;
  file_path: string;
  source_url: string;
  language: string;
  created_at: string;
}

interface PartSongRow {
  part_id: string;
  song_id: string;
}

function partRowToJson(r: PartRow) {
  return { id: r.id, roadId: r.road_id, startT: r.start_t };
}

function songRowToJson(r: SongRow) {
  return {
    id: r.id,
    name: r.name,
    filePath: r.file_path,
    sourceUrl: r.source_url,
    language: r.language,
  };
}

function partSongRowToJson(r: PartSongRow) {
  return { partId: r.part_id, songId: r.song_id };
}

function roadRowToJson(r: RoadRow) {
  return {
    id: r.id,
    waypoints: JSON.parse(r.waypoints),
    isCyclic: !!r.is_cyclic,
    width: r.width,
    segmentCount: r.segment_count,
  };
}

function bannerRowToJson(r: BannerRow) {
  return {
    id: r.id,
    roadId: r.road_id,
    t: r.t,
    angle: r.angle,
    assetId: r.asset_id,
    distance: r.distance,
    size: r.size,
    elevation: r.elevation,
    emissiveIntensity: r.emissive_intensity,
    caption: r.caption ?? '',
  };
}

function assetRowToJson(r: AssetRow) {
  return {
    id: r.id,
    name: r.name,
    filePath: r.file_path,
    width: r.width,
    height: r.height,
    caption: r.caption,
  };
}

function junctionRowToJson(r: JunctionRow) {
  return {
    id: r.id,
    fromRoad: r.from_road,
    fromT: r.from_t,
    toRoad: r.to_road,
    toT: r.to_t,
  };
}

// ---------------------------------------------------------------------------
// API Handlers
// ---------------------------------------------------------------------------

function handleRoads(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM roads').all() as RoadRow[];
    return jsonResponse(rows.map(roadRowToJson));
  }

  if (method === 'GET' && id) {
    const row = db.query('SELECT * FROM roads WHERE id = ?').get(id) as RoadRow | null;
    if (!row) return errorResponse('Road not found', 404);
    return jsonResponse(roadRowToJson(row));
  }

  if (method === 'POST') {
    const b = body as { id: string; waypoints: unknown[]; isCyclic?: boolean; width?: number; segmentCount?: number };
    if (!b.id || !b.waypoints) return errorResponse('Missing id or waypoints');
    db.run(
      'INSERT INTO roads (id, waypoints, is_cyclic, width, segment_count) VALUES (?, ?, ?, ?, ?)',
      [b.id, JSON.stringify(b.waypoints), b.isCyclic ? 1 : 0, b.width ?? 5.555, b.segmentCount ?? 2000],
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const b = body as { waypoints?: unknown[]; isCyclic?: boolean; width?: number; segmentCount?: number };
    const existing = db.query('SELECT * FROM roads WHERE id = ?').get(id);
    if (!existing) return errorResponse('Road not found', 404);

    if (b.waypoints !== undefined) {
      db.run('UPDATE roads SET waypoints = ? WHERE id = ?', [JSON.stringify(b.waypoints), id]);
    }
    if (b.isCyclic !== undefined) {
      db.run('UPDATE roads SET is_cyclic = ? WHERE id = ?', [b.isCyclic ? 1 : 0, id]);
    }
    if (b.width !== undefined) {
      db.run('UPDATE roads SET width = ? WHERE id = ?', [b.width, id]);
    }
    if (b.segmentCount !== undefined) {
      db.run('UPDATE roads SET segment_count = ? WHERE id = ?', [b.segmentCount, id]);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM roads WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

function handleBanners(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM banners ORDER BY t').all() as BannerRow[];
    return jsonResponse(rows.map(bannerRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db.query('SELECT * FROM banners WHERE id = ?').get(id) as BannerRow | null;
    if (!r) return errorResponse('Banner not found', 404);
    return jsonResponse(bannerRowToJson(r));
  }

  if (method === 'POST') {
    const b = body as Record<string, unknown>;
    if (!b.id || !b.roadId || b.t === undefined) {
      return errorResponse('Missing required fields: id, roadId, t');
    }
    db.run(
      `INSERT INTO banners (id, road_id, t, angle, asset_id, distance, size, elevation, emissive_intensity, caption)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id as string,
        b.roadId as string,
        b.t as number,
        (b.angle as number) ?? 0,
        (b.assetId as string) ?? null,
        (b.distance as number) ?? 10,
        (b.size as number) ?? 1.7,
        (b.elevation as number) ?? 10,
        (b.emissiveIntensity as number) ?? 0.8,
        (b.caption as string) ?? null,
      ],
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const existing = db.query('SELECT * FROM banners WHERE id = ?').get(id);
    if (!existing) return errorResponse('Banner not found', 404);

    const b = body as Record<string, unknown>;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const mapping: Record<string, string> = {
      roadId: 'road_id',
      t: 't',
      angle: 'angle',
      assetId: 'asset_id',
      distance: 'distance',
      size: 'size',
      elevation: 'elevation',
      emissiveIntensity: 'emissive_intensity',
      caption: 'caption',
    };

    for (const [jsKey, dbCol] of Object.entries(mapping)) {
      if (b[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        values.push(b[jsKey] as string | number | null);
      }
    }

    if (fields.length > 0) {
      values.push(id);
      db.run(`UPDATE banners SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM banners WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

function handleJunctions(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET') {
    const rows = db.query('SELECT * FROM road_junctions').all() as JunctionRow[];
    return jsonResponse(rows.map(junctionRowToJson));
  }

  if (method === 'POST') {
    const e = body as { fromRoad: string; fromT: number; toRoad: string; toT: number };
    if (!e.fromRoad || !e.toRoad) return errorResponse('Missing required fields');
    db.run(
      'INSERT INTO road_junctions (from_road, from_t, to_road, to_t) VALUES (?, ?, ?, ?)',
      [e.fromRoad, e.fromT, e.toRoad, e.toT],
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM road_junctions WHERE id = ?', [parseInt(id)]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

// ---------------------------------------------------------------------------
// Parts handlers
// ---------------------------------------------------------------------------

function handleParts(method: string, id: string | null, body: unknown, subPath: string | null): Response {
  // Sub-resource: /api/parts/{id}/songs/{songId}
  if (id && subPath) {
    const songsMatch = subPath.match(/^songs(?:\/(.+))?$/);
    if (!songsMatch) return errorResponse('Unknown sub-resource', 404);
    const songId = songsMatch[1] ?? null;

    if (method === 'GET') {
      const rows = db.query('SELECT * FROM part_songs WHERE part_id = ?').all(id) as PartSongRow[];
      return jsonResponse(rows.map(partSongRowToJson));
    }
    if (method === 'POST') {
      const b = body as { songId?: string };
      if (!b?.songId) return errorResponse('Missing songId');
      db.run('INSERT OR IGNORE INTO part_songs (part_id, song_id) VALUES (?, ?)', [id, b.songId]);
      return jsonResponse({ ok: true }, 201);
    }
    if (method === 'DELETE' && songId) {
      db.run('DELETE FROM part_songs WHERE part_id = ? AND song_id = ?', [id, songId]);
      return jsonResponse({ ok: true });
    }
    return errorResponse('Method not allowed', 405);
  }

  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM highway_parts ORDER BY road_id, start_t').all() as PartRow[];
    return jsonResponse(rows.map(partRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db.query('SELECT * FROM highway_parts WHERE id = ?').get(id) as PartRow | null;
    if (!r) return errorResponse('Part not found', 404);
    return jsonResponse(partRowToJson(r));
  }

  if (method === 'POST') {
    const b = body as { id: string; roadId: string; startT: number };
    if (!b.id || !b.roadId || b.startT === undefined) {
      return errorResponse('Missing required fields: id, roadId, startT');
    }
    db.run('INSERT INTO highway_parts (id, road_id, start_t) VALUES (?, ?, ?)', [b.id, b.roadId, b.startT]);
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const existing = db.query('SELECT * FROM highway_parts WHERE id = ?').get(id);
    if (!existing) return errorResponse('Part not found', 404);
    const b = body as { startT?: number };
    if (b.startT !== undefined) {
      db.run('UPDATE highway_parts SET start_t = ? WHERE id = ?', [b.startT, id]);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM part_songs WHERE part_id = ?', [id]);
    db.run('DELETE FROM highway_parts WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

// ---------------------------------------------------------------------------
// Songs handlers
// ---------------------------------------------------------------------------

function handleSongs(method: string, id: string | null): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM midi_songs ORDER BY created_at DESC').all() as SongRow[];
    return jsonResponse(rows.map(songRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db.query('SELECT * FROM midi_songs WHERE id = ?').get(id) as SongRow | null;
    if (!r) return errorResponse('Song not found', 404);
    return jsonResponse(songRowToJson(r));
  }

  if (method === 'DELETE' && id) {
    const row = db.query('SELECT * FROM midi_songs WHERE id = ?').get(id) as SongRow | null;
    if (!row) return errorResponse('Song not found', 404);

    db.run('DELETE FROM part_songs WHERE song_id = ?', [id]);
    db.run('DELETE FROM midi_songs WHERE id = ?', [id]);

    const filePath = join(MIDI_DIR, row.file_path);
    try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ok */ }

    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

async function handleSongUpload(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string) || '';
  const sourceUrl = (formData.get('sourceUrl') as string) || '';
  const language = (formData.get('language') as string) || '';

  if (!file) return errorResponse('No file provided');

  const ext = file.name.substring(file.name.lastIndexOf('.'));
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const targetPath = join(MIDI_DIR, filename);

  const buffer = await file.arrayBuffer();
  await Bun.write(targetPath, buffer);

  const displayName = name || file.name.replace(/\.[^.]+$/, '');

  db.run(
    'INSERT INTO midi_songs (id, name, file_path, source_url, language) VALUES (?, ?, ?, ?, ?)',
    [id, displayName, filename, sourceUrl, language],
  );

  const row = db.query('SELECT * FROM midi_songs WHERE id = ?').get(id) as SongRow;
  return jsonResponse(songRowToJson(row), 201);
}

// ---------------------------------------------------------------------------
// Asset handlers
// ---------------------------------------------------------------------------

function handleAssets(method: string, id: string | null): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM banner_assets ORDER BY created_at DESC').all() as AssetRow[];
    return jsonResponse(rows.map(assetRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db.query('SELECT * FROM banner_assets WHERE id = ?').get(id) as AssetRow | null;
    if (!r) return errorResponse('Asset not found', 404);
    return jsonResponse(assetRowToJson(r));
  }

  if (method === 'DELETE' && id) {
    const row = db.query('SELECT * FROM banner_assets WHERE id = ?').get(id) as AssetRow | null;
    if (!row) return errorResponse('Asset not found', 404);

    db.run('UPDATE banners SET asset_id = NULL WHERE asset_id = ?', [id]);
    db.run('DELETE FROM banner_assets WHERE id = ?', [id]);

    const filePath = join(ASSETS_DIR, row.file_path);
    try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ok */ }

    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

async function handleAssetUpload(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = (formData.get('name') as string) || '';
  const width = formData.get('width') ? parseInt(formData.get('width') as string) : null;
  const height = formData.get('height') ? parseInt(formData.get('height') as string) : null;

  if (!file) return errorResponse('No file provided');

  const ext = file.name.substring(file.name.lastIndexOf('.'));
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const targetPath = join(ASSETS_DIR, filename);

  const buffer = await file.arrayBuffer();
  await Bun.write(targetPath, buffer);

  const displayName = name || file.name.replace(/\.[^.]+$/, '');

  db.run(
    'INSERT INTO banner_assets (id, name, file_path, width, height) VALUES (?, ?, ?, ?, ?)',
    [id, displayName, filename, width, height],
  );

  const row = db.query('SELECT * FROM banner_assets WHERE id = ?').get(id) as AssetRow;

  return jsonResponse(assetRowToJson(row), 201);
}

function serveAssetFile(filePath: string): Response {
  const fullPath = join(ASSETS_DIR, filePath);
  if (!existsSync(fullPath)) {
    return new Response('Not Found', { status: 404 });
  }
  const file = Bun.file(fullPath);
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  return new Response(file, {
    headers: { 'Content-Type': contentType },
  });
}

// ---------------------------------------------------------------------------
// Combined data endpoint
// ---------------------------------------------------------------------------

function handleData(): Response {
  const roads = db.query('SELECT * FROM roads').all() as RoadRow[];
  const banners = db.query('SELECT * FROM banners ORDER BY t').all() as BannerRow[];
  const junctions = db.query('SELECT * FROM road_junctions').all() as JunctionRow[];
  const assets = db.query('SELECT * FROM banner_assets').all() as AssetRow[];
  const parts = db.query('SELECT * FROM highway_parts ORDER BY road_id, start_t').all() as PartRow[];
  const songs = db.query('SELECT * FROM midi_songs').all() as SongRow[];
  const partSongs = db.query('SELECT * FROM part_songs').all() as PartSongRow[];

  return jsonResponse({
    roadNetwork: {
      roads: roads.map(roadRowToJson),
      junctions: junctions.map(junctionRowToJson),
    },
    banners: banners.map(bannerRowToJson),
    assets: assets.map(assetRowToJson),
    parts: parts.map(partRowToJson),
    songs: songs.map(songRowToJson),
    partSongs: partSongs.map(partSongRowToJson),
  });
}

// ---------------------------------------------------------------------------
// Main Router
// ---------------------------------------------------------------------------

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;

    try {
      // Serve asset files at /assets/banners/... and /assets/midi/...
      const bannerFileMatch = path.match(/^\/assets\/banners\/(.+)$/);
      if (bannerFileMatch) {
        return serveAssetFile(bannerFileMatch[1]);
      }
      const midiFileMatch = path.match(/^\/assets\/midi\/(.+)$/);
      if (midiFileMatch) {
        const fullPath = join(MIDI_DIR, midiFileMatch[1]);
        if (!existsSync(fullPath)) return new Response('Not Found', { status: 404 });
        const ext = midiFileMatch[1].substring(midiFileMatch[1].lastIndexOf('.'));
        return new Response(Bun.file(fullPath), {
          headers: { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' },
        });
      }

      // Multipart uploads need special handling before JSON parsing
      if (path === '/api/assets' && method === 'POST') {
        return handleAssetUpload(req);
      }
      if (path === '/api/songs' && method === 'POST') {
        return handleSongUpload(req);
      }

      // Match: /api/{resource}, /api/{resource}/{id}, /api/{resource}/{id}/{sub...}
      const apiMatch = path.match(/^\/api\/(\w+)(?:\/([^/]+)(?:\/(.+))?)?$/);

      if (apiMatch) {
        const [, resource, id, subPath] = apiMatch;
        const body =
          method === 'POST' || method === 'PUT'
            ? await req.json().catch(() => null)
            : null;

        switch (resource) {
          case 'roads':
            return handleRoads(method, id ?? null, body);
          case 'banners':
            return handleBanners(method, id ?? null, body);
          case 'junctions':
            return handleJunctions(method, id ?? null, body);
          case 'assets':
            return handleAssets(method, id ?? null);
          case 'parts':
            return handleParts(method, id ?? null, body, subPath ?? null);
          case 'songs':
            return handleSongs(method, id ?? null);
          case 'data':
            return handleData();
          case 'export':
            return handleData();
          default:
            return errorResponse('Unknown resource', 404);
        }
      }

      return new Response('Not Found', { status: 404 });
    } catch (err) {
      console.error('Server error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
});

console.log(`Editor server running at http://localhost:${PORT}`);
console.log(`  API:        http://localhost:${PORT}/api/`);
console.log(`  Scene data: http://localhost:${PORT}/api/data`);
