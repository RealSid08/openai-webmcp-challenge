export type EnemyState =
  | 'SEEK'
  | 'MOVE_TO_COVER'
  | 'ACQUIRE'
  | 'TELEGRAPH'
  | 'BURST'
  | 'RECOVER'
  | 'REPOSITION'
  | 'PRESS'
  | 'RETREAT'
  | 'DEAD';

export interface TacticalPoint {
  x: number;
  z: number;
}

export interface EnemyTargetSnapshot {
  id: 'OWEN' | 'CODY';
  position: TacticalPoint;
  health: number;
  moving: boolean;
  exposed: boolean;
}

export interface EnemyCoverSnapshot {
  id: string;
  position: TacticalPoint;
  occupied: boolean;
  exposure: number;
}

export interface EnemyWorldSnapshot {
  targets: readonly EnemyTargetSnapshot[];
  covers: readonly EnemyCoverSnapshot[];
  tutorialProtected: boolean;
  hasLineOfSight: (enemyId: string, targetId: 'OWEN' | 'CODY') => boolean;
}

export interface EnemyAgentState {
  id: string;
  position: TacticalPoint;
  state: EnemyState;
  stateTime: number;
  coverId: string | null;
  targetId: 'OWEN' | 'CODY' | null;
  burstShotsRemaining: number;
  shotCooldown: number;
}

export type EnemyCommand =
  | { type: 'MOVE_TO'; enemyId: string; destination: TacticalPoint; speed: number }
  | { type: 'FACE_TARGET'; enemyId: string; targetId: 'OWEN' | 'CODY' }
  | { type: 'BEGIN_TELEGRAPH'; enemyId: string; targetId: 'OWEN' | 'CODY' }
  | {
      type: 'FIRE_SHOT';
      enemyId: string;
      targetId: 'OWEN' | 'CODY';
      shotId: string;
      hit: boolean;
      damage: number;
    };

interface EnemyDirectorOptions {
  random?: () => number;
}

function distanceSquared(left: TacticalPoint, right: TacticalPoint): number {
  const x = left.x - right.x;
  const z = left.z - right.z;
  return x * x + z * z;
}

export class EnemyDirector {
  private readonly agents = new Map<string, EnemyAgentState>();
  private readonly random: () => number;
  private shotSequence = 0;

  constructor(options: EnemyDirectorOptions = {}) {
    this.random = options.random ?? Math.random;
  }

  register(input: {
    id: string;
    position: TacticalPoint;
    state?: EnemyState;
    stateTime?: number;
  }): void {
    this.agents.set(input.id, {
      id: input.id,
      position: input.position,
      state: input.state ?? 'SEEK',
      stateTime: input.stateTime ?? 0,
      coverId: null,
      targetId: null,
      burstShotsRemaining: 0,
      shotCooldown: 0,
    });
  }

  getState(id: string): EnemyAgentState | null {
    return this.agents.get(id) ?? null;
  }

  syncPosition(id: string, position: TacticalPoint): void {
    const agent = this.agents.get(id);
    if (agent) agent.position = position;
  }

  markDead(id: string): void {
    const agent = this.agents.get(id);
    if (agent) agent.state = 'DEAD';
  }

  update(world: EnemyWorldSnapshot, deltaSeconds: number): readonly EnemyCommand[] {
    const dt = Math.min(Math.max(deltaSeconds, 0), 0.25);
    const commands: EnemyCommand[] = [];
    for (const agent of this.agents.values()) {
      if (agent.state === 'DEAD') continue;
      agent.stateTime += dt;
      const target = this.chooseTarget(world.targets);
      if (!target) continue;
      agent.targetId = target.id;
      const visible = world.hasLineOfSight(agent.id, target.id);

      if (world.tutorialProtected && (agent.state === 'TELEGRAPH' || agent.state === 'BURST')) {
        agent.state = 'ACQUIRE';
        agent.stateTime = 0;
        commands.push({ type: 'FACE_TARGET', enemyId: agent.id, targetId: target.id });
        continue;
      }

      switch (agent.state) {
        case 'SEEK':
        case 'REPOSITION': {
          const cover = this.chooseCover(agent, world.covers);
          if (!cover) {
            agent.state = 'ACQUIRE';
            agent.stateTime = 0;
            break;
          }
          agent.coverId = cover.id;
          agent.state = 'MOVE_TO_COVER';
          agent.stateTime = 0;
          commands.push({ type: 'MOVE_TO', enemyId: agent.id, destination: cover.position, speed: 2.1 });
          break;
        }
        case 'MOVE_TO_COVER': {
          const cover = world.covers.find((candidate) => candidate.id === agent.coverId);
          if (!cover || distanceSquared(agent.position, cover.position) <= 0.7 * 0.7) {
            agent.state = 'ACQUIRE';
            agent.stateTime = 0;
          } else {
            commands.push({ type: 'MOVE_TO', enemyId: agent.id, destination: cover.position, speed: 2.1 });
          }
          break;
        }
        case 'ACQUIRE':
        case 'PRESS': {
          if (!visible) {
            agent.state = 'REPOSITION';
            agent.stateTime = 0;
            break;
          }
          agent.state = 'TELEGRAPH';
          agent.stateTime = 0;
          commands.push({ type: 'FACE_TARGET', enemyId: agent.id, targetId: target.id });
          commands.push({ type: 'BEGIN_TELEGRAPH', enemyId: agent.id, targetId: target.id });
          break;
        }
        case 'TELEGRAPH':
          if (!visible) {
            agent.state = 'REPOSITION';
            agent.stateTime = 0;
          } else if (agent.stateTime >= 0.65) {
            agent.state = 'BURST';
            agent.stateTime = 0;
            agent.burstShotsRemaining = 3;
            agent.shotCooldown = 0;
          }
          break;
        case 'BURST': {
          if (!visible) {
            agent.state = 'REPOSITION';
            agent.stateTime = 0;
            agent.burstShotsRemaining = 0;
            break;
          }
          agent.shotCooldown -= dt;
          if (agent.shotCooldown > 0 || agent.burstShotsRemaining <= 0) break;
          const shotIndex = 3 - agent.burstShotsRemaining;
          const distance = Math.sqrt(distanceSquared(agent.position, target.position));
          const accuracy = Math.min(
            0.82,
            Math.max(0.18, 0.42 + shotIndex * 0.14 - (target.moving ? 0.12 : 0) - distance * 0.012),
          );
          const roll = this.random();
          agent.burstShotsRemaining -= 1;
          agent.shotCooldown = 0.22;
          commands.push({
            type: 'FIRE_SHOT',
            enemyId: agent.id,
            targetId: target.id,
            shotId: `enemy-shot-${++this.shotSequence}`,
            hit: roll < accuracy,
            damage: 5 + Math.floor(roll * 3),
          });
          if (agent.burstShotsRemaining === 0) {
            agent.state = 'RECOVER';
            agent.stateTime = 0;
          }
          break;
        }
        case 'RECOVER':
          if (agent.stateTime >= 0.9) {
            agent.state = 'REPOSITION';
            agent.stateTime = 0;
          }
          break;
        case 'RETREAT': {
          const cover = this.chooseCover(agent, world.covers);
          if (cover) commands.push({ type: 'MOVE_TO', enemyId: agent.id, destination: cover.position, speed: 2.5 });
          break;
        }
      }
    }
    return commands;
  }

  private chooseTarget(targets: readonly EnemyTargetSnapshot[]): EnemyTargetSnapshot | null {
    return [...targets]
      .filter((target) => target.health > 0)
      .sort((left, right) =>
        Number(right.exposed) - Number(left.exposed) || left.health - right.health,
      )[0] ?? null;
  }

  private chooseCover(
    agent: EnemyAgentState,
    covers: readonly EnemyCoverSnapshot[],
  ): EnemyCoverSnapshot | null {
    return [...covers]
      .filter(
        (cover) =>
          (!cover.occupied || cover.id === agent.coverId) &&
          ![...this.agents.values()].some(
            (other) => other.id !== agent.id && other.state !== 'DEAD' && other.coverId === cover.id,
          ),
      )
      .sort((left, right) =>
        left.exposure + distanceSquared(agent.position, left.position) * 0.004 -
        (right.exposure + distanceSquared(agent.position, right.position) * 0.004),
      )[0] ?? null;
  }
}
