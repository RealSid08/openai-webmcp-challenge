import type { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';

import type { CharacterId } from '../MissionStore';

export interface ViewModelPoseInput {
  sprint: number;
  aim: number;
  bob: number;
  sway: number;
  reload: number;
  recoil: number;
}

export interface ViewModelPose {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * Math.min(Math.max(amount, 0), 1);
}

export function computeViewModelPose(input: ViewModelPoseInput): ViewModelPose {
  const sprint = Math.min(Math.max(input.sprint, 0), 1) * (1 - input.aim);
  const aim = Math.min(Math.max(input.aim, 0), 1);
  const reloadWave = Math.sin(Math.PI * Math.min(Math.max(input.reload, 0), 1));
  const hip = { x: 0.29, y: -0.3, z: 0.62 };
  const sprintPosition = { x: 0.4, y: -0.48, z: 0.48 };
  const position = {
    x: mix(mix(hip.x, sprintPosition.x, sprint), 0, aim) + input.sway,
    y: mix(mix(hip.y, sprintPosition.y, sprint), -0.22, aim) + input.bob - reloadWave * 0.24,
    z: mix(mix(hip.z, sprintPosition.z, sprint), 0.47, aim) - input.recoil * 0.08,
  };
  return {
    position,
    rotation: {
      x: sprint * 0.48 - input.recoil * 0.13 + reloadWave * 0.22,
      y: sprint * -0.16 * (1 - aim),
      z: sprint * -0.2 + reloadWave * 0.78,
    },
  };
}

export function integrateRecoil(recoil: number, deltaSeconds: number): number {
  return Math.max(0, recoil - Math.max(deltaSeconds, 0) * 7.5);
}

export class FirstPersonViewModel {
  private readonly root: TransformNode;
  private readonly muzzlePosition = new Vector3(0, 0.03, 0.72);
  private recoil = 0;
  private reloadRemaining = 0;
  private readonly timers = new Set<number>();

  constructor(
    private readonly scene: Scene,
    camera: UniversalCamera,
    character: CharacterId,
  ) {
    this.root = new TransformNode('first-person-viewmodel', scene);
    this.root.parent = camera;

    const weapon = new StandardMaterial('viewmodel-weapon', scene);
    weapon.diffuseColor = new Color3(0.035, 0.047, 0.05);
    weapon.specularColor = new Color3(0.24, 0.29, 0.29);
    weapon.disableDepthWrite = true;
    const accent = new StandardMaterial('viewmodel-accent', scene);
    accent.diffuseColor = character === 'OWEN' ? new Color3(0.035, 0.24, 0.26) : new Color3(0.34, 0.14, 0.035);
    accent.emissiveColor = character === 'OWEN' ? new Color3(0.012, 0.065, 0.07) : new Color3(0.08, 0.025, 0.005);
    accent.disableDepthWrite = true;
    const glove = new StandardMaterial('viewmodel-glove', scene);
    glove.diffuseColor = new Color3(0.045, 0.055, 0.055);
    glove.disableDepthWrite = true;

    this.part('gun-frame', { width: 0.17, height: 0.15, depth: 0.46 }, new Vector3(0, 0.005, 0.34), weapon);
    this.part('gun-slide', { width: 0.145, height: 0.105, depth: 0.58 }, new Vector3(0, 0.115, 0.42), weapon);
    this.part('slide-signal', { width: 0.151, height: 0.022, depth: 0.3 }, new Vector3(0, 0.174, 0.34), accent);
    this.part('ejection-port', { width: 0.08, height: 0.012, depth: 0.12 }, new Vector3(0.038, 0.174, 0.47), glove);
    this.part('gun-grip', { width: 0.135, height: 0.31, depth: 0.17 }, new Vector3(0, -0.19, 0.18), weapon, { x: -0.16 });
    this.cylinderPart('gun-barrel', 0.055, 0.4, new Vector3(0, 0.07, 0.75), weapon, { x: Math.PI / 2 });
    this.cylinderPart('muzzle-crown', 0.075, 0.035, new Vector3(0, 0.07, 0.94), accent, { x: Math.PI / 2 });
    this.part('rear-sight', { width: 0.105, height: 0.052, depth: 0.035 }, new Vector3(0, 0.19, 0.18), weapon);
    this.part('front-sight', { width: 0.028, height: 0.05, depth: 0.025 }, new Vector3(0, 0.19, 0.68), accent);

    // Angular forearms make the low-poly silhouette read as a supported two-hand grip,
    // rather than two floating cubes beside the weapon.
    this.part('forearm-right', { width: 0.2, height: 0.22, depth: 0.5 }, new Vector3(0.16, -0.3, -0.02), glove, { x: -0.34, y: -0.12, z: -0.08 });
    this.part('hand-right', { width: 0.18, height: 0.2, depth: 0.24 }, new Vector3(0.045, -0.19, 0.17), glove, { x: -0.16 });
    this.part('forearm-left', { width: 0.2, height: 0.2, depth: 0.5 }, new Vector3(-0.23, -0.27, 0.08), glove, { x: -0.48, y: 0.18, z: 0.08 });
    this.part('hand-left', { width: 0.2, height: 0.18, depth: 0.26 }, new Vector3(-0.12, -0.11, 0.43), glove, { x: -0.18, y: 0.16 });
  }

  update(input: Omit<ViewModelPoseInput, 'reload' | 'recoil'>, deltaSeconds: number): void {
    this.recoil = integrateRecoil(this.recoil, deltaSeconds);
    this.reloadRemaining = Math.max(0, this.reloadRemaining - Math.max(deltaSeconds, 0));
    const reload = this.reloadRemaining > 0 ? 1 - this.reloadRemaining / 0.9 : 0;
    const pose = computeViewModelPose({ ...input, reload, recoil: this.recoil });
    const targetPosition = new Vector3(pose.position.x, pose.position.y, pose.position.z);
    const targetRotation = new Vector3(pose.rotation.x, pose.rotation.y, pose.rotation.z);
    const amount = Math.min(1, Math.max(deltaSeconds, 0) * 16);
    this.root.position = Vector3.Lerp(this.root.position, targetPosition, amount);
    this.root.rotation = Vector3.Lerp(this.root.rotation, targetRotation, amount);
  }

  playFire(): void {
    this.recoil = Math.min(1.25, this.recoil + 1);
    const origin = Vector3.TransformCoordinates(this.muzzlePosition, this.root.getWorldMatrix());
    const light = new PointLight(`viewmodel-flash-${performance.now()}`, origin, this.scene);
    light.diffuse = new Color3(1, 0.52, 0.12);
    light.intensity = 7;
    light.range = 5;
    this.disposeAfter(light, 50);
  }

  playReload(): void {
    this.reloadRemaining = 0.9;
  }

  setVisible(visible: boolean): void {
    this.root.setEnabled(visible);
  }

  dispose(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.root.dispose(false, true);
  }

  private part(
    name: string,
    size: { width: number; height: number; depth: number },
    position: Vector3,
    material: StandardMaterial,
    rotation: { x?: number; y?: number; z?: number } = {},
  ): void {
    const mesh = MeshBuilder.CreateBox(name, size, this.scene);
    mesh.parent = this.root;
    mesh.position = position;
    mesh.rotation = new Vector3(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
    mesh.material = material;
    mesh.renderingGroupId = 2;
    mesh.isPickable = false;
  }

  private cylinderPart(
    name: string,
    diameter: number,
    height: number,
    position: Vector3,
    material: StandardMaterial,
    rotation: { x?: number; y?: number; z?: number } = {},
  ): void {
    const mesh = MeshBuilder.CreateCylinder(name, { diameter, height, tessellation: 10 }, this.scene);
    mesh.parent = this.root;
    mesh.position = position;
    mesh.rotation = new Vector3(rotation.x ?? 0, rotation.y ?? 0, rotation.z ?? 0);
    mesh.material = material;
    mesh.renderingGroupId = 2;
    mesh.isPickable = false;
  }

  private disposeAfter(resource: { dispose(): void }, milliseconds: number): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      resource.dispose();
    }, milliseconds);
    this.timers.add(timer);
  }
}
