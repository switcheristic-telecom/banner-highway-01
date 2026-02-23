import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

import { RoadSystem } from '../road/RoadSystem';

const CAR_X_OFFSET = -1.4;

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

  bannerLookThreshold: number;
  bannerLookInterpolation: number;

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

    this.bannerLookThreshold = 0.02;
    this.bannerLookInterpolation = 0.5;

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
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    window.addEventListener('wheel', (e) => this.handleWheel(e), { passive: false });

    let touchStartY = 0;
    let isTouchScrolling = false;

    window.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartY = e.touches[0].clientY;
        isTouchScrolling = true;
      } else if (e.touches.length === 2) {
        touchStartY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        isTouchScrolling = true;
      }
    });

    window.addEventListener('touchmove', (e) => {
      if (!isTouchScrolling) return;
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
      this.updateCameraPosition();
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
    this.updateCameraPosition();
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

  updateCameraPosition() {
    const road = this.roadSystem.getRoad(this.currentRoadId);
    if (!road) return;

    const currentPt = road.getPoint(this.currentT);
    const currentPos = this.toVec3(currentPt);

    let lookAheadT = this.currentT + this.cameraLookAhead;
    if (road.isCyclic) {
      lookAheadT = ((lookAheadT % 1) + 1) % 1;
    } else {
      lookAheadT = Math.min(lookAheadT, 1);
    }
    const lookAheadPt = road.getPoint(lookAheadT);
    const lookAheadPos = this.toVec3(lookAheadPt);

    const tan = road.getTangent(this.currentT);
    const tangent = this.toVec3(tan);

    const cameraOffset = tangent.clone().multiplyScalar(-this.cameraDistance);
    cameraOffset.y = this.cameraHeight;

    const targetCameraPos = currentPos.clone().add(cameraOffset);
    this.camera.position.copy(targetCameraPos);

    let lookTarget = lookAheadPos.clone();

    // Banner camera pivot
    const app = (window as any).app;
    if (app?.bannerManager) {
      const nearbyBanners = app.bannerManager.getBannersAtPosition(
        this.currentRoadId,
        this.currentT,
        this.bannerLookThreshold,
      );

      if (nearbyBanners.length > 0) {
        let closestBanner = nearbyBanners[0];
        let minDistance = Math.abs(closestBanner.t - this.currentT);

        for (const banner of nearbyBanners) {
          const distance = Math.abs(banner.t - this.currentT);
          if (distance < minDistance) {
            minDistance = distance;
            closestBanner = banner;
          }
        }

        const bannerRoadPt = road.getPoint(closestBanner.t);
        const bannerPosition = new THREE.Vector3(
          bannerRoadPt.x,
          closestBanner.elevation,
          bannerRoadPt.z,
        );

        const normalizedDistance = minDistance / this.bannerLookThreshold;
        let interpolationFactor = 1 - normalizedDistance;
        interpolationFactor = interpolationFactor < 0.5
          ? 4 * interpolationFactor * interpolationFactor * interpolationFactor
          : 1 - Math.pow(-2 * interpolationFactor + 2, 3) / 2;

        lookTarget.lerp(
          bannerPosition,
          interpolationFactor * this.bannerLookInterpolation,
        );
      }
    }

    this.camera.lookAt(lookTarget);
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
