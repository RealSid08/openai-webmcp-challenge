import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import type { CharacterId } from './MissionStore';
import type { WorldPoint } from './worldLayout';

export interface RuntimeEnemy {
  id: string;
  mesh: Mesh;
  muzzle: Mesh;
  health: number;
  alive: boolean;
}

interface HumanoidPalette {
  suit: StandardMaterial;
  accent: StandardMaterial;
  gear: StandardMaterial;
  visor: StandardMaterial;
}

export class RuntimeVisualFactory {
  private readonly materialCache = new Map<string, StandardMaterial>();

  constructor(private readonly scene: Scene) {}

  createCharacter(id: CharacterId, point: WorldPoint | Vector3): Mesh {
    const position = point instanceof Vector3 ? point : new Vector3(point.x, point.y, point.z);
    const owen = id === 'OWEN';
    const palette: HumanoidPalette = {
      suit: this.material(
        owen ? 'ally-owen-suit' : 'ally-cody-suit',
        owen ? new Color3(0.04, 0.16, 0.18) : new Color3(0.16, 0.1, 0.05),
        0.7,
      ),
      accent: this.material(
        owen ? 'ally-owen-accent' : 'ally-cody-accent',
        owen ? new Color3(0.05, 0.34, 0.36) : new Color3(0.42, 0.2, 0.05),
        0.5,
        owen ? new Color3(0.04, 0.22, 0.24) : new Color3(0.28, 0.1, 0.02),
      ),
      gear: this.material(owen ? 'ally-owen-gear' : 'ally-cody-gear', new Color3(0.05, 0.06, 0.06), 0.88),
      visor: this.material(
        owen ? 'ally-owen-visor' : 'ally-cody-visor',
        owen ? new Color3(0.08, 0.55, 0.52) : new Color3(0.55, 0.32, 0.08),
        0.3,
        owen ? new Color3(0.06, 0.4, 0.4) : new Color3(0.4, 0.18, 0.04),
      ),
    };
    return this.createHumanoid(`partner-${id}`, position, 0.95, palette, { pickable: false });
  }

  createEnemy(id: string, point: WorldPoint): RuntimeEnemy {
    const palette: HumanoidPalette = {
      suit: this.material('enemy-suit', new Color3(0.09, 0.045, 0.04), 0.78),
      accent: this.material('enemy-plate', new Color3(0.12, 0.05, 0.04), 0.7),
      gear: this.material('enemy-gear', new Color3(0.04, 0.035, 0.035), 0.9),
      visor: this.material('enemy-visor', new Color3(0.42, 0.04, 0.03), 0.35, new Color3(0.38, 0.02, 0.01)),
    };
    const mesh = this.createHumanoid(id, new Vector3(point.x, point.y, point.z), 1, palette, {
      pickable: true,
      enemyId: id,
    });
    const muzzle = this.box(
      `${id}-muzzle`,
      { width: 0.05, height: 0.05, depth: 0.05 },
      new Vector3(0.32, 0.08, 0.82),
      this.material('enemy-muzzle', new Color3(0.8, 0.15, 0.03), 0.1, new Color3(0.9, 0.08, 0.01)),
      false,
    );
    muzzle.parent = mesh;
    muzzle.visibility = 0;
    muzzle.isPickable = false;
    return { id, mesh, muzzle, health: 100, alive: true };
  }

  createPursuer(id: string, point: WorldPoint): RuntimeEnemy {
    const body = this.material('pursuer-body', new Color3(0.08, 0.04, 0.035), 0.62);
    const glass = this.material('pursuer-glass', new Color3(0.08, 0.03, 0.03), 0.4, new Color3(0.08, 0.01, 0.01));
    const tail = this.material('pursuer-tail', new Color3(0.4, 0.05, 0.03), 0.3, new Color3(0.45, 0.04, 0.02));
    const mesh = this.box(id, { width: 2.3, height: 0.85, depth: 4.6 }, new Vector3(point.x, 0.72, point.z), body, false);
    this.tagEnemy(mesh, id);
    const cabin = this.box(`${id}-cabin`, { width: 2, height: 0.62, depth: 1.8 }, new Vector3(0, 0.58, 0.15), glass, false);
    cabin.parent = mesh;
    const spoiler = this.box(`${id}-spoiler`, { width: 2.1, height: 0.1, depth: 0.28 }, new Vector3(0, 0.55, -2.05), body, false);
    spoiler.parent = mesh;
    for (const x of [-0.75, 0.75]) {
      const lamp = this.box(`${id}-tail-${x}`, { width: 0.42, height: 0.14, depth: 0.1 }, new Vector3(x, 0.12, -2.28), tail, false);
      lamp.parent = mesh;
      this.tagEnemy(lamp, id);
    }
    this.tagEnemy(cabin, id);
    const muzzle = this.box(`${id}-muzzle`, { width: 0.08, height: 0.08, depth: 0.08 }, new Vector3(0, 0.55, 2.35), tail, false);
    muzzle.parent = mesh;
    muzzle.visibility = 0;
    muzzle.isPickable = false;
    return { id, mesh, muzzle, health: 100, alive: true };
  }

  createCover(name: string, node: WorldPoint, index: number): void {
    const steel = this.material('steel', new Color3(0.07, 0.1, 0.11), 0.72);
    const rust = this.material('rust', new Color3(0.28, 0.12, 0.04), 0.9);
    const dark = this.material('dark-steel', new Color3(0.022, 0.032, 0.034), 0.88);
    const stripe = this.material('cover-stripe', new Color3(0.42, 0.22, 0.05), 0.6, new Color3(0.18, 0.08, 0.01));
    const width = index % 2 === 0 ? 3.2 : 2.4;
    const body = this.box(name, { width, height: 1.32, depth: 1.28 }, new Vector3(node.x, 0.66, node.z), index % 2 === 0 ? steel : rust, true);
    this.box(`${name}-lip`, { width: width + 0.18, height: 0.12, depth: 1.42 }, new Vector3(node.x, 1.34, node.z), dark, true);
    this.box(`${name}-stripe`, { width: width * 0.7, height: 0.08, depth: 0.08 }, new Vector3(node.x, 0.72, node.z + 0.66), stripe, false);
    if (index % 2 === 0) {
      this.box(`${name}-crate`, { width: 0.9, height: 0.7, depth: 0.7 }, new Vector3(node.x - width * 0.28, 1.72, node.z), rust, true);
    } else {
      this.box(`${name}-vent`, { width: 0.55, height: 0.4, depth: 0.4 }, new Vector3(node.x + 0.6, 1.62, node.z), dark, false);
    }
    body.isPickable = true;
  }

  placeFacilityProps(
    steel: StandardMaterial,
    darkSteel: StandardMaterial,
    rust: StandardMaterial,
    panel: StandardMaterial,
  ): void {
    const crate = this.material('prop-crate', new Color3(0.16, 0.12, 0.07), 0.92);
    for (const [index, point] of [
      { x: -8.4, z: 4 },
      { x: 8.3, z: 9 },
      { x: -8.2, z: 28 },
      { x: 8.4, z: 32 },
      { x: -8.3, z: 46 },
      { x: 8.2, z: 48 },
    ].entries()) {
      this.box(`crate-${index}`, { width: 1.15, height: 1.05, depth: 1.05 }, new Vector3(point.x, 0.52, point.z), crate, true);
      if (index % 2 === 0) {
        this.box(`crate-top-${index}`, { width: 0.85, height: 0.55, depth: 0.85 }, new Vector3(point.x + 0.1, 1.32, point.z), rust, true);
      }
    }
    for (const [index, z] of [6, 16, 34, 44].entries()) {
      const drum = MeshBuilder.CreateCylinder(`drum-${index}`, { diameter: 0.72, height: 1.05, tessellation: 12 }, this.scene);
      drum.position = new Vector3(index % 2 === 0 ? 8.55 : -8.55, 0.52, z);
      drum.material = rust;
      drum.checkCollisions = true;
      drum.isPickable = false;
    }
    this.box('cabinet-a', { width: 1.4, height: 2.2, depth: 0.55 }, new Vector3(-8.7, 1.1, 14), panel, true);
    this.box('cabinet-b', { width: 1.4, height: 2.2, depth: 0.55 }, new Vector3(8.7, 1.1, 38), panel, true);
    this.box('vent-a', { width: 2.4, height: 0.7, depth: 1.1 }, new Vector3(-8.6, 6.4, 12), darkSteel, false);
    this.box('vent-b', { width: 2.4, height: 0.7, depth: 1.1 }, new Vector3(8.6, 6.4, 40), darkSteel, false);
    this.box('conduit-l', { width: 0.1, height: 3.4, depth: 0.1 }, new Vector3(-9.55, 2.4, 10), steel, false);
    this.box('conduit-r', { width: 0.1, height: 3.4, depth: 0.1 }, new Vector3(9.55, 2.4, 40), steel, false);
  }

  buildBlastGate(
    darkSteel: StandardMaterial,
    steel: StandardMaterial,
    rust: StandardMaterial,
    amber: StandardMaterial,
  ): Mesh {
    this.box('gate-frame-l', { width: 1.1, height: 7.4, depth: 1.15 }, new Vector3(-9.2, 3.5, 52), rust, true);
    this.box('gate-frame-r', { width: 1.1, height: 7.4, depth: 1.15 }, new Vector3(9.2, 3.5, 52), rust, true);
    this.box('gate-lintel', { width: 20, height: 0.85, depth: 1.2 }, new Vector3(0, 7.15, 52), steel, true);
    this.box('gate-track-l', { width: 0.22, height: 6.6, depth: 0.22 }, new Vector3(-8.4, 3.3, 51.35), steel, false);
    this.box('gate-track-r', { width: 0.22, height: 6.6, depth: 0.22 }, new Vector3(8.4, 3.3, 51.35), steel, false);
    const gate = this.box('blast-gate', { width: 16.8, height: 6.5, depth: 0.55 }, new Vector3(0, 3.25, 52), darkSteel, true);
    this.box('gate-bar', { width: 16.4, height: 0.18, depth: 0.08 }, new Vector3(0, 0.15, -0.32), amber, false).parent = gate;
    this.box('gate-bar-2', { width: 16.4, height: 0.18, depth: 0.08 }, new Vector3(0, -1.4, -0.32), amber, false).parent = gate;
    for (const x of [-4, 0, 4]) {
      this.box(`gate-chevron-${x}`, { width: 1.1, height: 0.7, depth: 0.08 }, new Vector3(x, 0.9, -0.32), amber, false).parent = gate;
    }
    this.box('gate-signal', { width: 0.28, height: 4.8, depth: 0.1 }, new Vector3(0, 3.5, 51.55), amber, false);
    this.box('charge-plate', { width: 1.1, height: 0.16, depth: 0.7 }, new Vector3(0, 0.1, 48.5), rust, false);
    return gate;
  }

  box(
    name: string,
    size: { width: number; height: number; depth: number },
    position: Vector3,
    material: StandardMaterial,
    collision: boolean,
  ): Mesh {
    const mesh = MeshBuilder.CreateBox(name, size, this.scene);
    mesh.position = position;
    mesh.material = material;
    mesh.checkCollisions = collision;
    mesh.isPickable = collision;
    return mesh;
  }

  material(
    name: string,
    color: Color3,
    roughness: number,
    emissive = Color3.Black(),
  ): StandardMaterial {
    const cached = this.materialCache.get(name);
    if (cached) return cached;
    const material = new StandardMaterial(name, this.scene);
    material.diffuseColor = color;
    material.specularColor = Color3.White().scale(1 - roughness);
    material.specularPower = 28 + (1 - roughness) * 40;
    material.emissiveColor = emissive;
    this.materialCache.set(name, material);
    return material;
  }

  private createHumanoid(
    name: string,
    origin: Vector3,
    rootY: number,
    palette: HumanoidPalette,
    options: { pickable: boolean; enemyId?: string },
  ): Mesh {
    const root = MeshBuilder.CreateBox(`${name}-root`, { width: 0.64, height: 1.9, depth: 0.5 }, this.scene);
    root.position = new Vector3(origin.x, origin.y + rootY, origin.z);
    root.material = palette.suit;
    root.visibility = 0;
    root.checkCollisions = true;
    root.isPickable = options.pickable;
    if (options.enemyId) this.tagEnemy(root, options.enemyId);

    const attach = (
      suffix: string,
      size: { width: number; height: number; depth: number },
      local: Vector3,
      material: StandardMaterial,
    ): Mesh => {
      const part = MeshBuilder.CreateBox(`${name}-${suffix}`, size, this.scene);
      part.position = local;
      part.material = material;
      part.parent = root;
      part.checkCollisions = false;
      part.isPickable = options.pickable;
      if (options.enemyId) this.tagEnemy(part, options.enemyId);
      else part.isPickable = false;
      return part;
    };

    attach('torso', { width: 0.5, height: 0.64, depth: 0.32 }, new Vector3(0, 0.18, 0.02), palette.suit);
    attach('plastron', { width: 0.4, height: 0.28, depth: 0.12 }, new Vector3(0, 0.26, 0.18), palette.accent);
    attach('shoulders', { width: 0.62, height: 0.16, depth: 0.28 }, new Vector3(0, 0.46, 0), palette.accent);
    attach('hips', { width: 0.46, height: 0.2, depth: 0.28 }, new Vector3(0, -0.2, 0), palette.gear);
    attach('leg-l', { width: 0.18, height: 0.7, depth: 0.2 }, new Vector3(-0.14, -0.58, 0.02), palette.gear);
    attach('leg-r', { width: 0.18, height: 0.7, depth: 0.2 }, new Vector3(0.14, -0.58, 0.02), palette.gear);
    attach('boot-l', { width: 0.18, height: 0.1, depth: 0.3 }, new Vector3(-0.14, -0.9, 0.08), palette.gear);
    attach('boot-r', { width: 0.18, height: 0.1, depth: 0.3 }, new Vector3(0.14, -0.9, 0.08), palette.gear);
    attach('arm-l', { width: 0.14, height: 0.58, depth: 0.16 }, new Vector3(-0.36, 0.1, 0), palette.suit);
    attach('arm-r', { width: 0.14, height: 0.58, depth: 0.16 }, new Vector3(0.36, 0.1, 0), palette.suit);
    attach('weapon', { width: 0.08, height: 0.1, depth: 0.72 }, new Vector3(0.32, 0.06, 0.42), palette.gear);

    const head = MeshBuilder.CreateSphere(`${name}-head`, { diameter: 0.3, segments: 8 }, this.scene);
    head.position = new Vector3(0, 0.72, 0.02);
    head.material = palette.gear;
    head.parent = root;
    head.checkCollisions = false;
    head.isPickable = options.pickable;
    if (options.enemyId) this.tagEnemy(head, options.enemyId);
    else head.isPickable = false;
    attach('visor', { width: 0.26, height: 0.1, depth: 0.08 }, new Vector3(0, 0.74, 0.16), palette.visor);
    attach('helm', { width: 0.32, height: 0.12, depth: 0.3 }, new Vector3(0, 0.86, 0.02), palette.gear);
    return root;
  }

  private tagEnemy(mesh: Mesh, id: string): void {
    mesh.metadata = { kind: 'enemy', id };
    mesh.isPickable = true;
  }
}
