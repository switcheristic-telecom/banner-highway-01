import * as THREE from 'three';
import { Billboard } from './Billboard';
import type { Scene } from 'three';
import type { AssetLoader } from '../utils/AssetLoader';
import type { HighwaySystem } from '../highway/HighwaySystem';
import type { BannerInfo } from '@/constants/types';

export class BannerManager {
  scene: Scene;
  assetLoader: AssetLoader;
  highwaySystem: HighwaySystem;
  billboards: Map<string, Billboard>;
  bannerData: BannerInfo[];
  visibleBanners: Set<string>;
  group: THREE.Group;
  viewDistance: number;
  lodDistances: number[];

  constructor(
    scene: Scene,
    assetLoader: AssetLoader,
    highwaySystem: HighwaySystem
  ) {
    this.scene = scene;
    this.assetLoader = assetLoader;
    this.highwaySystem = highwaySystem;

    this.billboards = new Map();
    this.bannerData = [];
    this.visibleBanners = new Set();

    this.group = new THREE.Group();
    this.group.name = 'BannerManager';
    this.scene.add(this.group);

    this.viewDistance = 50;
    this.lodDistances = [20, 40, 80];
  }

  async loadBanners(bannerInfos: BannerInfo[]) {
    this.bannerData = bannerInfos;

    const bannersByBranch = this.groupBannersByBranch(bannerInfos);

    for (const [_branchId, banners] of bannersByBranch) {
      for (const banner of banners) {
        await this.createBillboard(banner);
      }
    }
  }

  groupBannersByBranch(bannerInfos: BannerInfo[]) {
    const grouped = new Map<string, BannerInfo[]>();

    for (const banner of bannerInfos) {
      if (!grouped.has(banner.branch_id)) {
        grouped.set(banner.branch_id, []);
      }
      grouped.get(banner.branch_id)!.push(banner);
    }

    return grouped;
  }

  async createBillboard(bannerInfo: BannerInfo) {
    const billboard = new Billboard(bannerInfo, this.assetLoader);
    await billboard.load(this.highwaySystem);

    this.billboards.set(
      bannerInfo.id || `${bannerInfo.branch_id}_${bannerInfo.t}`,
      billboard
    );
    this.group.add(billboard.group);

    billboard.group.visible = false;

    return billboard;
  }

  update(deltaTime: number, currentPosition: { branchId: string; t: number }) {
    this.updateVisibility(currentPosition);

    for (const bannerId of this.visibleBanners) {
      const billboard = this.billboards.get(bannerId);
      if (billboard) {
        billboard.update(deltaTime);
      }
    }
  }

  updateVisibility(currentPosition: { branchId: string; t: number }) {
    const newVisibleBanners = new Set<string>();
    const fadeDistance = 0.15;
    const fadeStartDistance = 0.25;

    const branchBanners = this.bannerData.filter(
      (b) => b.branch_id === currentPosition.branchId
    );

    for (const bannerInfo of branchBanners) {
      const bannerId =
        bannerInfo.id || `${bannerInfo.branch_id}_${bannerInfo.t}`;
      const billboard = this.billboards.get(bannerId);

      if (!billboard) continue;

      const distance = Math.abs(currentPosition.t - bannerInfo.t);

      if (distance < fadeStartDistance) {
        newVisibleBanners.add(bannerId);

        if (!billboard.group.visible) {
          billboard.group.visible = true;
          billboard.onShow();
        }

        let opacity = 1.0;
        if (distance > fadeDistance) {
          opacity =
            1.0 -
            (distance - fadeDistance) / (fadeStartDistance - fadeDistance);
          opacity = Math.max(0, Math.min(1, opacity));
        }

        this.updateBillboardOpacity(billboard, opacity);
        this.updateBillboardLOD(billboard, distance);
      } else if (billboard.group.visible) {
        billboard.group.visible = false;
        billboard.onHide();
      }
    }

    this.visibleBanners = newVisibleBanners;
  }

  updateBillboardOpacity(billboard: Billboard, opacity: number) {
    billboard.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
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
    if (distance < 0.05) {
      billboard.setLOD(0);
    } else if (distance < 0.1) {
      billboard.setLOD(0);
    } else {
      billboard.setLOD(0);
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

      this.bannerData = this.bannerData.filter(
        (b) => (b.id || `${b.branch_id}_${b.t}`) !== bannerId
      );
    }
  }

  clear(): void {
    for (const [_bannerId, billboard] of this.billboards) {
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
