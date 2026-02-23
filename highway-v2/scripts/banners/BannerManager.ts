import * as THREE from 'three';
import { Billboard } from './Billboard';
import type { AssetLoader } from '../utils/AssetLoader';
import type { RoadSystem } from '../road/RoadSystem';
import type { BannerRenderData } from '../../shared/types';

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

    this.group = new THREE.Group();
    this.group.name = 'BannerManager';
    this.scene.add(this.group);

    this.viewDistance = 50;
    this.lodDistances = [20, 40, 80];
  }

  async loadBanners(bannerInfos: BannerRenderData[]) {
    this.bannerData = bannerInfos;

    const bannersByRoad = this.groupBannersByRoad(bannerInfos);

    for (const [_roadId, banners] of bannersByRoad) {
      for (const banner of banners) {
        await this.createBillboard(banner);
      }
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

  update(deltaTime: number, currentPosition: { roadId: string; t: number }) {
    this.updateVisibility(currentPosition);

    for (const bannerId of this.visibleBanners) {
      const billboard = this.billboards.get(bannerId);
      if (billboard) {
        billboard.update(deltaTime);
      }
    }
  }

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

      const distance = Math.abs(currentPosition.t - bannerInfo.t);

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

        this.updateBillboardOpacity(billboard, opacity);
        this.updateBillboardLOD(billboard, distance);
      } else if (billboard.group.visible) {
        billboard.group.visible = false;
        billboard.onHide();
      }
    }

    this.visibleBanners = newVisibleBanners;
  }

  private updateBillboardOpacity(billboard: Billboard, opacity: number) {
    billboard.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        if (!child.material.userData.originalOpacity) {
          child.material.userData.originalOpacity = child.material.opacity || 1.0;
        }
        child.material.opacity = child.material.userData.originalOpacity * opacity;
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

  getBannersAtPosition(roadId: string, t: number, threshold = 0.05) {
    return this.bannerData.filter(
      (banner) => banner.roadId === roadId && Math.abs(banner.t - t) < threshold,
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
    this.bannerData = [];
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
