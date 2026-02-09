import { getDb } from './db';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const db = getDb();
const PORT = 4000;
const EDITOR_DIR = join(import.meta.dir, '..', 'editor');
const ASSETS_DIR = join(import.meta.dir, '..', 'assets', 'banners');

// Ensure assets directory exists
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
// API Handlers
// ---------------------------------------------------------------------------

function handleBranches(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM branches').all() as Array<{
      id: string; nodes: string; width_factor: number; segments_factor: number;
    }>;
    return jsonResponse(
      rows.map((r) => ({
        id: r.id,
        nodes: JSON.parse(r.nodes),
        widthFactor: r.width_factor,
        segmentsFactor: r.segments_factor,
      }))
    );
  }

  if (method === 'GET' && id) {
    const row = db.query('SELECT * FROM branches WHERE id = ?').get(id) as {
      id: string; nodes: string; width_factor: number; segments_factor: number;
    } | null;
    if (!row) return errorResponse('Branch not found', 404);
    return jsonResponse({
      id: row.id,
      nodes: JSON.parse(row.nodes),
      widthFactor: row.width_factor,
      segmentsFactor: row.segments_factor,
    });
  }

  if (method === 'POST') {
    const b = body as { id: string; nodes: unknown[]; widthFactor?: number; segmentsFactor?: number };
    if (!b.id || !b.nodes) return errorResponse('Missing id or nodes');
    db.run(
      'INSERT INTO branches (id, nodes, width_factor, segments_factor) VALUES (?, ?, ?, ?)',
      [b.id, JSON.stringify(b.nodes), b.widthFactor ?? 1.0, b.segmentsFactor ?? 1.0]
    );
    return jsonResponse({ ok: true }, 201);
  }

  if (method === 'PUT' && id) {
    const b = body as { nodes?: unknown[]; widthFactor?: number; segmentsFactor?: number };
    const existing = db.query('SELECT * FROM branches WHERE id = ?').get(id);
    if (!existing) return errorResponse('Branch not found', 404);

    if (b.nodes !== undefined) {
      db.run('UPDATE branches SET nodes = ? WHERE id = ?', [JSON.stringify(b.nodes), id]);
    }
    if (b.widthFactor !== undefined) {
      db.run('UPDATE branches SET width_factor = ? WHERE id = ?', [b.widthFactor, id]);
    }
    if (b.segmentsFactor !== undefined) {
      db.run('UPDATE branches SET segments_factor = ? WHERE id = ?', [b.segmentsFactor, id]);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'DELETE' && id) {
    db.run('DELETE FROM branches WHERE id = ?', [id]);
    return jsonResponse({ ok: true });
  }

  return errorResponse('Method not allowed', 405);
}

function handleBanners(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET' && !id) {
    const rows = db.query('SELECT * FROM banners ORDER BY t').all() as Array<{
      id: string; branch_id: string; t: number; side: string; angle: number;
      distance_factor: number | null; size_factor: number | null;
      elevation_factor: number | null; emissive_factor: number | null;
      pad_x: number | null; pad_y: number | null; aspect_ratio: number | null;
      image_file: string; video_file: string | null;
    }>;
    return jsonResponse(
      rows.map((r) => ({
        id: r.id,
        branch_id: r.branch_id,
        t: r.t,
        side: r.side,
        angle: r.angle,
        distanceFactor: r.distance_factor,
        sizeFactor: r.size_factor,
        elevationFactor: r.elevation_factor,
        emmisiveFactor: r.emissive_factor,
        padX: r.pad_x,
        padY: r.pad_y,
        aspectRatio: r.aspect_ratio,
        bannerImageFile: r.image_file,
        animatedBannerVideo: r.video_file,
      }))
    );
  }

  if (method === 'GET' && id) {
    const r = db.query('SELECT * FROM banners WHERE id = ?').get(id) as {
      id: string; branch_id: string; t: number; side: string; angle: number;
      distance_factor: number | null; size_factor: number | null;
      elevation_factor: number | null; emissive_factor: number | null;
      pad_x: number | null; pad_y: number | null; aspect_ratio: number | null;
      image_file: string; video_file: string | null;
    } | null;
    if (!r) return errorResponse('Banner not found', 404);
    return jsonResponse({
      id: r.id,
      branch_id: r.branch_id,
      t: r.t,
      side: r.side,
      angle: r.angle,
      distanceFactor: r.distance_factor,
      sizeFactor: r.size_factor,
      elevationFactor: r.elevation_factor,
      emmisiveFactor: r.emissive_factor,
      padX: r.pad_x,
      padY: r.pad_y,
      aspectRatio: r.aspect_ratio,
      bannerImageFile: r.image_file,
      animatedBannerVideo: r.video_file,
    });
  }

  if (method === 'POST') {
    const b = body as Record<string, unknown>;
    if (!b.id || !b.branch_id || b.t === undefined || !b.side || !b.bannerImageFile) {
      return errorResponse('Missing required fields: id, branch_id, t, side, bannerImageFile');
    }
    db.run(
      `INSERT INTO banners (id, branch_id, t, side, angle, distance_factor, size_factor,
       elevation_factor, emissive_factor, pad_x, pad_y, aspect_ratio, image_file, video_file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id as string, b.branch_id as string, b.t as number, b.side as string,
        (b.angle as number) ?? 0,
        (b.distanceFactor as number) ?? null, (b.sizeFactor as number) ?? null,
        (b.elevationFactor as number) ?? null, (b.emmisiveFactor as number) ?? null,
        (b.padX as number) ?? null, (b.padY as number) ?? null,
        (b.aspectRatio as number) ?? null,
        b.bannerImageFile as string, (b.animatedBannerVideo as string) ?? null,
      ]
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
      branch_id: 'branch_id', t: 't', side: 'side', angle: 'angle',
      distanceFactor: 'distance_factor', sizeFactor: 'size_factor',
      elevationFactor: 'elevation_factor', emmisiveFactor: 'emissive_factor',
      padX: 'pad_x', padY: 'pad_y', aspectRatio: 'aspect_ratio',
      bannerImageFile: 'image_file', animatedBannerVideo: 'video_file',
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

function handleExits(method: string, id: string | null, body: unknown): Response {
  if (method === 'GET') {
    const rows = db.query('SELECT * FROM exits').all() as Array<{
      id: number; from_branch: string; from_t: number; to_branch: string; to_t: number;
    }>;
    return jsonResponse(
      rows.map((r) => ({
        id: r.id,
        fromBranch: r.from_branch,
        fromT: r.from_t,
        toBranch: r.to_branch,
        toT: r.to_t,
      }))
    );
  }

  if (method === 'POST') {
    const e = body as { fromBranch: string; fromT: number; toBranch: string; toT: number };
    if (!e.fromBranch || !e.toBranch) return errorResponse('Missing required fields');
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

async function handleUpload(req: Request): Promise<Response> {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const subfolder = (formData.get('subfolder') as string) || '';

  if (!file) return errorResponse('No file provided');

  const targetDir = subfolder ? join(ASSETS_DIR, subfolder) : ASSETS_DIR;
  mkdirSync(targetDir, { recursive: true });

  const targetPath = join(targetDir, file.name);
  const buffer = await file.arrayBuffer();
  await Bun.write(targetPath, buffer);

  const relativePath = subfolder ? `${subfolder}/${file.name}` : file.name;
  return jsonResponse({ ok: true, path: relativePath });
}

function handleExport(): Response {
  const branches = db.query('SELECT * FROM branches').all() as Array<{
    id: string; nodes: string; width_factor: number; segments_factor: number;
  }>;
  const banners = db.query('SELECT * FROM banners ORDER BY t').all();
  const exits = db.query('SELECT * FROM exits').all();

  return jsonResponse({
    branches: branches.map((b) => ({
      id: b.id,
      nodes: JSON.parse(b.nodes),
      widthFactor: b.width_factor,
      segmentsFactor: b.segments_factor,
    })),
    banners,
    exits,
  });
}

// ---------------------------------------------------------------------------
// Static File Serving
// ---------------------------------------------------------------------------

async function serveStatic(pathname: string): Promise<Response> {
  // Default to index.html
  if (pathname === '/' || pathname === '/editor' || pathname === '/editor/') {
    pathname = '/index.html';
  }

  // Strip leading /editor/ prefix if present
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
      // Parse path: /api/{resource}/{id?}
      const apiMatch = path.match(/^\/api\/(\w+)(?:\/(.+))?$/);

      if (apiMatch) {
        const [, resource, id] = apiMatch;
        const body = method === 'POST' || method === 'PUT'
          ? await req.json().catch(() => null)
          : null;

        switch (resource) {
          case 'branches': return handleBranches(method, id ?? null, body);
          case 'banners': return handleBanners(method, id ?? null, body);
          case 'exits': return handleExits(method, id ?? null, body);
          case 'upload': return handleUpload(req);
          case 'export': return handleExport();
          default: return errorResponse('Unknown resource', 404);
        }
      }

      // Serve editor static files
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
