import * as THREE from 'three';

import type { BannerInfo } from '@/constants/types';
import type { HighwaySystem } from '../highway/HighwaySystem';
import { AssetLoader } from '../utils/AssetLoader';

export class Billboard {
  info: BannerInfo;
  assetLoader: AssetLoader;
  group: THREE.Group;
  bannerMesh: THREE.Mesh | null;
  frameMesh: THREE.Mesh | null;
  videoTexture: THREE.VideoTexture | null;
  videoElement: HTMLVideoElement | null;
  currentLOD: number;

  constructor(bannerInfo: BannerInfo, assetLoader: AssetLoader) {
    this.info = bannerInfo;
    this.assetLoader = assetLoader;

    this.group = new THREE.Group();
    this.bannerMesh = null;
    this.frameMesh = null;
    this.videoTexture = null;
    this.videoElement = null;
    this.currentLOD = 0;
  }

  async load(highwaySystem: HighwaySystem) {
    const branch = highwaySystem.getBranch(this.info.branch_id);
    if (branch) {
      const position = branch.getPoint(this.info.t);
      const normal = branch.getNormal(this.info.t);
      this.positionBillboard(position, normal);
    }

    this.createFrame();
    await this.createBanner();
  }

  positionBillboard(roadPosition: THREE.Vector3, roadNormal: THREE.Vector3) {
    const side = this.info.side === 'r' ? 1 : -1;
    const distance = this.info.distance;

    const offset = roadNormal.clone().multiplyScalar(side * distance);
    this.group.position.copy(roadPosition).add(offset);

    const elevation = this.info.elevation;
    this.group.position.y += elevation;

    const angleRaw = this.info.angle || 0;
    const angle =
      ((this.info.side === 'r' ? -angleRaw : angleRaw) * Math.PI) / 180;

    this.group.rotation.y =
      Math.atan2(roadNormal.x, roadNormal.z) + (Math.PI / 2) * side + angle;
  }

  createFrame() {
    const size = this.info.size;
    const aspectRatio = this.info.aspectRatio;
    const padX = this.info.padX;
    const padY = this.info.padY;

    const bannerWidth = size * aspectRatio;
    const bannerHeight = size;
    const frameWidth = bannerWidth + padX * 2;
    const frameHeight = bannerHeight + padY * 2;

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x03a062,
      linewidth: 2,
    });

    const barThickness = 0.3;

    const horizontalBarGeometry = new THREE.BoxGeometry(
      frameWidth + barThickness,
      barThickness,
      barThickness
    );
    const topBar = new THREE.LineSegments(horizontalBarGeometry, lineMaterial);
    topBar.position.y = frameHeight / 2;
    topBar.castShadow = true;
    topBar.layers.set(1);
    this.group.add(topBar);

    const bottomBar = new THREE.LineSegments(
      horizontalBarGeometry,
      lineMaterial
    );
    bottomBar.position.y = -frameHeight / 2;
    bottomBar.castShadow = true;
    bottomBar.layers.set(1);
    this.group.add(bottomBar);

    const sideBarGeometry = new THREE.BoxGeometry(
      barThickness,
      frameHeight,
      barThickness
    );

    const leftBar = new THREE.LineSegments(sideBarGeometry, lineMaterial);
    leftBar.position.x = -frameWidth / 2;
    leftBar.castShadow = true;
    leftBar.layers.set(1);
    this.group.add(leftBar);

    const rightBar = new THREE.LineSegments(sideBarGeometry, lineMaterial);
    rightBar.position.x = frameWidth / 2;
    rightBar.castShadow = true;
    rightBar.layers.set(1);
    this.group.add(rightBar);

    const legHeight = this.info.elevation;
    const totalLegHeight = frameHeight / 2 + legHeight;

    const legGeometry = new THREE.BoxGeometry(
      barThickness,
      totalLegHeight,
      barThickness
    );

    const leftLeg = new THREE.LineSegments(legGeometry, lineMaterial);
    leftLeg.position.set(
      -frameWidth / 2,
      -(frameHeight / 2 + totalLegHeight / 2),
      0
    );
    leftLeg.castShadow = true;
    leftLeg.layers.set(1);
    this.group.add(leftLeg);
  }

  async createBanner() {
    const size = this.info.size;
    const aspectRatio = this.info.aspectRatio;
    const bannerWidth = size * aspectRatio;
    const bannerHeight = size;

    const bannerGeometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight);

    let material;
    if (this.info.videoFile) {
      material = await this.createVideoMaterial(this.info.videoFile);
    } else if (this.info.imageFile) {
      material = await this.createImageMaterial(this.info.imageFile);
    } else {
      material = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        side: THREE.DoubleSide,
      });
    }

    this.bannerMesh = new THREE.Mesh(bannerGeometry, material);
    this.bannerMesh.position.z = 0.01;
    this.bannerMesh.layers.set(2);

    if (this.info.side === 'r') {
      this.bannerMesh.scale.x = -1;
    }

    const halfWidth = bannerWidth / 2;
    const halfHeight = bannerHeight / 2;
    const framePoints = [
      new THREE.Vector3(-halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, -halfHeight, 0),
      new THREE.Vector3(halfWidth, halfHeight, 0),
      new THREE.Vector3(-halfWidth, halfHeight, 0),
    ];
    const bannerFrameGeometry = new THREE.BufferGeometry().setFromPoints(
      framePoints
    );
    const bannerFrameMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 0.03,
    });
    const bannerFrame = new THREE.LineLoop(
      bannerFrameGeometry,
      bannerFrameMaterial
    );
    bannerFrame.position.z = 0.01;
    bannerFrame.layers.set(1);
    bannerFrame.scale.set(
      1.0 + 0.01,
      1.0 + 0.01 * this.info.aspectRatio,
      1.0
    );
    this.group.add(bannerFrame);

    this.group.add(this.bannerMesh);
  }

  async createImageMaterial(imagePath: string) {
    try {
      const texture = await this.assetLoader.loadTexture(imagePath);
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      texture.anisotropy = 16;

      return new THREE.MeshStandardMaterial({
        map: texture,
        emissiveMap: texture,
        side: THREE.DoubleSide,
        emissive: 0xffffff,
        emissiveIntensity: this.info.emissiveIntensity,
        transparent: true,
        opacity: 1.0,
      });
    } catch (error) {
      console.error(`Failed to load banner image ${imagePath}:`, error);
      return this.createPlaceholderMaterial();
    }
  }

  async createVideoMaterial(videoPath: string) {
    try {
      const video = await this.assetLoader.loadVideo(videoPath);

      this.videoTexture = new THREE.VideoTexture(video);
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;
      this.videoTexture.format = THREE.RGBAFormat;

      this.videoElement = video;

      return new THREE.MeshBasicMaterial({
        map: this.videoTexture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      });
    } catch (error) {
      console.error(`Failed to load banner video ${videoPath}:`, error);
      return this.createPlaceholderMaterial();
    }
  }

  createPlaceholderMaterial() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const size = 32;
    for (let y = 0; y < canvas.height; y += size) {
      for (let x = 0; x < canvas.width; x += size) {
        ctx.fillStyle = ((x + y) / size) % 2 === 0 ? '#ff00ff' : '#ffff00';
        ctx.fillRect(x, y, size, size);
      }
    }

    ctx.fillStyle = '#000000';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BANNER', canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    return new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 1.0,
    });
  }

  update(deltaTime: number) {
    if (this.videoTexture && this.videoElement) {
      if (this.videoElement.readyState >= this.videoElement.HAVE_CURRENT_DATA) {
        this.videoTexture.needsUpdate = true;
      }
    }
  }

  onShow() {
    if (this.videoElement && this.videoElement.paused) {
      this.videoElement.play().catch((e) => {
        console.warn('Video autoplay failed:', e);
      });
    }
  }

  onHide() {
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }
  }

  setLOD(level: number) {
    this.currentLOD = level;

    if (
      !this.bannerMesh ||
      !(this.bannerMesh.material instanceof THREE.MeshStandardMaterial)
    ) {
      return;
    }

    if (this.bannerMesh && this.bannerMesh.material.map) {
      const texture = this.bannerMesh.material.map;

      switch (level) {
        case 0:
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 16;
          break;
        case 1:
          texture.minFilter = THREE.LinearMipmapNearestFilter;
          texture.anisotropy = 8;
          break;
        case 2:
          texture.minFilter = THREE.NearestFilter;
          texture.anisotropy = 1;
          break;
      }
    }
  }

  dispose() {
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }

    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry)
        child.geometry.dispose();
      if (
        child instanceof THREE.Mesh &&
        child.material instanceof THREE.MeshStandardMaterial
      ) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
