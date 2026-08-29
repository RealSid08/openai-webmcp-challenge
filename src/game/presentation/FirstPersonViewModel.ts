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
    weapon.diffuseColor = new Color3(0.045, 0.055, 0.058);
    weapon.specularColor = new Color3(0.3, 0.34, 0.34);
    weapon.disableDepthWrite = true;
    const accent = new StandardMaterial('viewmodel-accent', scene);
    accent.diffuseColor = character === 'OWEN' ? new Color3(0.04, 0.34, 0.36) : new Color3(0.42, 0.18, 0.04);
    accent.emissiveColor = character === 'OWEN' ? new Color3(0.02, 0.12, 0.13) : new Color3(0.16, 0.05, 0.01);
    accent.disableDepthWrite = true;
    const glove = new StandardMaterial('viewmodel-glove', scene);
    glove.diffuseColor = new Color3(0.055, 0.065, 0.065);
    glove.disableDepthWrite = true;

    this.part('gun-body', { width: 0.16, height: 0.18, depth: 0.58 }, new Vector3(0, 0, 0.32), weapon);
    this.part('gun-slide', { width: 0.13, height: 0.1, depth: 0.62 }, new Vector3(0, 0.1, 0.35), accent);
    this.part('gun-barrel', { width: 0.07, height: 0.07, depth: 0.42 }, new Vector3(0, 0.04, 0.72), weapon);
    this.part('rear-sight', { width: 0.1, height: 0.06, depth: 0.035 }, new Vector3(0, 0.18, 0.18), weapon);
    this.part('front-sight', { width: 0.03, height: 0.055, depth: 0.025 }, new Vector3(0, 0.17, 0.72), accent);
    this.part('hand-right', { width: 0.2, height: 0.22, depth: 0.28 }, new Vector3(0.08, -0.2, 0.12), glove);
    this.part('hand-left', { width: 0.22, height: 0.2, depth: 0.32 }, new Vector3(-0.2, -0.14, 0.38), glove);
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
  ): void {
    const mesh = MeshBuilder.CreateBox(name, size, this.scene);
    mesh.parent = this.root;
    mesh.position = position;
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
