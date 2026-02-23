import { getDb } from './db';
import { join } from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';

const db = getDb();
const PORT = 4000;
const EDITOR_DIR = join(import.meta.dir, '..', 'editor');
const ASSETS_DIR = join(import.meta.dir, '..', 'assets', 'banners');

mkdirSync(ASSETS_DIR, { recursive: true });

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

interface BranchRow {
  id: string;
  waypoints: string;
  is_cyclic: number;
  width_factor: number;
  segments_factor: number;
}

interface BannerRow {
  id: string;
  branch_id: string;
  t: number;
  angle: number;
  asset_id: string | null;
  distance_factor: number | null;
  size_factor: number | null;
  elevation_factor: number | null;
  emissive_factor: number | null;
  mirror: number;
}

interface AssetRow {
  id: string;
  name: string;
  file_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

interface ExitRow {
  id: number;
  from_branch: string;
  from_t: number;
  to_branch: string;
  to_t: number;
}

function branchRowToJson(r: BranchRow) {
  return {
    id: r.id,
    waypoints: JSON.parse(r.waypoints),
    isCyclic: !!r.is_cyclic,
    widthFactor: r.width_factor,
    segmentsFactor: r.segments_factor,
  };
}

function bannerRowToJson(r: BannerRow) {
  return {
    id: r.id,
    branch_id: r.branch_id,
    t: r.t,
    angle: r.angle,
    assetId: r.asset_id,
    distanceFactor: r.distance_factor,
    sizeFactor: r.size_factor,
    elevationFactor: r.elevation_factor,
    emissiveFactor: r.emissive_factor,
    mirror: !!r.mirror,
  };
}

function assetRowToJson(r: AssetRow) {
  return {
    id: r.id,
    name: r.name,
    filePath: r.file_path,
    width: r.width,
    height: r.height,
  };
}

function exitRowToJson(r: ExitRow) {
  return {
    id: r.id,
    fromBranch: r.from_branch,
    fromT: r.from_t,
    toBranch: r.to_branch,
    toT: r.to_t,
  };
}

// ---------------------------------------------------------------------------
// API Handlers
// ---------------------------------------------------------------------------

function handleBranches(
  method: string,
  id: string | null,
  body: unknown
): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM branches').all() as BranchRow[];
    return jsonResponse(rows.map(branchRowToJson));
  }

  if (method === 'GET' && id) {
    const row = db
      .query('SELECT * FROM branches WHERE id = ?')
      .get(id) as BranchRow | null;
    if (!row) return errorResponse('Branch not found', 404);
    return jsonResponse(branchRowToJson(row));
  }

  if (method === 'POST') {
    const b = body as {
      id: string;
      waypoints: unknown[];
      isCyclic?: boolean;
      widthFactor?: number;
      segmentsFactor?: number;
    };
    if (!b.id || !b.waypoints) return errorResponse('Missing id or waypoints');
    db.run(
      'INSERT INTO branches (id, waypoints, is_cyclic, width_factor, segments_factor) VALUES (?, ?, ?, ?, ?)',
      [
        b.id,
        JSON.stringify(b.waypoints),
        b.isCyclic ? 1 : 0,
        b.widthFactor ?? 1.0,
        b.segmentsFactor ?? 1.0,
      ]
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const b = body as {
      waypoints?: unknown[];
      isCyclic?: boolean;
      widthFactor?: number;
      segmentsFactor?: number;
    };
    const existing = db
      .query('SELECT * FROM branches WHERE id = ?')
      .get(id);
    if (!existing) return errorResponse('Branch not found', 404);

    if (b.waypoints !== undefined) {
      db.run('UPDATE branches SET waypoints = ? WHERE id = ?', [
        JSON.stringify(b.waypoints),
        id,
      ]);
    }
    if (b.isCyclic !== undefined) {
      db.run('UPDATE branches SET is_cyclic = ? WHERE id = ?', [
        b.isCyclic ? 1 : 0,
        id,
      ]);
    }
    if (b.widthFactor !== undefined) {
      db.run('UPDATE branches SET width_factor = ? WHERE id = ?', [
        b.widthFactor,
        id,
      ]);
    }
    if (b.segmentsFactor !== undefined) {
      db.run('UPDATE branches SET segments_factor = ? WHERE id = ?', [
        b.segmentsFactor,
        id,
      ]);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM branches WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

function handleBanners(
  method: string,
  id: string | null,
  body: unknown
): Response {
  if (method === 'GET' && !id) {
    const rows = db
      .query('SELECT * FROM banners ORDER BY t')
      .all() as BannerRow[];
    return jsonResponse(rows.map(bannerRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db
      .query('SELECT * FROM banners WHERE id = ?')
      .get(id) as BannerRow | null;
    if (!r) return errorResponse('Banner not found', 404);
    return jsonResponse(bannerRowToJson(r));
  }

  if (method === 'POST') {
    const b = body as Record<string, unknown>;
    if (
      !b.id ||
      !b.branch_id ||
      b.t === undefined
    ) {
      return errorResponse(
        'Missing required fields: id, branch_id, t'
      );
    }
    db.run(
      `INSERT INTO banners (id, branch_id, t, angle, asset_id,
       distance_factor, size_factor, elevation_factor, emissive_factor, mirror)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id as string,
        b.branch_id as string,
        b.t as number,
        (b.angle as number) ?? 0,
        (b.assetId as string) ?? null,
        (b.distanceFactor as number) ?? null,
        (b.sizeFactor as number) ?? null,
        (b.elevationFactor as number) ?? null,
        (b.emissiveFactor as number) ?? null,
        b.mirror ? 1 : 0,
      ]
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const existing = db
      .query('SELECT * FROM banners WHERE id = ?')
      .get(id);
    if (!existing) return errorResponse('Banner not found', 404);

    const b = body as Record<string, unknown>;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];

    const mapping: Record<string, string> = {
      branch_id: 'branch_id',
      t: 't',
      angle: 'angle',
      assetId: 'asset_id',
      distanceFactor: 'distance_factor',
      sizeFactor: 'size_factor',
      elevationFactor: 'elevation_factor',
      emissiveFactor: 'emissive_factor',
    };

    for (const [jsKey, dbCol] of Object.entries(mapping)) {
      if (b[jsKey] !== undefined) {
        fields.push(`${dbCol} = ?`);
        values.push(b[jsKey] as string | number | null);
      }
    }

    if (b.mirror !== undefined) {
      fields.push('mirror = ?');
      values.push(b.mirror ? 1 : 0);
    }

    if (fields.length > 0) {
      values.push(id);
      db.run(
        `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM banners WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

function handleExits(
  method: string,
  id: string | null,
  body: unknown
): Response {
  if (method === 'GET') {
    const rows = db.query('SELECT * FROM exits').all() as ExitRow[];
    return jsonResponse(rows.map(exitRowToJson));
  }

  if (method === 'POST') {
    const e = body as {
      fromBranch: string;
      fromT: number;
      toBranch: string;
      toT: number;
    };
    if (!e.fromBranch || !e.toBranch)
      return errorResponse('Missing required fields');
    db.run(
      'INSERT INTO exits (from_branch, from_t, to_branch, to_t) VALUES (?, ?, ?, ?)',
      [e.fromBranch, e.fromT, e.toBranch, e.toT]
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM exits WHERE id = ?', [parseInt(id)]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

// ---------------------------------------------------------------------------
// Asset handlers
// ---------------------------------------------------------------------------

function handleAssets(
  method: string,
  id: string | null,
  _body: unknown
): Response {
  if (method === 'GET' && !id) {
    const rows = db
      .query('SELECT * FROM banner_assets ORDER BY created_at DESC')
      .all() as AssetRow[];
    return jsonResponse(rows.map(assetRowToJson));
  }

  if (method === 'GET' && id) {
    const r = db
      .query('SELECT * FROM banner_assets WHERE id = ?')
      .get(id) as AssetRow | null;
    if (!r) return errorResponse('Asset not found', 404);
    return jsonResponse(assetRowToJson(r));
  }

  if (method === 'DELETE' && id) {
    const row = db
      .query('SELECT * FROM banner_assets WHERE id = ?')
      .get(id) as AssetRow | null;
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

  if (!file) return errorResponse('No file provided');

  const ext = file.name.substring(file.name.lastIndexOf('.'));
  const id = randomUUID();
  const filename = `${id}${ext}`;
  const targetPath = join(ASSETS_DIR, filename);

  const buffer = await file.arrayBuffer();
  await Bun.write(targetPath, buffer);

  const displayName = name || file.name.replace(/\.[^.]+$/, '');

  db.run(
    'INSERT INTO banner_assets (id, name, file_path) VALUES (?, ?, ?)',
    [id, displayName, filename]
  );

  const row = db
    .query('SELECT * FROM banner_assets WHERE id = ?')
    .get(id) as AssetRow;

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
  const branches = db
    .query('SELECT * FROM branches')
    .all() as BranchRow[];
  const banners = db
    .query('SELECT * FROM banners ORDER BY t')
    .all() as BannerRow[];
  const exits = db.query('SELECT * FROM exits').all() as ExitRow[];
  const assets = db
    .query('SELECT * FROM banner_assets')
    .all() as AssetRow[];

  return jsonResponse({
    highway: {
      branches: branches.map(branchRowToJson),
      exits: exits.map(exitRowToJson),
    },
    banners: banners.map(bannerRowToJson),
    assets: assets.map(assetRowToJson),
  });
}

function handleExport(): Response {
  return handleData();
}

// ---------------------------------------------------------------------------
// Static File Serving
// ---------------------------------------------------------------------------

async function serveStatic(pathname: string): Promise<Response> {
  if (pathname === '/' || pathname === '/editor' || pathname === '/editor/') {
    pathname = '/index.html';
  }

  pathname = pathname.replace(/^\/editor\//, '/');

  const filePath = join(EDITOR_DIR, pathname);

  if (!existsSync(filePath)) {
    return new Response('Not Found', { status: 404 });
  }

  const file = Bun.file(filePath);
  const ext = pathname.substring(pathname.lastIndexOf('.'));
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  return new Response(file, {
    headers: { 'Content-Type': contentType },
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
      // Serve asset files at /assets/banners/...
      const assetFileMatch = path.match(/^\/assets\/banners\/(.+)$/);
      if (assetFileMatch) {
        return serveAssetFile(assetFileMatch[1]);
      }

      // Asset upload (multipart) needs special handling before JSON parsing
      if (path === '/api/assets' && method === 'POST') {
        return handleAssetUpload(req);
      }

      const apiMatch = path.match(/^\/api\/(\w+)(?:\/(.+))?$/);

      if (apiMatch) {
        const [, resource, id] = apiMatch;
        const body =
          method === 'POST' || method === 'PUT'
            ? await req.json().catch(() => null)
            : null;

        switch (resource) {
          case 'branches':
            return handleBranches(method, id ?? null, body);
          case 'banners':
            return handleBanners(method, id ?? null, body);
          case 'exits':
            return handleExits(method, id ?? null, body);
          case 'assets':
            return handleAssets(method, id ?? null, body);
          case 'data':
            return handleData();
          case 'export':
            return handleExport();
          default:
            return errorResponse('Unknown resource', 404);
        }
      }

      return serveStatic(path);
    } catch (err) {
      console.error('Server error:', err);
      return errorResponse('Internal server error', 500);
    }
  },
});

console.log(`Editor server running at http://localhost:${PORT}`);
console.log(`  Editor UI:  http://localhost:${PORT}/editor`);
console.log(`  API:        http://localhost:${PORT}/api/`);
console.log(`  Scene data: http://localhost:${PORT}/api/data`);
