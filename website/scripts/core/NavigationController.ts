import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { RoadSystem } from '../road/RoadSystem';
import { computeBannerGeometry } from '../../shared/banner-geometry';
import type { BannerRenderData } from '../../shared/types';

const CAR_X_OFFSET = -1.4;

const ATTENTION_RADIUS = 40;
const DOLLY_AMOUNT = 3.0;
const LOOK_STIFFNESS = 4.0;
const DOLLY_STIFFNESS = 3.0;

interface BannerAttentionZone {
  id: string;
  roadId: string;
  t: number;
  worldCenter: THREE.Vector3;
  faceNormal: THREE.Vector3;
  worldRadius: number;
  tRadius: number;
}

export class NavigationController {
  roadSystem: RoadSystem;
  camera: THREE.PerspectiveCamera;

  currentRoadId: string;
  currentT: number;
  speed: number;
  targetSpeed: number;
  maxSpeed: number;
  acceleration: number;
  deceleration: number;
  linearScrollMode: boolean;
  linearScrollSensitivity: number;

  cameraHeight: number;
  cameraDistance: number;
  cameraLookAhead: number;
  scrollAccumulator: number;
  scrollSensitivity: number;
  isScrolling: boolean;
  scrollTimeout: ReturnType<typeof setTimeout> | null;
  car: THREE.Group;
  keys: { forward: boolean; backward: boolean; left: boolean; right: boolean };
  instructionsPanel: HTMLElement | null;
  instructionsHidden: boolean;
  instructionsHideThreshold: number;

  inputEnabled: boolean;
  attentionZones: BannerAttentionZone[];
  zonesBuilt: boolean;
  firstFrame: boolean;
  smoothLookTarget: THREE.Vector3;
  smoothDollyOffset: THREE.Vector3;

  constructor(roadSystem: RoadSystem, camera: THREE.PerspectiveCamera) {
    this.roadSystem = roadSystem;
    this.camera = camera;

    this.currentRoadId = 'main';
    this.currentT = 0.0;
    this.speed = 0;
    this.targetSpeed = 0;
    this.maxSpeed = 0.01;
    this.acceleration = 0.1;
    this.deceleration = 0.1;

    this.linearScrollMode = true;
    this.linearScrollSensitivity = 0.00002;

    this.cameraHeight = 10;
    this.cameraDistance = 10;
    this.cameraLookAhead = 0.05;

    this.keys = { forward: false, backward: false, left: false, right: false };

    this.scrollAccumulator = 0;
    this.scrollSensitivity = 0.001;
    this.isScrolling = false;
    this.scrollTimeout = null;

    this.car = this.createCar();

    this.instructionsPanel = document.getElementById('instructions-panel');
    this.instructionsHidden = false;
    this.instructionsHideThreshold = 0.01;

    this.inputEnabled = false;
    this.attentionZones = [];
    this.zonesBuilt = false;
    this.firstFrame = true;
    this.smoothLookTarget = new THREE.Vector3();
    this.smoothDollyOffset = new THREE.Vector3();
    this.setupEventListeners();
  }

  private toVec3(pt: { x: number; z: number }, y = 0): THREE.Vector3 {
    return new THREE.Vector3(pt.x, y, pt.z);
  }

  createCar() {
    const group = new THREE.Group();

    const lineMaterial = new LineMaterial({
      color: 0x03a062,
      linewidth: 0.03,
      worldUnits: true,
      dashed: false,
    });

    const createLineSegmentsGeometry = (edgesGeometry: THREE.EdgesGeometry) => {
      const positions = edgesGeometry.attributes.position.array;
      const lineSegmentsGeometry = new LineSegmentsGeometry();
      lineSegmentsGeometry.setPositions(Array.from(positions));
      return lineSegmentsGeometry;
    };

    // Body
    const bodyGeometry = new THREE.BoxGeometry(2, 0.8, 4);
    const bodyEdges = new THREE.EdgesGeometry(bodyGeometry);
    const bodyWireframe = new LineSegments2(createLineSegmentsGeometry(bodyEdges), lineMaterial);
    bodyWireframe.position.y = 0.8;
    bodyWireframe.layers.set(1);
    group.add(bodyWireframe);

    // Cabin
    const cabinGeometry = new THREE.BoxGeometry(1.6, 1, 2.5);
    const cabinEdges = new THREE.EdgesGeometry(cabinGeometry);
    const cabinWireframe = new LineSegments2(createLineSegmentsGeometry(cabinEdges), lineMaterial);
    cabinWireframe.position.y = 1.7;
    cabinWireframe.position.z = -0.3;
    cabinWireframe.layers.set(1);
    group.add(cabinWireframe);

    // Wheels
    const wheelRadius = 0.4;
    const wheelWidth = 0.3;
    const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 4);
    const wheelPositions = [
      { x: -1.1, z: 1.3 },
      { x: 1.1, z: 1.3 },
      { x: -1.1, z: -1.3 },
      { x: 1.1, z: -1.3 },
    ];

    wheelPositions.forEach((pos) => {
      const wheelEdges = new THREE.EdgesGeometry(wheelGeometry);
      const wheelWireframe = new LineSegments2(createLineSegmentsGeometry(wheelEdges), lineMaterial);
      wheelWireframe.position.set(pos.x, wheelRadius, pos.z);
      wheelWireframe.rotation.z = Math.PI / 2;
      wheelWireframe.layers.set(3);
      group.add(wheelWireframe);
    });

    group.scale.set(0.8, 0.8, 0.8);
    group.position.x = CAR_X_OFFSET;

    const wrappingGroup = new THREE.Group();
    wrappingGroup.add(group);
    this.roadSystem.scene.add(wrappingGroup);
    return wrappingGroup;
  }

  setupEventListeners() {
    window.addEventListener('keydown', (e) => {
      if (this.inputEnabled) this.handleKeyDown(e);
    });
    window.addEventListener('keyup', (e) => {
      if (this.inputEnabled) this.handleKeyUp(e);
    });
    window.addEventListener('wheel', (e) => {
      if (this.inputEnabled) this.handleWheel(e);
    }, { passive: false });

    let touchStartY = 0;
    let isTouchScrolling = false;

    window.addEventListener('touchstart', (e) => {
      if (!this.inputEnabled) return;
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        isTouchScrolling = true;
      } else if (e.touches.length === 2) {
        touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        isTouchScrolling = true;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.inputEnabled || !isTouchScrolling) return;
      if (e.touches.length === 1) {
        e.preventDefault();
        const currentY = e.touches[0].clientY;
        const delta = touchStartY - currentY;
        this.handleScroll(delta * 6);
        touchStartY = currentY;
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const delta = touchStartY - currentY;
        this.handleScroll(delta * 12);
        touchStartY = currentY;
      }
    }, { passive: false });

    window.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) isTouchScrolling = false;
    });
  }

  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp': case 'w': case 'W':
        this.keys.forward = true; event.preventDefault(); break;
      case 'ArrowDown': case 's': case 'S':
        this.keys.backward = true; event.preventDefault(); break;
      case 'ArrowLeft': case 'a': case 'A':
        this.keys.left = true; event.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D':
        this.keys.right = true; event.preventDefault(); break;
    }
  }

  handleKeyUp(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp': case 'w': case 'W': this.keys.forward = false; break;
      case 'ArrowDown': case 's': case 'S': this.keys.backward = false; break;
      case 'ArrowLeft': case 'a': case 'A': this.keys.left = false; break;
      case 'ArrowRight': case 'd': case 'D': this.keys.right = false; break;
    }
  }

  handleWheel(event: WheelEvent) {
    event.preventDefault();
    this.handleScroll(event.deltaY);
  }

  handleScroll(delta: number) {
    if (this.linearScrollMode) {
      this.currentT += delta * this.linearScrollSensitivity;
      this.wrapOrClampT();
      this.updateCarPosition();
      this.updateCameraPosition(1 / 60);
    } else {
      this.scrollAccumulator += delta * this.scrollSensitivity;
      this.isScrolling = true;
      if (this.scrollTimeout) clearTimeout(this.scrollTimeout);
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
        this.scrollAccumulator = 0;
      }, 150);
    }
  }

  update(deltaTime: number) {
    if (this.linearScrollMode) {
      if (this.keys.forward) this.currentT += this.maxSpeed * deltaTime;
      else if (this.keys.backward) this.currentT -= this.maxSpeed * 0.5 * deltaTime;
    } else {
      if (this.keys.forward || this.scrollAccumulator > 0) {
        this.targetSpeed = this.maxSpeed;
      } else if (this.keys.backward || this.scrollAccumulator < 0) {
        this.targetSpeed = -this.maxSpeed * 0.5;
      } else {
        this.targetSpeed = 0;
      }

      if (this.isScrolling) {
        const scrollSpeed = Math.sign(this.scrollAccumulator) *
          Math.min(Math.abs(this.scrollAccumulator), this.maxSpeed);
        this.targetSpeed = scrollSpeed;
      }

      if (Math.abs(this.targetSpeed - this.speed) > 0.001) {
        const accel = this.targetSpeed > this.speed ? this.acceleration : this.deceleration;
        this.speed += (this.targetSpeed - this.speed) * accel;
      } else {
        this.speed = this.targetSpeed;
      }

      this.currentT += this.speed * deltaTime;
    }

    this.wrapOrClampT();
    this.updateCarPosition();
    this.updateCameraPosition(deltaTime);
    this.updateInstructionsVisibility();
  }

  private isRoadCyclic(): boolean {
    const road = this.roadSystem.getRoad(this.currentRoadId);
    return road ? road.isCyclic : false;
  }

  private wrapOrClampT() {
    if (this.isRoadCyclic()) {
      this.currentT = ((this.currentT % 1) + 1) % 1;
    } else {
      if (this.currentT > 1) {
        const junctions = this.roadSystem.getJunctionsAtPosition(
          this.currentRoadId, 1, 0.1,
        );
        if (junctions.length > 0 && this.keys.right) {
          const jn = junctions[0];
          const result = this.roadSystem.switchRoad(jn.toRoad, jn.toT);
          if (result) {
            this.currentRoadId = jn.toRoad;
            this.currentT = result.startT;
          }
        } else {
          this.currentT = 0;
        }
      } else if (this.currentT < 0) {
        this.currentT = 0;
        this.speed = 0;
      }
    }
  }

  updateInstructionsVisibility() {
    if (!this.instructionsHidden && this.currentT >= this.instructionsHideThreshold) {
      if (this.instructionsPanel) {
        this.instructionsPanel.classList.add('hidden');
        this.instructionsHidden = true;
      }
    }
  }

  updateCarPosition() {
    const road = this.roadSystem.getRoad(this.currentRoadId);
    if (!road) return;

    const pt = road.getPoint(this.currentT);
    const tan = road.getTangent(this.currentT);
    const position = this.toVec3(pt);
    const tangent = this.toVec3(tan);

    this.car.position.copy(position);
    const lookAtPoint = position.clone().add(tangent);
    this.car.lookAt(lookAtPoint);

    const app = (window as any).app;
    if (app?.sceneManager?.updateGroundPosition) {
      app.sceneManager.updateGroundPosition(pt.x, pt.z);
    }
  }

  private buildAttentionZones(): void {
    const app = (window as any).app;
    if (!app?.bannerManager) return;

    const bannerData: BannerRenderData[] = app.bannerManager.bannerData;
    this.attentionZones = [];

    for (const banner of bannerData) {
      const road = this.roadSystem.getRoad(banner.roadId);
      if (!road) continue;

      const pt = road.getPoint(banner.t);
      const tan = road.getTangent(banner.t);
      const geo = computeBannerGeometry(pt, tan, {
        distance: banner.distance,
        elevation: banner.elevation,
        angle: banner.angle,
        size: banner.size,
        aspectRatio: banner.aspectRatio,
      });

      const roadLen = road.getLength();
      const tRadius = roadLen > 0 ? ATTENTION_RADIUS / roadLen : 0.05;

      // Face normal: direction the billboard faces (local +Z in world space)
      const faceNormal = new THREE.Vector3(
        Math.sin(geo.rotationY), 0, Math.cos(geo.rotationY),
      );

      this.attentionZones.push({
        id: banner.id,
        roadId: banner.roadId,
        t: banner.t,
        worldCenter: new THREE.Vector3(geo.pivotX, geo.elevation, geo.pivotZ),
        faceNormal,
        worldRadius: ATTENTION_RADIUS,
        tRadius,
      });
    }

    this.zonesBuilt = true;
  }

  private tDistanceCyclic(a: number, b: number, isCyclic: boolean): number {
    const d = Math.abs(a - b);
    return isCyclic ? Math.min(d, 1 - d) : d;
  }

  private smoothstep(x: number): number {
    const t = Math.max(0, Math.min(1, x));
    return t * t * (3 - 2 * t);
  }

  updateCameraPosition(deltaTime: number) {
    const road = this.roadSystem.getRoad(this.currentRoadId);
    if (!road) return;

    // Lazy pre-computation
    if (!this.zonesBuilt) this.buildAttentionZones();

    // Raw camera position (same formula as before)
    const currentPt = road.getPoint(this.currentT);
    const currentPos = this.toVec3(currentPt);
    const tan = road.getTangent(this.currentT);
    const tangent = this.toVec3(tan);

    const cameraOffset = tangent.clone().multiplyScalar(-this.cameraDistance);
    cameraOffset.y = this.cameraHeight;
    const rawCameraPos = currentPos.clone().add(cameraOffset);

    // Default look-ahead target
    let lookAheadT = this.currentT + this.cameraLookAhead;
    if (road.isCyclic) {
      lookAheadT = ((lookAheadT % 1) + 1) % 1;
    } else {
      lookAheadT = Math.min(lookAheadT, 1);
    }
    const defaultLookTarget = this.toVec3(road.getPoint(lookAheadT));

    // Find nearest banner attention zone
    let nearestZone: BannerAttentionZone | null = null;
    let nearestDist = Infinity;

    for (const zone of this.attentionZones) {
      if (zone.roadId !== this.currentRoadId) continue;
      const tDist = this.tDistanceCyclic(this.currentT, zone.t, road.isCyclic);
      if (tDist > zone.tRadius * 1.5) continue;
      const d = rawCameraPos.distanceTo(zone.worldCenter);
      if (d < zone.worldRadius && d < nearestDist) {
        nearestDist = d;
        nearestZone = zone;
      }
    }

    // Compute raw targets
    let rawLookTarget: THREE.Vector3;
    let rawDollyOffset: THREE.Vector3;

    if (nearestZone) {
      // Directional bias: only look at banners ahead, not behind
      const toCenterXZ = new THREE.Vector3(
        nearestZone.worldCenter.x - currentPos.x, 0,
        nearestZone.worldCenter.z - currentPos.z,
      ).normalize();
      const forwardDot = toCenterXZ.dot(tangent);
      // forwardDot >= 0.15: full attention (ahead)
      // forwardDot <= -0.15: zero (behind)
      const dirWeight = this.smoothstep((forwardDot + 0.15) / 0.3);

      const blendAlpha = (1 - this.smoothstep(nearestDist / nearestZone.worldRadius)) * dirWeight;
      rawLookTarget = defaultLookTarget.clone().lerp(nearestZone.worldCenter, blendAlpha);

      // Dolly: shift camera along the banner's face normal for a face-on view
      // This handles sharp-angled banners naturally
      rawDollyOffset = nearestZone.faceNormal.clone().multiplyScalar(DOLLY_AMOUNT * blendAlpha);
    } else {
      rawLookTarget = defaultLookTarget;
      rawDollyOffset = new THREE.Vector3();
    }

    // Smooth only look target & dolly (banner transitions), not camera position
    if (this.firstFrame) {
      this.smoothLookTarget.copy(rawLookTarget);
      this.smoothDollyOffset.copy(rawDollyOffset);
      this.firstFrame = false;
    } else {
      const lookAlpha = 1 - Math.exp(-LOOK_STIFFNESS * deltaTime);
      const dollyAlpha = 1 - Math.exp(-DOLLY_STIFFNESS * deltaTime);
      this.smoothLookTarget.lerp(rawLookTarget, lookAlpha);
      this.smoothDollyOffset.lerp(rawDollyOffset, dollyAlpha);
    }

    // Camera position rigidly follows the car, no damping
    this.camera.position.copy(rawCameraPos).add(this.smoothDollyOffset);
    this.camera.lookAt(this.smoothLookTarget);
  }

  getCurrentPosition() {
    return {
      roadId: this.currentRoadId,
      t: this.currentT,
      speed: this.speed,
    };
  }

  setPosition(roadId: string, t: number) {
    const road = this.roadSystem.getRoad(roadId);
    if (road) {
      this.currentRoadId = roadId;
      this.currentT = road.isCyclic ? ((t % 1) + 1) % 1 : Math.max(0, Math.min(1, t));
      this.speed = 0;
      this.targetSpeed = 0;
      this.scrollAccumulator = 0;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('wheel', this.handleWheel);

    this.car.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (child.material instanceof THREE.Material) child.material.dispose();
      }
    });

    if (this.car.parent) {
      this.car.parent.remove(this.car);
    }
  }
}
