import * as THREE from 'three';

import { type BannerInfo } from '../../constants/banner';
import { type HighwayBranch } from '../../constants/highway';
import { HighwaySystem } from '../highway/HighwaySystem';
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

  async load() {
    // Get highway system reference to position billboard
    const highwaySystem = (window as any).app?.highwaySystem as HighwaySystem;

    if (highwaySystem) {
      const branch = highwaySystem.getBranch(this.info.branch_id);
      if (branch) {
        const position = branch.getPoint(this.info.t);
        const normal = branch.getNormal(this.info.t);

        this.positionBillboard(position, normal);
      }
    }

    // Create billboard structure
    this.createFrame();
    await this.createBanner();
  }

  positionBillboard(roadPosition: THREE.Vector3, roadNormal: THREE.Vector3) {
    // Calculate billboard position
    const side = this.info.side === 'r' ? 1 : -1;
    const distance = this.info.distance;

    const offset = roadNormal.clone().multiplyScalar(side);
    this.group.position.copy(roadPosition).add(offset);

    // Raise billboard above ground based on elevation parameter
    // Default elevation is 4 if not specified
    const elevation = this.info.elevation;
    this.group.position.y += elevation;

    // Rotate billboard
    const angleRaw = this.info.angle || 0;
    const angle =
      // if side is right, multiply by -1 to make it negative
      ((this.info.side === 'r' ? -angleRaw : angleRaw) * Math.PI) / 180;

    this.group.rotation.y =
      Math.atan2(roadNormal.x, roadNormal.z) + (Math.PI / 2) * side + angle;
  }

  createFrame() {
    const size = this.info.size;
    const aspectRatio = this.info.aspectRatio;

    // Get padding values (default to 0.2 if not specified)
    const padX = this.info.padX;
    const padY = this.info.padY;

    // Calculate dimensions with padding
    const bannerWidth = size * aspectRatio;
    const bannerHeight = size;
    const frameWidth = bannerWidth + padX * 2;
    const frameHeight = bannerHeight + padY * 2;

    // Create frame geometry
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White frames
      roughness: 0.8,
      metalness: 0.2,
      emissive: 0xffffff, // White glow on frames
      emissiveIntensity: 0.1,
    });

    // Frame bar thickness
    const barThickness = 0.3;

    // Top bar
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(
        frameWidth + barThickness,
        barThickness,
        barThickness
      ),
      frameMaterial
    );

    topBar.position.y = frameHeight / 2;
    topBar.castShadow = true;
    topBar.layers.set(1); // Environment layer (gets dithered)
    this.group.add(topBar);

    // Bottom bar
    const bottomBar = new THREE.Mesh(
      new THREE.BoxGeometry(
        frameWidth + barThickness,
        barThickness,
        barThickness
      ),
      frameMaterial
    );
    bottomBar.position.y = -frameHeight / 2;
    bottomBar.castShadow = true;
    bottomBar.layers.set(1); // Environment layer (gets dithered)
    this.group.add(bottomBar);

    // Side bars
    const sideBar = new THREE.BoxGeometry(
      barThickness,
      frameHeight,
      barThickness
    );

    const leftBar = new THREE.Mesh(sideBar, frameMaterial);
    leftBar.position.x = -frameWidth / 2;
    leftBar.castShadow = true;
    leftBar.layers.set(1); // Environment layer (gets dithered)
    this.group.add(leftBar);

    const rightBar = new THREE.Mesh(sideBar, frameMaterial);
    rightBar.position.x = frameWidth / 2;
    rightBar.castShadow = true;
    rightBar.layers.set(1); // Environment layer (gets dithered)
    this.group.add(rightBar);

    // Support legs - use elevation parameter for leg height
    const legHeight = this.info.elevation;
    const totalLegHeight = frameHeight / 2 + legHeight;

    const legGeometry = new THREE.BoxGeometry(
      barThickness,
      totalLegHeight,
      barThickness
    );
    const legMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff, // White frames
      roughness: 0.8,
      metalness: 0.2,
      emissive: 0xffffff, // White glow on frames
      emissiveIntensity: 0.1,
    });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(
      -frameWidth / 2,
      -(frameHeight / 2 + totalLegHeight / 2),
      0
    );
    leftLeg.castShadow = true;
    leftLeg.layers.set(1); // Environment layer (gets dithered)

    this.group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(
      frameWidth / 2 - 1,
      -(frameHeight / 2 + totalLegHeight / 2),
      0
    );
    rightLeg.castShadow = true;
    rightLeg.layers.set(1); // Environment layer (gets dithered)
    // this.group.add(rightLeg);
  }

  async createBanner() {
    const size = this.info.size;
    const aspectRatio = this.info.aspectRatio;
    const bannerWidth = size * aspectRatio;
    const bannerHeight = size;

    // Create banner geometry (banner size is independent of padding)
    const bannerGeometry = new THREE.PlaneGeometry(bannerWidth, bannerHeight);

    // Load texture or video
    let material;
    if (this.info.animatedBannerVideo) {
      material = await this.createVideoMaterial(this.info.animatedBannerVideo);
    } else if (this.info.bannerImageFile) {
      material = await this.createImageMaterial(this.info.bannerImageFile);
    } else {
      // Default placeholder material
      material = new THREE.MeshBasicMaterial({
        color: 0xff00ff,
        side: THREE.DoubleSide,
      });
    }

    this.bannerMesh = new THREE.Mesh(bannerGeometry, material);
    this.bannerMesh.position.z = 0.01; // Slightly in front of frame

    // Set banner to layer 2 (no dithering, full color)
    this.bannerMesh.layers.set(2);

    // Flip the banner horizontally if it's on the right side
    // This corrects the mirroring that happens due to rotation
    if (this.info.side === 'r') {
      this.bannerMesh.scale.x = -1;
    }

    this.group.add(this.bannerMesh);
  }

  async createImageMaterial(imagePath: string) {
    try {
      const texture = await this.assetLoader.loadTexture(imagePath);
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.anisotropy = 16;

      return new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
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
      // Load video using AssetLoader
      const video = await this.assetLoader.loadVideo(videoPath);

      // Create video texture
      this.videoTexture = new THREE.VideoTexture(video);
      this.videoTexture.minFilter = THREE.LinearFilter;
      this.videoTexture.magFilter = THREE.LinearFilter;
      this.videoTexture.format = THREE.RGBAFormat;

      // Store video element for playback control
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
    // Create a checkerboard pattern as placeholder
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
    // Update video texture if present
    if (this.videoTexture && this.videoElement) {
      if (this.videoElement.readyState >= this.videoElement.HAVE_CURRENT_DATA) {
        this.videoTexture.needsUpdate = true;
      }
    }
  }

  onShow() {
    // Start video playback when billboard becomes visible
    if (this.videoElement && this.videoElement.paused) {
      this.videoElement.play().catch((e) => {
        console.warn('Video autoplay failed:', e);
      });
    }
  }

  onHide() {
    // Pause video when billboard is hidden
    if (this.videoElement && !this.videoElement.paused) {
      this.videoElement.pause();
    }
  }

  setLOD(level: number) {
    this.currentLOD = level;

    // Adjust texture quality based on LOD

    if (
      !this.bannerMesh ||
      !(this.bannerMesh.material instanceof THREE.MeshStandardMaterial)
    ) {
      return;
    }

    if (this.bannerMesh && this.bannerMesh.material.map) {
      const texture = this.bannerMesh.material.map;

      switch (level) {
        case 0: // High quality
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.anisotropy = 16;
          break;
        case 1: // Medium quality
          texture.minFilter = THREE.LinearMipmapNearestFilter;
          texture.anisotropy = 8;
          break;
        case 2: // Low quality
          texture.minFilter = THREE.NearestFilter;
          texture.anisotropy = 1;
          break;
      }
    }
  }

  dispose() {
    // Dispose of video element
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.src = '';
      this.videoElement = null;
    }

    // Dispose of textures and materials
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
