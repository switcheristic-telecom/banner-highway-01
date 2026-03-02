import * as THREE from 'three';
import { Billboard } from './Billboard';
import type { AssetLoader } from '../utils/AssetLoader';
import type { RoadSystem } from '../road/RoadSystem';
import type { BannerRenderData } from '../../shared/types';
import { loadingManager } from '../utils/LoadingManager';

interface CaptionRange {
  bannerId: string;
  caption: string;
  center: number;
  radius: number;
}

export class BannerManager {
  scene: THREE.Scene;
  assetLoader: AssetLoader;
  roadSystem: RoadSystem;
  billboards: Map<string, Billboard>;
  bannerData: BannerRenderData[];
  visibleBanners: Set<string>;
  group: THREE.Group;
  viewDistance: number;
  lodDistances: number[];

  // Per-billboard opacity tracking (avoids needsUpdate every frame)
  billboardOpacities: Map<string, number>;

  // Caption system — fully JS-driven, no CSS transitions or classList
  captionEl: HTMLElement | null;
  captionRanges: Map<string, CaptionRange[]>;
  captionOpacity: number;
  captionTarget: number;
  captionActiveBannerId: string | null;
  captionPendingId: string | null;
  captionPendingText: string;
  captionHoldTime: number;

  constructor(
    scene: THREE.Scene,
    assetLoader: AssetLoader,
    roadSystem: RoadSystem,
  ) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.roadSystem = roadSystem;

    this.billboards = new Map();
    this.bannerData = [];
    this.visibleBanners = new Set();
    this.billboardOpacities = new Map();

    this.group = new THREE.Group();
    this.group.name = 'BannerManager';
    this.scene.add(this.group);

    this.viewDistance = 50;
    this.lodDistances = [20, 40, 80];

    this.captionEl = document.getElementById('banner-caption');
    this.captionRanges = new Map();
    this.captionOpacity = 0;
    this.captionTarget = 0;
    this.captionActiveBannerId = null;
    this.captionPendingId = null;
    this.captionPendingText = '';
    this.captionHoldTime = 0;
  }

  async loadBanners(bannerInfos: BannerRenderData[]) {
    this.bannerData = bannerInfos;
    this.buildCaptionRanges(bannerInfos);

    const bannersByRoad = this.groupBannersByRoad(bannerInfos);

    const allBanners: BannerRenderData[] = [];
    for (const [_roadId, banners] of bannersByRoad) {
      for (const banner of banners) {
        allBanners.push(banner);
      }
    }

    let loaded = 0;
    const total = allBanners.length;
    loadingManager.updateProgress('banners', 0);

    await Promise.all(
      allBanners.map((banner) =>
        this.createBillboard(banner).then((billboard) => {
          loaded++;
          loadingManager.updateProgress('banners', (loaded / total) * 100);
          return billboard;
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Distance helper — handles cyclic wrap-around
  // ---------------------------------------------------------------------------

  private tDistance(a: number, b: number, roadId: string): number {
    const d = Math.abs(a - b);
    const road = this.roadSystem.getRoad(roadId);
    if (road && road.isCyclic) {
      return Math.min(d, 1 - d);
    }
    return d;
  }

  // ---------------------------------------------------------------------------
  // Caption range precomputation
  // ---------------------------------------------------------------------------

  private buildCaptionRanges(bannerInfos: BannerRenderData[]) {
    const CAPTION_RADIUS = 0.08;
    this.captionRanges.clear();

    const byRoad = this.groupBannersByRoad(
      bannerInfos.filter((b) => b.caption),
    );

    for (const [roadId, banners] of byRoad) {
      banners.sort((a, b) => a.t - b.t);

      const ranges: CaptionRange[] = [];
      for (let i = 0; i < banners.length; i++) {
        const b = banners[i];
        let radius = CAPTION_RADIUS;

        // Shrink radius to half the gap to the nearest neighbour
        if (banners.length > 1) {
          let minGap = Infinity;
          for (let j = 0; j < banners.length; j++) {
            if (j === i) continue;
            const gap = this.tDistance(b.t, banners[j].t, roadId);
            if (gap < minGap) minGap = gap;
          }
          radius = Math.min(radius, minGap / 2);
        }

        ranges.push({
          bannerId: b.id,
          caption: b.caption,
          center: b.t,
          radius,
        });
      }

      this.captionRanges.set(roadId, ranges);
    }
  }

  private groupBannersByRoad(bannerInfos: BannerRenderData[]) {
    const grouped = new Map<string, BannerRenderData[]>();

    for (const banner of bannerInfos) {
      if (!grouped.has(banner.roadId)) {
        grouped.set(banner.roadId, []);
      }
      grouped.get(banner.roadId)!.push(banner);
    }

    return grouped;
  }

  async createBillboard(bannerInfo: BannerRenderData) {
    const billboard = new Billboard(bannerInfo, this.assetLoader);
    await billboard.load(this.roadSystem);

    this.billboards.set(bannerInfo.id, billboard);
    this.group.add(billboard.group);
    billboard.group.visible = false;

    return billboard;
  }

  // ---------------------------------------------------------------------------
  // Main update loop
  // ---------------------------------------------------------------------------

  update(deltaTime: number, currentPosition: { roadId: string; t: number }) {
    this.updateVisibility(currentPosition);
    this.updateCaption(currentPosition, deltaTime);

    for (const bannerId of this.visibleBanners) {
      const billboard = this.billboards.get(bannerId);
      if (billboard) {
        billboard.update(deltaTime);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Billboard visibility — cyclic-aware, minimal GPU work
  // ---------------------------------------------------------------------------

  updateVisibility(currentPosition: { roadId: string; t: number }) {
    const newVisibleBanners = new Set<string>();
    const fadeDistance = 0.15;
    const fadeStartDistance = 0.25;

    const roadBanners = this.bannerData.filter(
      (b) => b.roadId === currentPosition.roadId,
    );

    for (const bannerInfo of roadBanners) {
      const billboard = this.billboards.get(bannerInfo.id);
      if (!billboard) continue;

      const distance = this.tDistance(currentPosition.t, bannerInfo.t, currentPosition.roadId);

      if (distance < fadeStartDistance) {
        newVisibleBanners.add(bannerInfo.id);

        if (!billboard.group.visible) {
          billboard.group.visible = true;
          billboard.onShow();
        }

        let opacity = 1.0;
        if (distance > fadeDistance) {
          opacity = 1.0 - (distance - fadeDistance) / (fadeStartDistance - fadeDistance);
          opacity = Math.max(0, Math.min(1, opacity));
        }

        this.setBillboardOpacity(bannerInfo.id, billboard, opacity);
        this.updateBillboardLOD(billboard, distance);
      } else if (billboard.group.visible) {
        billboard.group.visible = false;
        billboard.onHide();
        this.billboardOpacities.delete(bannerInfo.id);
      }
    }

    this.visibleBanners = newVisibleBanners;
  }

  private setBillboardOpacity(bannerId: string, billboard: Billboard, opacity: number) {
    // Quantize to avoid floating-point churn (256 steps is more than enough)
    const quantized = Math.round(opacity * 256) / 256;
    const prev = this.billboardOpacities.get(bannerId);
    if (prev === quantized) return;

    this.billboardOpacities.set(bannerId, quantized);
    billboard.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (!child.material.userData.originalOpacity) {
          child.material.userData.originalOpacity = child.material.opacity || 1.0;
        }
        child.material.opacity = child.material.userData.originalOpacity * quantized;
        child.material.transparent = true;
        child.material.needsUpdate = true;
      }
    });
  }

  private updateBillboardLOD(billboard: Billboard, distance: number) {
    if (distance < 0.05) billboard.setLOD(0);
    else if (distance < 0.1) billboard.setLOD(0);
    else billboard.setLOD(0);
  }

  // ---------------------------------------------------------------------------
  // Caption system — pure JS opacity lerp, zero DOM thrash
  // ---------------------------------------------------------------------------

  private updateCaption(currentPosition: { roadId: string; t: number }, dt: number) {
    if (!this.captionEl) return;

    const FADE_SPEED = 3.0;
    const HOLD_DURATION = 2.0;

    // 1. Find which caption range we're in (cyclic-aware)
    const ranges = this.captionRanges.get(currentPosition.roadId);
    let activeRange: CaptionRange | null = null;
    if (ranges) {
      for (const r of ranges) {
        const dist = this.tDistance(currentPosition.t, r.center, currentPosition.roadId);
        if (dist <= r.radius) {
          activeRange = r;
          break;
        }
      }
    }

    // 2. Decide target state
    if (activeRange) {
      this.captionHoldTime = HOLD_DURATION;

      if (activeRange.bannerId === this.captionActiveBannerId) {
        this.captionTarget = 1;
        this.captionPendingId = null;
      } else if (this.captionOpacity > 0.01) {
        // Fade out current, queue new
        this.captionPendingId = activeRange.bannerId;
        this.captionPendingText = activeRange.caption;
        this.captionTarget = 0;
      } else {
        // Nothing showing — set text and fade in
        this.captionActiveBannerId = activeRange.bannerId;
        this.captionEl.textContent = activeRange.caption;
        this.captionTarget = 1;
      }
    } else if (this.captionActiveBannerId) {
      this.captionHoldTime -= dt;
      if (this.captionHoldTime <= 0) {
        this.captionTarget = 0;
        this.captionPendingId = null;
      }
    }

    // 3. Lerp opacity
    if (this.captionOpacity !== this.captionTarget) {
      if (this.captionOpacity < this.captionTarget) {
        this.captionOpacity = Math.min(this.captionTarget, this.captionOpacity + FADE_SPEED * dt);
      } else {
        this.captionOpacity = Math.max(this.captionTarget, this.captionOpacity - FADE_SPEED * dt);
      }
      this.captionEl.style.opacity = String(this.captionOpacity);
    }

    // 4. When faded out — swap pending text or reset
    if (this.captionOpacity < 0.01) {
      if (this.captionPendingId) {
        this.captionEl.textContent = this.captionPendingText;
        this.captionActiveBannerId = this.captionPendingId;
        this.captionPendingId = null;
        this.captionPendingText = '';
        this.captionTarget = 1;
      } else if (this.captionTarget === 0) {
        this.captionActiveBannerId = null;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  getBannersAtPosition(roadId: string, t: number, threshold = 0.05) {
    return this.bannerData.filter(
      (banner) => banner.roadId === roadId && this.tDistance(t, banner.t, roadId) < threshold,
    );
  }

  addBanner(bannerInfo: BannerRenderData) {
    this.bannerData.push(bannerInfo);
    return this.createBillboard(bannerInfo);
  }

  removeBanner(bannerId: string) {
    const billboard = this.billboards.get(bannerId);
    if (billboard) {
      billboard.dispose();
      this.group.remove(billboard.group);
      this.billboards.delete(bannerId);
      this.visibleBanners.delete(bannerId);
      this.billboardOpacities.delete(bannerId);
      this.bannerData = this.bannerData.filter((b) => b.id !== bannerId);
    }
  }

  clear() {
    for (const [, billboard] of this.billboards) {
      billboard.dispose();
      this.group.remove(billboard.group);
    }
    this.billboards.clear();
    this.visibleBanners.clear();
    this.billboardOpacities.clear();
    this.bannerData = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
