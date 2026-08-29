import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Scene } from '@babylonjs/core/scene';

import type { RuntimeEnemy } from '../RuntimeVisualFactory';
import type { EnemyCommand } from './EnemyDirector';

interface EnemyCombatCallbacks {
  onShot: (command: Extract<EnemyCommand, { type: 'FIRE_SHOT' }>) => void;
  onHit: (command: Extract<EnemyCommand, { type: 'FIRE_SHOT' }>) => void;
}

export class EnemyCombatRuntime {
  private readonly timers = new Set<number>();

  constructor(private readonly scene: Scene) {}

  apply(
    commands: readonly EnemyCommand[],
    enemies: readonly RuntimeEnemy[],
    targetPositions: Readonly<Record<'OWEN' | 'CODY', Vector3>>,
    deltaSeconds: number,
    callbacks: EnemyCombatCallbacks,
  ): void {
    for (const command of commands) {
      const enemy = enemies.find((candidate) => candidate.id === command.enemyId && candidate.alive);
      if (!enemy) continue;
      if (command.type === 'MOVE_TO') {
        const destination = new Vector3(command.destination.x, enemy.mesh.position.y, command.destination.z);
        const distance = Vector3.Distance(enemy.mesh.position, destination);
        const amount = distance <= 0.001 ? 1 : Math.min(1, (command.speed * deltaSeconds) / distance);
        enemy.mesh.position = Vector3.Lerp(enemy.mesh.position, destination, amount);
        continue;
      }
      if (command.type === 'FACE_TARGET') {
        this.face(enemy, targetPositions[command.targetId]);
        continue;
      }
      if (command.type === 'BEGIN_TELEGRAPH') {
        this.face(enemy, targetPositions[command.targetId]);
        this.telegraph(enemy);
        continue;
      }
      this.face(enemy, targetPositions[command.targetId]);
      this.renderShot(enemy, targetPositions[command.targetId], command.hit, command.shotId);
      callbacks.onShot(command);
      if (command.hit) callbacks.onHit(command);
    }
  }

  dispose(): void {
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
  }

  private face(enemy: RuntimeEnemy, target: Vector3): void {
    const offset = target.subtract(enemy.mesh.position);
    enemy.mesh.rotation.y = Math.atan2(offset.x, offset.z);
  }

  private telegraph(enemy: RuntimeEnemy): void {
    const origin = enemy.muzzle.getAbsolutePosition();
    const light = new PointLight(`enemy-warning-${enemy.id}-${performance.now()}`, origin, this.scene);
    light.diffuse = new Color3(1, 0.08, 0.025);
    light.intensity = 6;
    light.range = 5;
    this.disposeAfter(light, 180);
  }

  private renderShot(enemy: RuntimeEnemy, target: Vector3, hit: boolean, shotId: string): void {
    const origin = enemy.muzzle.getAbsolutePosition();
    const missSign = shotId.charCodeAt(shotId.length - 1) % 2 === 0 ? 1 : -1;
    const end = hit ? target : target.add(new Vector3(1.4 * missSign, 0.65, 0.4 * -missSign));
    const tracer = MeshBuilder.CreateLines(
      `tracer-${shotId}`,
      { points: [origin, end], updatable: false },
      this.scene,
    );
    tracer.color = hit ? new Color3(1, 0.31, 0.08) : new Color3(1, 0.72, 0.22);
    tracer.isPickable = false;
    const flash = new PointLight(`enemy-flash-${shotId}`, origin, this.scene);
    flash.diffuse = new Color3(1, 0.28, 0.04);
    flash.intensity = 10;
    flash.range = 7;
    this.disposeAfter(tracer, 90);
    this.disposeAfter(flash, 55);
  }

  private disposeAfter(resource: { dispose(): void }, milliseconds: number): void {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      resource.dispose();
    }, milliseconds);
    this.timers.add(timer);
  }
}
