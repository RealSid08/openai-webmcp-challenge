import type { CharacterId } from './MissionStore';
import { clampMouseSensitivity } from './input/controlSettings';

export function computeMouseLookDelta(
  movement: Readonly<{ x: number; y: number }>,
  edgeTurn: Readonly<{ x: number; y: number }>,
  sensitivity: number,
  deltaSeconds: number,
): { yaw: number; pitch: number } {
  const multiplier = clampMouseSensitivity(sensitivity);
  return {
    yaw: (movement.x * 0.00165 + edgeTurn.x * deltaSeconds * 2.25) * multiplier,
    pitch: (movement.y * 0.00165 + edgeTurn.y * deltaSeconds * 1.7) * multiplier,
  };
}

export function shouldAdvanceMissionSimulation(input: {
  phase: string;
  paused: boolean;
  switching: string;
}): boolean {
  return input.phase === 'MISSION' && !input.paused && input.switching !== 'TRANSITION';
}

export interface PrioritizedTarget {
  id: string;
  health: number;
  distanceSquared: number;
  alive: boolean;
}

export function shouldHoldForAgentTurn(
  humanCharacter: CharacterId,
  decisionKind: string | null,
): boolean {
  return humanCharacter === 'CODY' && decisionKind?.startsWith('CHASE_TURN_') === true;
}

export function choosePrioritizedTarget<T extends PrioritizedTarget>(
  targets: readonly T[],
  priority: string,
): T | null {
  const live = targets.filter((target) => target.alive);
  if (live.length === 0) return null;

  const normalized = priority.trim().toUpperCase();
  const exact = live.find((target) => target.id.toUpperCase() === normalized);
  if (exact) return exact;

  if (normalized === 'HIGHEST_THREAT') {
    return [...live].sort(
      (left, right) =>
        right.health - left.health || left.distanceSquared - right.distanceSquared,
    )[0];
  }

  return [...live].sort(
    (left, right) => left.distanceSquared - right.distanceSquared,
  )[0];
}
