import { describe, expect, it } from 'vitest';

import * as runtimeLogic from '../../src/game/runtimeLogic';

const {
  choosePrioritizedTarget,
  shouldAdvanceMissionSimulation,
  shouldHoldForAgentTurn,
} = runtimeLogic;

const targets = [
  { id: 'pursuer-1', health: 40, distanceSquared: 25, alive: true },
  { id: 'pursuer-2', health: 100, distanceSquared: 100, alive: true },
  { id: 'pursuer-3', health: 100, distanceSquared: 16, alive: false },
];

describe('runtime chase decisions', () => {
  it('advances an active mission regardless of pointer-lock state', () => {
    expect(
      shouldAdvanceMissionSimulation({ phase: 'MISSION', paused: false, switching: 'READY' }),
    ).toBe(true);
    expect(
      shouldAdvanceMissionSimulation({ phase: 'MISSION', paused: false, switching: 'TRANSITION' }),
    ).toBe(false);
    expect(
      shouldAdvanceMissionSimulation({ phase: 'MISSION', paused: true, switching: 'READY' }),
    ).toBe(false);
  });

  it('holds the route only while the agent driver has an unresolved turn', () => {
    expect(shouldHoldForAgentTurn('CODY', 'CHASE_TURN_1')).toBe(true);
    expect(shouldHoldForAgentTurn('OWEN', 'CHASE_TURN_1')).toBe(false);
    expect(shouldHoldForAgentTurn('CODY', 'BOMB_RETREAT')).toBe(false);
    expect(shouldHoldForAgentTurn('CODY', null)).toBe(false);
  });

  it('honors an exact visible pursuer id', () => {
    expect(choosePrioritizedTarget(targets, 'PURSUER-2')?.id).toBe('pursuer-2');
  });

  it('supports closest and highest-threat priorities without selecting destroyed targets', () => {
    expect(choosePrioritizedTarget(targets, 'CLOSEST')?.id).toBe('pursuer-1');
    expect(choosePrioritizedTarget(targets, 'HIGHEST_THREAT')?.id).toBe('pursuer-2');
  });

  it('falls back to the closest live target for an unknown id', () => {
    expect(choosePrioritizedTarget(targets, 'not-visible')?.id).toBe('pursuer-1');
    expect(choosePrioritizedTarget([], 'CLOSEST')).toBeNull();
  });
});

describe('runtime mouse look', () => {
  it('uses a lower default for both raw movement and lockless edge turning', () => {
    const computeMouseLookDelta = (
      runtimeLogic as typeof runtimeLogic & {
        computeMouseLookDelta?: (
          movement: { x: number; y: number },
          edge: { x: number; y: number },
          sensitivity: number,
          deltaSeconds: number,
        ) => { yaw: number; pitch: number };
      }
    ).computeMouseLookDelta;

    expect(computeMouseLookDelta).toBeTypeOf('function');
    const result = computeMouseLookDelta?.(
      { x: 100, y: -50 },
      { x: 1, y: 0.5 },
      0.7,
      0.02,
    );
    expect(result?.yaw).toBeCloseTo(0.147, 6);
    expect(result?.pitch).toBeCloseTo(-0.04585, 6);
  });
});
