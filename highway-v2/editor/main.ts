import { RoadSpline } from '../shared/road-spline';
import { computeBannerGeometry, type BannerGeometryResult } from '../shared/banner-geometry';
import { BANNER_DEFAULTS } from '../shared/defaults';
import type { Road, BannerPlacement, BannerAsset } from '../shared/types';

// ===========================================================================
// API Client
// ===========================================================================

const API = {
  async getRoads(): Promise<Road[]> {
    return (await fetch('/api/roads')).json();
  },
  async updateRoad(id: string, data: Partial<Road>) {
    return (await fetch(`/api/roads/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })).json();
  },
  async getBanners(): Promise<BannerPlacement[]> {
    return (await fetch('/api/banners')).json();
  },
  async createBanner(data: BannerPlacement) {
    return (await fetch('/api/banners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })).json();
  },
  async updateBanner(id: string, data: Partial<BannerPlacement>) {
    return (await fetch(`/api/banners/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })).json();
  },
  async deleteBanner(id: string) {
    return (await fetch(`/api/banners/${id}`, { method: 'DELETE' })).json();
  },
  async getAssets(): Promise<BannerAsset[]> {
    return (await fetch('/api/assets')).json();
  },
  async uploadAsset(file: File, name?: string): Promise<BannerAsset> {
    const fd = new FormData();
    fd.append('file', file);
    if (name) fd.append('name', name);
    return (await fetch('/api/assets', { method: 'POST', body: fd })).json();
  },
  async deleteAsset(id: string) {
    return (await fetch(`/api/assets/${id}`, { method: 'DELETE' })).json();
  },
};

// ===========================================================================
// State
// ===========================================================================

let roads: Road[] = [];
let banners: BannerPlacement[] = [];
let assets: BannerAsset[] = [];
let activeRoadIdx = 0;
let selectedNodeIdx = -1;
let selectedBannerId: string | null = null;
let pickingAssetForBanner: string | null = null;
let dragTarget: { type: string; bannerId?: string; nodeIdx?: number } | null = null;
let addingNode = false;
let spline: RoadSpline | null = null;

const vp = { cx: 228, cz: 530, scale: 3, dragging: false, lastX: 0, lastY: 0 };

// ===========================================================================
// DOM Helpers
// ===========================================================================

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

// ===========================================================================
// Canvas Setup
// ===========================================================================

const canvas = $<HTMLCanvasElement>('canvas');
const ctx = canvas.getContext('2d')!;

function resizeCanvas() {
  const wrap = $('canvas-wrap');
  canvas.width = wrap.clientWidth * devicePixelRatio;
  canvas.height = wrap.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  render();
}
window.addEventListener('resize', resizeCanvas);

function w2s(wx: number, wz: number) {
  const cw = canvas.width / devicePixelRatio;
  const ch = canvas.height / devicePixelRatio;
  return {
    x: (wx - vp.cx) * vp.scale + cw / 2,
    y: (wz - vp.cz) * vp.scale + ch / 2,
  };
}

function s2w(sx: number, sy: number) {
  const cw = canvas.width / devicePixelRatio;
  const ch = canvas.height / devicePixelRatio;
  return {
    x: (sx - cw / 2) / vp.scale + vp.cx,
    z: (sy - ch / 2) / vp.scale + vp.cz,
  };
}

// ===========================================================================
// Spline Management
// ===========================================================================

function rebuildSpline() {
  const road = roads[activeRoadIdx];
  if (!road || road.waypoints.length < 2) {
    spline = null;
    return;
  }
  spline = new RoadSpline(road.waypoints, road.id, road.isCyclic);
}

function getBannerGeo(banner: BannerPlacement): BannerGeometryResult | null {
  if (!spline) return null;
  const pt = spline.getPoint(banner.t);
  const tan = spline.getTangent(banner.t);
  return computeBannerGeometry(pt, tan, {
    distance: banner.distance,
    elevation: banner.elevation,
    angle: banner.angle,
    size: banner.size,
  });
}

// ===========================================================================
// Rendering
// ===========================================================================

function render() {
  const cw = canvas.width / devicePixelRatio;
  const ch = canvas.height / devicePixelRatio;
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, 0, cw, ch);
  drawGrid(cw, ch);

  const road = roads[activeRoadIdx];
  if (!road?.waypoints?.length) return;

  if (!spline) rebuildSpline();

  // Draw spline curve + road width
  if (spline) {
    const pts = spline.getPoints(400);
    if (pts.length > 1) {
      const halfW = road.width / 2;

      // Road width fill
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const n = spline.getNormal(i / (pts.length - 1));
        const s = w2s(pts[i].x + n.x * halfW, pts[i].z + n.z * halfW);
        if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
      }
      for (let i = pts.length - 1; i >= 0; i--) {
        const n = spline.getNormal(i / (pts.length - 1));
        const s = w2s(pts[i].x - n.x * halfW, pts[i].z - n.z * halfW);
        ctx.lineTo(s.x, s.y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(3, 160, 98, 0.08)';
      ctx.fill();

      // Road edge lines
      ctx.strokeStyle = 'rgba(3, 160, 98, 0.25)';
      ctx.lineWidth = 1;
      for (const sign of [1, -1]) {
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const n = spline.getNormal(i / (pts.length - 1));
          const s = w2s(pts[i].x + n.x * halfW * sign, pts[i].z + n.z * halfW * sign);
          if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
        }
        ctx.stroke();
      }

      // Center line
      ctx.beginPath();
      const s0 = w2s(pts[0].x, pts[0].z);
      ctx.moveTo(s0.x, s0.y);
      for (let i = 1; i < pts.length; i++) {
        const si = w2s(pts[i].x, pts[i].z);
        ctx.lineTo(si.x, si.y);
      }
      if (road.isCyclic) ctx.closePath();
      ctx.strokeStyle = '#03a062';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Draw banners
  for (const b of banners) {
    if (b.roadId !== road.id) continue;
    const geo = getBannerGeo(b);
    if (!geo) continue;
    const isSelected = b.id === selectedBannerId;

    const sRoad = w2s(geo.roadPointX, geo.roadPointZ);
    const sPivot = w2s(geo.pivotX, geo.pivotZ);
    const sSignEnd = w2s(geo.signEndX, geo.signEndZ);

    // Dashed line: road → pivot
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.moveTo(sRoad.x, sRoad.y);
    ctx.lineTo(sPivot.x, sPivot.y);
    ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Sign line: pivot → end
    ctx.beginPath();
    ctx.moveTo(sPivot.x, sPivot.y);
    ctx.lineTo(sSignEnd.x, sSignEnd.y);
    ctx.strokeStyle = isSelected ? '#fff' : (b.distance >= 0 ? '#e06020' : '#2060e0');
    ctx.lineWidth = isSelected ? 3.5 : 2.5;
    ctx.stroke();

    if (isSelected) {
      drawSelectedBannerHandles(sPivot, sSignEnd);
    } else {
      ctx.beginPath();
      ctx.arc(sPivot.x, sPivot.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = b.distance >= 0 ? '#e06020' : '#2060e0';
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Road anchor dot
    ctx.beginPath();
    ctx.arc(sRoad.x, sRoad.y, 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();
  }

  // Draw waypoints with heading arrows
  drawWaypoints(road);

  $('canvas-info').textContent =
    `zoom: ${vp.scale.toFixed(1)}x | waypoints: ${road.waypoints.length} | banners: ${banners.filter(b => b.roadId === road.id).length} | ${road.isCyclic ? 'cyclic' : 'open'}`;

  positionTooltip();
}

function drawSelectedBannerHandles(
  sPivot: { x: number; y: number },
  sSignEnd: { x: number; y: number },
) {
  // Drag handle circle
  ctx.beginPath();
  ctx.arc(sPivot.x, sPivot.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(sPivot.x, sPivot.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  // Crosshair
  ctx.beginPath();
  ctx.moveTo(sPivot.x - 5, sPivot.y);
  ctx.lineTo(sPivot.x + 5, sPivot.y);
  ctx.moveTo(sPivot.x, sPivot.y - 5);
  ctx.lineTo(sPivot.x, sPivot.y + 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Rotate handle at sign end
  ctx.beginPath();
  ctx.arc(sSignEnd.x, sSignEnd.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,180,0,0.2)';
  ctx.fill();
  ctx.strokeStyle = '#ffb400';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Curved arrow arc
  const arcRadius = 10;
  const dirX = sSignEnd.x - sPivot.x;
  const dirY = sSignEnd.y - sPivot.y;
  const baseAngle = Math.atan2(dirY, dirX);
  ctx.beginPath();
  ctx.arc(sSignEnd.x, sSignEnd.y, arcRadius, baseAngle + 0.5, baseAngle + 2.2);
  ctx.strokeStyle = 'rgba(255,180,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Arrowhead
  const tipAngle = baseAngle + 2.2;
  const tipX = sSignEnd.x + Math.cos(tipAngle) * arcRadius;
  const tipY = sSignEnd.y + Math.sin(tipAngle) * arcRadius;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - 4 * Math.cos(tipAngle - 0.8), tipY - 4 * Math.sin(tipAngle - 0.8));
  ctx.lineTo(tipX - 4 * Math.cos(tipAngle + 0.4), tipY - 4 * Math.sin(tipAngle + 0.4));
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,180,0,0.5)';
  ctx.fill();
}

function drawWaypoints(road: Road) {
  const ARROW_LEN = 15;
  for (let i = 0; i < road.waypoints.length; i++) {
    const wp = road.waypoints[i];
    const sp = w2s(wp.x, wp.z);
    const isNodeSel = i === selectedNodeIdx;

    // Heading arrow
    if (spline && spline.headings[i] !== undefined) {
      const h = spline.headings[i];
      const ax = sp.x + Math.cos(h) * ARROW_LEN;
      const ay = sp.y + Math.sin(h) * ARROW_LEN;

      ctx.beginPath();
      ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(ax, ay);
      ctx.strokeStyle = isNodeSel ? '#ffcc00' : '#555';
      ctx.lineWidth = isNodeSel ? 2 : 1;
      ctx.stroke();

      const aSize = 4;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - aSize * Math.cos(h - 0.5), ay - aSize * Math.sin(h - 0.5));
      ctx.lineTo(ax - aSize * Math.cos(h + 0.5), ay - aSize * Math.sin(h + 0.5));
      ctx.closePath();
      ctx.fillStyle = isNodeSel ? '#ffcc00' : '#555';
      ctx.fill();
    }

    // Waypoint dot
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = isNodeSel ? '#ffcc00' : '#03a062';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText(`${i}`, sp.x + 10, sp.y - 10);
  }
}

function drawGrid(cw: number, ch: number) {
  let gridSize = 10;
  if (vp.scale < 1) gridSize = 100;
  else if (vp.scale < 3) gridSize = 50;
  else if (vp.scale < 8) gridSize = 20;

  const tl = s2w(0, 0);
  const br = s2w(cw, ch);

  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;

  const startX = Math.floor(tl.x / gridSize) * gridSize;
  const startZ = Math.floor(tl.z / gridSize) * gridSize;

  for (let x = startX; x <= br.x; x += gridSize) {
    const s = w2s(x, 0);
    ctx.beginPath();
    ctx.moveTo(s.x, 0);
    ctx.lineTo(s.x, ch);
    ctx.stroke();
  }
  for (let z = startZ; z <= br.z; z += gridSize) {
    const s = w2s(0, z);
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(cw, s.y);
    ctx.stroke();
  }
}

// ===========================================================================
// Tooltip Positioning
// ===========================================================================

function positionTooltip() {
  const tooltip = $('banner-tooltip');
  if (!selectedBannerId) {
    tooltip.classList.remove('active');
    return;
  }

  const banner = banners.find(b => b.id === selectedBannerId);
  const road = roads[activeRoadIdx];
  if (!banner || !road) {
    tooltip.classList.remove('active');
    return;
  }

  tooltip.classList.add('active');

  const geo = getBannerGeo(banner);
  if (!geo) {
    tooltip.classList.remove('active');
    return;
  }

  const sPivot = w2s(geo.pivotX, geo.pivotZ);
  const wrap = $('canvas-wrap');
  const wrapRect = wrap.getBoundingClientRect();

  let left = sPivot.x + 15;
  let top = sPivot.y + 15;
  const ttWidth = 240;
  const ttHeight = tooltip.offsetHeight || 280;

  if (left + ttWidth > wrapRect.width - 10) left = sPivot.x - ttWidth - 15;
  if (top + ttHeight > wrapRect.height - 10) top = sPivot.y - ttHeight - 15;
  if (left < 10) left = 10;
  if (top < 10) top = 10;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

// ===========================================================================
// Hit Testing
// ===========================================================================

function hitTest(sx: number, sy: number) {
  const road = roads[activeRoadIdx];
  if (!road) return null;

  const hitRadius = 10;

  // Selected banner handles (highest priority)
  if (selectedBannerId) {
    const selBanner = banners.find(b => b.id === selectedBannerId);
    if (selBanner && selBanner.roadId === road.id) {
      const geo = getBannerGeo(selBanner);
      if (geo) {
        const sEnd = w2s(geo.signEndX, geo.signEndZ);
        if (Math.hypot(sEnd.x - sx, sEnd.y - sy) < hitRadius) {
          return { type: 'banner-rotate', bannerId: selBanner.id };
        }
        const sPivot = w2s(geo.pivotX, geo.pivotZ);
        if (Math.hypot(sPivot.x - sx, sPivot.y - sy) < hitRadius) {
          return { type: 'banner-drag', bannerId: selBanner.id };
        }
      }
    }
  }

  // Banner pivots
  for (const b of banners) {
    if (b.roadId !== road.id) continue;
    const geo = getBannerGeo(b);
    if (!geo) continue;
    const sp = w2s(geo.pivotX, geo.pivotZ);
    if (Math.hypot(sp.x - sx, sp.y - sy) < hitRadius) {
      return { type: 'banner', bannerId: b.id };
    }
  }

  // Waypoints
  for (let i = 0; i < road.waypoints.length; i++) {
    const wp = road.waypoints[i];
    const sp = w2s(wp.x, wp.z);
    if (Math.hypot(sp.x - sx, sp.y - sy) < hitRadius) {
      return { type: 'waypoint', nodeIdx: i };
    }
  }

  return null;
}

// ===========================================================================
// Interaction — Mouse
// ===========================================================================

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  // Pan: middle-click, right-click, or alt+left-click
  if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
    e.preventDefault();
    vp.dragging = true;
    vp.lastX = e.clientX;
    vp.lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (e.button !== 0) return;

  // Add waypoint mode
  if (addingNode) {
    const w = s2w(sx, sy);
    insertWaypointNearCursor(w.x, w.z);
    addingNode = false;
    $('btn-add-node').textContent = '+ Waypoint';
    canvas.style.cursor = 'crosshair';
    render();
    return;
  }

  const hit = hitTest(sx, sy);

  if (hit && (hit.type === 'banner-drag' || hit.type === 'banner-rotate')) {
    dragTarget = hit;
    canvas.style.cursor = hit.type === 'banner-drag' ? 'grabbing' : 'alias';
    render();
    return;
  }

  if (hit && hit.type === 'banner') {
    selectedBannerId = hit.bannerId!;
    selectedNodeIdx = -1;
    updateNodePanel();
    updateTooltipFields();
    renderBannerList();
    render();
    return;
  }

  if (hit && hit.type === 'waypoint') {
    dragTarget = hit;
    selectedNodeIdx = hit.nodeIdx!;
    selectedBannerId = null;
    updateNodePanel();
    renderBannerList();
    render();
    return;
  }

  // Empty space: pan
  vp.dragging = true;
  vp.lastX = e.clientX;
  vp.lastY = e.clientY;
  canvas.style.cursor = 'grabbing';
  selectedNodeIdx = -1;
  selectedBannerId = null;
  updateNodePanel();
  renderBannerList();
  render();
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (vp.dragging) {
    const dx = e.clientX - vp.lastX;
    const dy = e.clientY - vp.lastY;
    vp.cx -= dx / vp.scale;
    vp.cz -= dy / vp.scale;
    vp.lastX = e.clientX;
    vp.lastY = e.clientY;
    render();
    return;
  }

  // Banner drag (move pivot)
  if (dragTarget?.type === 'banner-drag') {
    const road = roads[activeRoadIdx];
    const banner = banners.find(b => b.id === dragTarget!.bannerId);
    if (!road || !banner || !spline) return;

    const w = s2w(sx, sy);
    const closest = spline.getClosestT(w.x, w.z, 800);
    const pt = spline.getPoint(closest.t);
    const tan = spline.getTangent(closest.t);
    const nx = -tan.z;
    const nz = tan.x;

    const dx = w.x - pt.x;
    const dz = w.z - pt.z;
    const projDist = dx * nx + dz * nz;

    banner.t = closest.t;
    banner.distance = projDist;

    updateTooltipFields();
    renderBannerList();
    render();
    return;
  }

  // Banner rotate (change angle)
  if (dragTarget?.type === 'banner-rotate') {
    const road = roads[activeRoadIdx];
    const banner = banners.find(b => b.id === dragTarget!.bannerId);
    if (!road || !banner) return;

    const geo = getBannerGeo(banner);
    if (!geo) return;

    const w = s2w(sx, sy);
    const toMouseX = w.x - geo.pivotX;
    const toMouseZ = w.z - geo.pivotZ;
    const mouseAngle = Math.atan2(toMouseZ, toMouseX);

    const baseAngle = Math.atan2(-geo.tangentX * geo.side, geo.tangentZ * geo.side);
    let deltaAngle = mouseAngle - baseAngle;
    deltaAngle = ((deltaAngle + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

    banner.angle = Math.round(deltaAngle * 180 / Math.PI * 10) / 10;

    updateTooltipFields();
    render();
    return;
  }

  // Waypoint drag
  if (dragTarget?.type === 'waypoint') {
    const road = roads[activeRoadIdx];
    if (!road) return;
    const wp = road.waypoints[dragTarget.nodeIdx!];
    const w = s2w(sx, sy);
    wp.x = w.x;
    wp.z = w.z;
    rebuildSpline();
    updateNodePanel();
    render();
    return;
  }

  // Hover cursor
  if (!addingNode) {
    const hit = hitTest(sx, sy);
    if (hit?.type === 'banner-drag') canvas.style.cursor = 'grab';
    else if (hit?.type === 'banner-rotate') canvas.style.cursor = 'alias';
    else if (hit?.type === 'banner' || hit?.type === 'waypoint') canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'crosshair';
  }
});

canvas.addEventListener('mouseup', () => {
  if (vp.dragging) vp.dragging = false;
  dragTarget = null;
  canvas.style.cursor = addingNode ? 'copy' : 'crosshair';
});

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 0.9 : 1.1;

  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  const wBefore = s2w(sx, sy);

  vp.scale *= factor;
  vp.scale = Math.max(0.3, Math.min(30, vp.scale));

  const wAfter = s2w(sx, sy);
  vp.cx -= (wAfter.x - wBefore.x);
  vp.cz -= (wAfter.z - wBefore.z);

  render();
}, { passive: false });

// ===========================================================================
// Keyboard
// ===========================================================================

document.addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeIdx >= 0) {
    deleteSelectedNode();
  }
  if (e.key === 'Escape') {
    selectedBannerId = null;
    selectedNodeIdx = -1;
    updateNodePanel();
    renderBannerList();
    render();
  }
});

// ===========================================================================
// Waypoint Operations
// ===========================================================================

function insertWaypointNearCursor(wx: number, wz: number) {
  const road = roads[activeRoadIdx];
  if (!road || road.waypoints.length < 2) {
    if (road) {
      road.waypoints.push({ x: wx, z: wz });
      rebuildSpline();
      selectedNodeIdx = road.waypoints.length - 1;
      updateNodePanel();
    }
    return;
  }

  if (!spline) rebuildSpline();
  if (!spline) return;

  const result = spline.getClosestT(wx, wz, 500);
  const segCount = road.isCyclic ? road.waypoints.length : road.waypoints.length - 1;
  const seg = Math.min(Math.floor(result.t * segCount), segCount - 1);

  const insertIdx = seg + 1;
  road.waypoints.splice(insertIdx, 0, { x: wx, z: wz });
  rebuildSpline();
  selectedNodeIdx = insertIdx;
  updateNodePanel();
}

function deleteSelectedNode() {
  const road = roads[activeRoadIdx];
  if (!road || selectedNodeIdx < 0) return;
  const minPoints = road.isCyclic ? 3 : 2;
  if (road.waypoints.length <= minPoints) return;
  road.waypoints.splice(selectedNodeIdx, 1);
  selectedNodeIdx = -1;
  rebuildSpline();
  updateNodePanel();
  render();
}

// ===========================================================================
// Node Panel
// ===========================================================================

function updateNodePanel() {
  const panel = $('node-info');
  if (selectedNodeIdx < 0) {
    panel.classList.remove('active');
    return;
  }

  panel.classList.add('active');
  const road = roads[activeRoadIdx];
  const wp = road?.waypoints[selectedNodeIdx];
  if (!wp) return;

  $<HTMLInputElement>('node-px').value = wp.x.toFixed(1);
  $<HTMLInputElement>('node-pz').value = wp.z.toFixed(1);

  // Computed heading
  if (spline && spline.headings[selectedNodeIdx] !== undefined) {
    const deg = (spline.headings[selectedNodeIdx] * 180 / Math.PI).toFixed(1);
    $('node-heading').textContent = `${deg}\u00B0`;
  } else {
    $('node-heading').textContent = '--';
  }

  // Curvature from clothoid
  if (spline && selectedNodeIdx >= 0) {
    if (selectedNodeIdx < spline.clothoids.length) {
      $('node-curvature').textContent = spline.clothoids[selectedNodeIdx].kappa0.toFixed(4);
    } else if (spline.clothoids.length > 0) {
      const last = spline.clothoids[spline.clothoids.length - 1];
      $('node-curvature').textContent = (last.kappa0 + last.sigma * last.length).toFixed(4);
    } else {
      $('node-curvature').textContent = '--';
    }
  } else {
    $('node-curvature').textContent = '--';
  }
}

for (const inputId of ['node-px', 'node-pz']) {
  $(inputId).addEventListener('input', () => {
    if (selectedNodeIdx < 0) return;
    const road = roads[activeRoadIdx];
    const wp = road?.waypoints[selectedNodeIdx];
    if (!wp) return;
    wp.x = parseFloat($<HTMLInputElement>('node-px').value) || 0;
    wp.z = parseFloat($<HTMLInputElement>('node-pz').value) || 0;
    rebuildSpline();
    render();
  });
}

// ===========================================================================
// Banner List
// ===========================================================================

function renderBannerList() {
  const list = $('banner-list');
  const road = roads[activeRoadIdx];
  if (!road) { list.innerHTML = ''; return; }

  const roadBanners = banners.filter(b => b.roadId === road.id);
  roadBanners.sort((a, b) => a.t - b.t);

  list.innerHTML = roadBanners.map(b => `
    <div class="banner-item ${b.id === selectedBannerId ? 'selected' : ''}" data-id="${b.id}">
      <div class="banner-dot" style="background:${b.distance >= 0 ? '#e06020' : '#2060e0'}"></div>
      <span class="banner-name">${b.id}</span>
      <span class="banner-t">t=${b.t.toFixed(3)}</span>
    </div>
  `).join('');

  for (const item of list.querySelectorAll<HTMLElement>('.banner-item')) {
    item.addEventListener('click', () => {
      selectedBannerId = item.dataset.id!;
      selectedNodeIdx = -1;
      updateNodePanel();
      updateTooltipFields();
      renderBannerList();
      render();
    });
  }
}

// ===========================================================================
// Banner Tooltip
// ===========================================================================

function updateTooltipFields() {
  const tooltip = $('banner-tooltip');
  if (!selectedBannerId) {
    tooltip.classList.remove('active');
    return;
  }

  const banner = banners.find(b => b.id === selectedBannerId);
  if (!banner) {
    tooltip.classList.remove('active');
    return;
  }

  $('tt-title').textContent = banner.id;
  $<HTMLInputElement>('tt-t').value = String(banner.t);
  $<HTMLInputElement>('tt-mirror').checked = banner.mirror;
  $<HTMLInputElement>('tt-angle').value = String(banner.angle);
  $<HTMLInputElement>('tt-size').value = String(banner.size);
  $<HTMLInputElement>('tt-dist').value = String(banner.distance);
  $<HTMLInputElement>('tt-elev').value = String(banner.elevation);
  $<HTMLInputElement>('tt-emissive').value = String(banner.emissiveIntensity);

  // Asset preview
  const previewEl = $('tt-asset-preview');
  const nameEl = $('tt-asset-name');
  const asset = banner.assetId ? assets.find(a => a.id === banner.assetId) : null;
  if (asset) {
    previewEl.innerHTML = `<img src="/assets/banners/${asset.filePath}" />`;
    nameEl.textContent = asset.name;
    nameEl.classList.remove('empty');
  } else {
    previewEl.innerHTML = '';
    nameEl.textContent = 'No asset';
    nameEl.classList.add('empty');
  }
}

function syncTooltipToState() {
  const banner = banners.find(b => b.id === selectedBannerId);
  if (!banner) return;
  banner.t = parseFloat($<HTMLInputElement>('tt-t').value) || 0;
  banner.mirror = $<HTMLInputElement>('tt-mirror').checked;
  banner.angle = parseFloat($<HTMLInputElement>('tt-angle').value) || 0;
  banner.distance = parseFloat($<HTMLInputElement>('tt-dist').value) || 0;
  banner.size = parseFloat($<HTMLInputElement>('tt-size').value) || 1;
  renderBannerList();
  render();
}

for (const id of ['tt-t', 'tt-angle', 'tt-dist', 'tt-size']) {
  $(id).addEventListener('input', syncTooltipToState);
}
$('tt-mirror').addEventListener('change', syncTooltipToState);

// Save banner
$('tt-save').addEventListener('click', async () => {
  const banner = banners.find(b => b.id === selectedBannerId);
  if (!banner) return;

  banner.t = parseFloat($<HTMLInputElement>('tt-t').value) || 0;
  banner.mirror = $<HTMLInputElement>('tt-mirror').checked;
  banner.angle = parseFloat($<HTMLInputElement>('tt-angle').value) || 0;
  banner.size = parseFloat($<HTMLInputElement>('tt-size').value) || 1;
  banner.distance = parseFloat($<HTMLInputElement>('tt-dist').value) || 0;
  banner.elevation = parseFloat($<HTMLInputElement>('tt-elev').value) || 0;
  banner.emissiveIntensity = parseFloat($<HTMLInputElement>('tt-emissive').value) || 0;

  await API.updateBanner(banner.id, banner);
  renderBannerList();
  render();
  $('status').textContent = 'Banner saved!';
  setTimeout(() => { $('status').textContent = 'Ready'; }, 1500);
});

// Delete banner
$('tt-delete').addEventListener('click', async () => {
  if (!selectedBannerId) return;
  if (!confirm(`Delete banner "${selectedBannerId}"?`)) return;

  await API.deleteBanner(selectedBannerId);
  banners = banners.filter(b => b.id !== selectedBannerId);
  selectedBannerId = null;
  renderBannerList();
  render();
});

// ===========================================================================
// Toolbar Actions
// ===========================================================================

// Save All
$('btn-save').addEventListener('click', async () => {
  const status = $('status');
  status.textContent = 'Saving...';
  try {
    for (const road of roads) {
      await API.updateRoad(road.id, {
        waypoints: road.waypoints,
        isCyclic: road.isCyclic,
      });
    }
    for (const banner of banners) {
      await API.updateBanner(banner.id, banner);
    }
    status.textContent = 'Saved!';
    setTimeout(() => { status.textContent = 'Ready'; }, 2000);
  } catch (err) {
    status.textContent = `Error: ${(err as Error).message}`;
    console.error(err);
  }
});

// Add Waypoint
$('btn-add-node').addEventListener('click', () => {
  addingNode = !addingNode;
  $('btn-add-node').textContent = addingNode ? 'Click curve...' : '+ Waypoint';
  canvas.style.cursor = addingNode ? 'copy' : 'crosshair';
});

// Delete Waypoint
$('btn-delete-node').addEventListener('click', () => {
  deleteSelectedNode();
});

// Fit View
$('btn-fit').addEventListener('click', () => {
  fitView();
});

// Add Banner
$('btn-add-banner').addEventListener('click', () => {
  const road = roads[activeRoadIdx];
  if (!road) return;

  const id = `banner_${road.id}_${Date.now()}`;
  const newBanner: BannerPlacement = {
    id,
    roadId: road.id,
    t: 0.5,
    angle: BANNER_DEFAULTS.angle,
    distance: BANNER_DEFAULTS.distance,
    size: BANNER_DEFAULTS.size,
    elevation: BANNER_DEFAULTS.elevation,
    emissiveIntensity: BANNER_DEFAULTS.emissiveIntensity,
    assetId: null,
    mirror: false,
  };

  banners.push(newBanner);
  selectedBannerId = id;
  selectedNodeIdx = -1;
  updateNodePanel();
  updateTooltipFields();
  renderBannerList();
  render();
  API.createBanner(newBanner).catch(console.error);
});

// Toggle cyclic
$<HTMLInputElement>('chk-cyclic').addEventListener('change', (e) => {
  const road = roads[activeRoadIdx];
  if (!road) return;
  road.isCyclic = (e.target as HTMLInputElement).checked;
  rebuildSpline();
  render();
});

// ===========================================================================
// Fit View
// ===========================================================================

function fitView() {
  const road = roads[activeRoadIdx];
  if (!road?.waypoints?.length) return;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const wp of road.waypoints) {
    minX = Math.min(minX, wp.x);
    maxX = Math.max(maxX, wp.x);
    minZ = Math.min(minZ, wp.z);
    maxZ = Math.max(maxZ, wp.z);
  }

  const pad = 40;
  vp.cx = (minX + maxX) / 2;
  vp.cz = (minZ + maxZ) / 2;

  const cw = canvas.width / devicePixelRatio;
  const ch = canvas.height / devicePixelRatio;
  const scaleX = (cw - pad * 2) / (maxX - minX || 1);
  const scaleZ = (ch - pad * 2) / (maxZ - minZ || 1);
  vp.scale = Math.min(scaleX, scaleZ);

  render();
}

// ===========================================================================
// Asset Library
// ===========================================================================

function renderAssetGrid() {
  const grid = $('asset-grid');
  grid.innerHTML = assets.map(a => `
    <div class="asset-thumb ${pickingAssetForBanner && a.id === pickingAssetForBanner ? 'selected' : ''}" data-id="${a.id}">
      <img src="/assets/banners/${a.filePath}" alt="${a.name}" />
      <span class="asset-label">${a.name}</span>
      <button class="asset-del" data-id="${a.id}" title="Delete asset">&times;</button>
    </div>
  `).join('');

  for (const thumb of grid.querySelectorAll<HTMLElement>('.asset-thumb')) {
    thumb.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('asset-del')) return;
      const assetId = thumb.dataset.id!;
      if (pickingAssetForBanner) {
        const banner = banners.find(b => b.id === pickingAssetForBanner);
        if (banner) {
          banner.assetId = assetId;
          API.updateBanner(banner.id, { assetId }).catch(console.error);
          updateTooltipFields();
          renderBannerList();
          render();
        }
        pickingAssetForBanner = null;
        renderAssetGrid();
      }
    });
  }

  for (const btn of grid.querySelectorAll<HTMLElement>('.asset-del')) {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id!;
      const asset = assets.find(a => a.id === id);
      if (!asset || !confirm(`Delete asset "${asset.name}"?`)) return;
      await API.deleteAsset(id);
      assets = assets.filter(a => a.id !== id);
      for (const b of banners) {
        if (b.assetId === id) b.assetId = null;
      }
      updateTooltipFields();
      renderAssetGrid();
      renderBannerList();
      render();
    });
  }
}

$('asset-upload-btn').addEventListener('click', () => {
  $<HTMLInputElement>('asset-upload-input').click();
});

$('asset-upload-input').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const status = $('status');
  status.textContent = 'Uploading...';
  try {
    const newAsset = await API.uploadAsset(file);
    assets.unshift(newAsset);
    renderAssetGrid();
    status.textContent = 'Uploaded!';
    setTimeout(() => { status.textContent = 'Ready'; }, 1500);
  } catch (err) {
    status.textContent = `Upload error: ${(err as Error).message}`;
    console.error(err);
  }
  (e.target as HTMLInputElement).value = '';
});

$('tt-asset-pick').addEventListener('click', () => {
  if (!selectedBannerId) return;
  pickingAssetForBanner = selectedBannerId;
  renderAssetGrid();
  $('asset-grid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});

$('tt-asset-clear').addEventListener('click', () => {
  const banner = banners.find(b => b.id === selectedBannerId);
  if (!banner) return;
  banner.assetId = null;
  API.updateBanner(banner.id, { assetId: null }).catch(console.error);
  updateTooltipFields();
  renderBannerList();
  render();
});

// ===========================================================================
// Init
// ===========================================================================

async function init() {
  try {
    roads = await API.getRoads();
    banners = await API.getBanners();
    assets = await API.getAssets();

    const road = roads[activeRoadIdx];
    if (road) {
      $<HTMLInputElement>('chk-cyclic').checked = road.isCyclic;
      rebuildSpline();
    }

    $('status').textContent = 'Ready';
    resizeCanvas();
    fitView();
    renderBannerList();
    renderAssetGrid();
  } catch (err) {
    $('status').textContent = `Failed to load: ${(err as Error).message}`;
    console.error(err);
  }
}

init();
