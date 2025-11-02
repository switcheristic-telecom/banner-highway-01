import * as THREE from 'three';
import { Billboard } from './Billboard.js';
import { type Scene } from 'three';
import { type AssetLoader } from '../utils/AssetLoader.js';
import { BannerInfo } from '@/constants/banner.js';

export class BannerManager {
  scene: Scene;
  assetLoader: AssetLoader;
  billboards: Map<string, Billboard>;
  bannerData: BannerInfo[];
  visibleBanners: Set<string>;
  group: THREE.Group;
  viewDistance: number;
  lodDistances: number[];

  constructor(scene: Scene, assetLoader: AssetLoader) {
    this.scene = scene;
    this.assetLoader = assetLoader;

    this.billboards = new Map(); // Map of bannerId -> Billboard
    this.bannerData = [];
    this.visibleBanners = new Set();

    this.group = new THREE.Group();
    this.group.name = 'BannerManager';
    this.scene.add(this.group);

    // Visibility settings
    this.viewDistance = 50; // Distance at which banners become visible
    this.lodDistances = [20, 40, 80]; // LOD distances
  }

  async loadBanners(bannerInfos: BannerInfo[]) {
    this.bannerData = bannerInfos;

    // Group banners by branch for efficient loading
    const bannersByBranch = this.groupBannersByBranch(bannerInfos);

    // Create billboards for each banner
    for (const [branchId, banners] of bannersByBranch) {
      for (const banner of banners) {
        await this.createBillboard(banner);
      }
    }
  }

  groupBannersByBranch(bannerInfos: BannerInfo[]) {
    const grouped = new Map();

    for (const banner of bannerInfos) {
      if (!grouped.has(banner.branch_id)) {
        grouped.set(banner.branch_id, []);
      }
      grouped.get(banner.branch_id).push(banner);
    }

    return grouped;
  }

  async createBillboard(bannerInfo: BannerInfo) {
    const billboard = new Billboard(bannerInfo, this.assetLoader);
    await billboard.load();

    // Layers are now set directly in Billboard.js
    // Banner mesh: layer 2 (no dithering)
    // Frame parts: layer 1 (with dithering)

    this.billboards.set(
      bannerInfo.id || `${bannerInfo.branch_id}_${bannerInfo.t}`,
      billboard
    );
    this.group.add(billboard.group);

    // Initially hide distant banners
    billboard.group.visible = false;

    return billboard;
  }

  update(deltaTime: number, currentPosition: { branchId: string; t: number }) {
    // Update visibility based on player position
    this.updateVisibility(currentPosition);

    // Update each visible billboard (for animations, video textures, etc.)
    for (const bannerId of this.visibleBanners) {
      const billboard = this.billboards.get(bannerId);
      if (billboard) {
        billboard.update(deltaTime);
      }
    }
  }

  updateVisibility(currentPosition: { branchId: string; t: number }) {
    const newVisibleBanners = new Set<string>();
    const fadeDistance = 0.15; // Distance at which banners are fully visible
    const fadeStartDistance = 0.25; // Distance at which banners start to fade in

    // Check each banner on the current branch
    const branchBanners = this.bannerData.filter(
      (b) => b.branch_id === currentPosition.branchId
    );

    for (const bannerInfo of branchBanners) {
      const bannerId =
        bannerInfo.id || `${bannerInfo.branch_id}_${bannerInfo.t}`;
      const billboard = this.billboards.get(bannerId);

      if (!billboard) continue;

      // Calculate distance along the spline
      const distance = Math.abs(currentPosition.t - bannerInfo.t);

      if (distance < fadeStartDistance) {
        newVisibleBanners.add(bannerId);

        // Make visible if not already
        if (!billboard.group.visible) {
          billboard.group.visible = true;
          billboard.onShow();
        }

        // Calculate opacity based on distance
        let opacity = 1.0;
        if (distance > fadeDistance) {
          // Fade in/out zone
          opacity =
            1.0 -
            (distance - fadeDistance) / (fadeStartDistance - fadeDistance);
          opacity = Math.max(0, Math.min(1, opacity)); // Clamp between 0 and 1
        }

        // Apply opacity to billboard
        this.updateBillboardOpacity(billboard, opacity);

        // Update LOD based on distance
        this.updateBillboardLOD(billboard, distance);
      } else if (billboard.group.visible) {
        billboard.group.visible = false;
        billboard.onHide();
      }
    }

    this.visibleBanners = newVisibleBanners;
  }

  updateBillboardOpacity(billboard: Billboard, opacity: number) {
    // Update opacity for all meshes in the billboard
    billboard.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Store original opacity if not already stored
        if (!child.material.userData.originalOpacity) {
          child.material.userData.originalOpacity =
            child.material.opacity || 1.0;
        }

        child.material.opacity =
          child.material.userData.originalOpacity * opacity;
        child.material.transparent = true;
        child.material.needsUpdate = true;
      }
    });
  }

  updateBillboardLOD(billboard: Billboard, distance: number) {
    // Simple LOD system
    if (distance < 0.05) {
      billboard.setLOD(0); // Highest quality
    } else if (distance < 0.1) {
      billboard.setLOD(0); // Medium quality
    } else {
      billboard.setLOD(0); // Low quality
    }
  }

  getBannersAtPosition(branchId: string, t: number, threshold = 0.05) {
    return this.bannerData.filter(
      (banner) =>
        banner.branch_id === branchId && Math.abs(banner.t - t) < threshold
    );
  }

  addBanner(bannerInfo: BannerInfo) {
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

      // Remove from data
      this.bannerData = this.bannerData.filter(
        (b) => (b.id || `${b.branch_id}_${b.t}`) !== bannerId
      );
    }
  }

  clear(): void {
    for (const [bannerId, billboard] of this.billboards) {
      billboard.dispose();
      this.group.remove(billboard.group);
    }

    this.billboards.clear();
    this.visibleBanners.clear();
    this.bannerData = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
