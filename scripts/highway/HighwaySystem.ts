import * as THREE from 'three';

import { HighwayMesh } from './HighwayMesh';
import { HighwaySpline } from './HighwaySpline';
import {
  type HighwayData,
  type HighwayBranch,
  type HighwayExit,
  HIGHWAY_SYSTEM_DEFAULT_OPTIONS,
  HIGHWAY_MESH_DEFAULT_OPTIONS,
} from '@/constants/highway';

export class HighwaySystem {
  scene: THREE.Scene;
  branches: Map<string, HighwaySpline>;
  meshes: Map<string, HighwayMesh>;
  exits: HighwayExit[];
  currentBranch: string | null;
  showEdge: boolean;
  showBlock: boolean;
  group: THREE.Group;
  edgeGroup: THREE.Group;
  blockGroup: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.branches = new Map(); // Map of branch_id -> HighwaySpline
    this.meshes = new Map(); // Map of branch_id -> HighwayMesh
    this.exits = []; // Exit points between branches
    this.currentBranch = null;

    // Toggle settings
    this.showEdge = HIGHWAY_SYSTEM_DEFAULT_OPTIONS.showEdge;
    this.showBlock = HIGHWAY_SYSTEM_DEFAULT_OPTIONS.showBlock;

    // Groups for different elements
    this.group = new THREE.Group();
    this.group.name = 'HighwaySystem';
    this.edgeGroup = new THREE.Group();
    this.edgeGroup.name = 'EdgeLines';
    // this.edgeGroup.visible = this.showEdge;
    this.blockGroup = new THREE.Group();
    this.blockGroup.name = 'Blocks';
    this.blockGroup.visible = this.showBlock;

    this.group.add(this.edgeGroup);
    this.group.add(this.blockGroup);
    this.scene.add(this.group);
  }

  async loadHighwayData(data: HighwayData) {
    // Clear existing highway
    this.clear();

    // Process branches
    for (const branch of data.branches) {
      this.createBranch(branch);
    }

    // Process exits/connections
    if (data.exits) {
      this.exits = data.exits;
      this.createExitMarkers();
    }

    // Set initial branch
    if (data.branches.length > 0) {
      this.currentBranch = data.branches[0].id;
    }
  }

  createBranch(branchData: HighwayBranch) {
    // Create spline from points
    const spline = new HighwaySpline(
      branchData.points.map(
        (point) => new THREE.Vector3(point.x, point.y, point.z)
      ),
      branchData.id
    );
    this.branches.set(branchData.id, spline);

    const width =
      (branchData.widthFactor ?? 1) * HIGHWAY_MESH_DEFAULT_OPTIONS.width;
    const segments =
      (branchData.segmentsFactor ?? 1) * HIGHWAY_MESH_DEFAULT_OPTIONS.segments;

    // Create mesh for the highway
    const mesh = new HighwayMesh(spline, {
      width,
      segments,
      blockMaterial: HIGHWAY_MESH_DEFAULT_OPTIONS.blockNMaterial,
      edgeMaterial: HIGHWAY_MESH_DEFAULT_OPTIONS.edgeMaterial,
    });

    // Set layer for environment rendering
    mesh.blockMesh.layers.set(1); // Environment layer
    mesh.blockMesh.castShadow = true;
    mesh.blockMesh.receiveShadow = true;

    this.meshes.set(branchData.id, mesh);
    this.group.add(mesh.blockMesh);
    this.group.add(mesh.edgeLinesGroup);
    // Add edge lines to the edge group
    this.edgeGroup.add(mesh.edgeLinesGroup);
  }

  createHighwayMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0xffffff, // White road
      roughness: 0.8,
      metalness: 0.0,
      envMapIntensity: 0.5,
      emissive: 0xcccccc, // Light gray self-illumination
      emissiveIntensity: 0.3,
    });
  }

  createExitMarkers() {
    const markerGeometry = new THREE.ConeGeometry(1, 3, 8);
    const markerMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x00ff00,
      emissiveIntensity: 0.8, // Brighter exit markers
    });

    for (const exit of this.exits) {
      const fromBranch = this.branches.get(exit.fromBranch);
      const toBranch = this.branches.get(exit.toBranch);

      if (fromBranch && toBranch) {
        const exitPoint = fromBranch.getPoint(exit.fromT);

        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(exitPoint);
        marker.position.y += 3;
        marker.rotation.z = Math.PI;

        marker.userData = {
          type: 'exit',
          fromBranch: exit.fromBranch,
          toBranch: exit.toBranch,
          fromT: exit.fromT,
          toT: exit.toT || 0,
        };

        marker.layers.set(15); // Environment layer
        this.group.add(marker);
      }
    }
  }

  getBranch(branchId: string) {
    return this.branches.get(branchId);
  }

  getCurrentBranch() {
    return this.branches.get(this.currentBranch ?? '');
  }

  getExitsAtPosition(branchId: string, t: number, threshold = 0.05) {
    return this.exits.filter(
      (exit) =>
        exit.fromBranch === branchId && Math.abs(exit.fromT - t) < threshold
    );
  }

  switchBranch(newBranchId: string, startT = 0) {
    if (this.branches.has(newBranchId)) {
      this.currentBranch = newBranchId;
      return { branch: this.branches.get(newBranchId), startT };
    }
    return null;
  }

  getPositionOnHighway(branchId: string, t: number) {
    const branch = this.branches.get(branchId ?? '');
    if (!branch) return null;

    return {
      position: branch.getPoint(t),
      tangent: branch.getTangent(t),
      normal: branch.getNormal(t),
      up: new THREE.Vector3(0, 1, 0),
    };
  }

  // Toggle methods for edge lines and blocks
  toggleEdgeLines(show: boolean) {
    this.showEdge = show !== undefined ? show : !this.showEdge;
    this.edgeGroup.visible = this.showEdge;
    return this.showEdge;
  }

  toggleBlocks(show: boolean) {
    this.showBlock = show !== undefined ? show : !this.showBlock;
    this.blockGroup.visible = this.showBlock;
    return this.showBlock;
  }

  setEdgeVisibility(visible: boolean) {
    this.showEdge = visible;
    this.edgeGroup.visible = visible;
  }

  setBlockVisibility(visible: boolean) {
    this.showBlock = visible;
    this.blockGroup.visible = visible;
  }

  update(deltaTime: number) {
    // Update any animated elements (future feature)
    // For example, animated exit markers, flowing traffic, etc.
  }

  clear() {
    // Clear edge group
    while (this.edgeGroup.children.length > 0) {
      const child = this.edgeGroup.children[0];
      if (child instanceof THREE.Mesh && child.geometry)
        child.geometry.dispose();
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.edgeGroup.remove(child);
    }

    // Clear block group
    while (this.blockGroup.children.length > 0) {
      const child = this.blockGroup.children[0];
      if (child instanceof THREE.Mesh && child.geometry)
        child.geometry.dispose();
      if (child instanceof THREE.Mesh && child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.blockGroup.remove(child);
    }

    // Remove other children from main group (but keep edgeGroup and blockGroup)
    const childrenToRemove = [];
    for (let i = 0; i < this.group.children.length; i++) {
      const child = this.group.children[i];
      if (child !== this.edgeGroup && child !== this.blockGroup) {
        childrenToRemove.push(child);
      }
    }

    childrenToRemove.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
      this.group.remove(child);
    });

    // Clear internal state
    this.branches.clear();
    this.meshes.clear();
    this.exits = [];
    this.currentBranch = null;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
