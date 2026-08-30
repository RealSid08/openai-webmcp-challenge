import {
  projectChaseMinimap,
  projectFacilityMinimap,
} from '../../src/game/presentation/minimapModel';

describe('minimap projection', () => {
  it('keeps a far facility objective represented by an edge arrow', () => {
    const map = projectFacilityMinimap({
      controlledPosition: { x: 0, z: 0 },
      controlledYaw: 0,
      objective: { x: 0, z: 50, label: 'Blast gate' },
      route: [{ x: 0, z: 0 }, { x: 0, z: 50 }],
      characters: [
        { id: 'OWEN', x: 0, z: 0, controlled: true },
        { id: 'CODY', x: 4, z: 3, controlled: false },
      ],
      enemies: [],
      interactions: [],
      viewRadius: 16,
    });

    expect(map.objective.edgeArrow).toBe(true);
    expect(Math.hypot(map.objective.x, map.objective.y)).toBeLessThanOrEqual(0.91);
  });

  it('does not reveal an undetected enemy', () => {
    const map = projectFacilityMinimap({
      controlledPosition: { x: 0, z: 0 },
      controlledYaw: 0,
      objective: { x: 0, z: 8, label: 'Exit' },
      route: [],
      characters: [],
      enemies: [
        { id: 'hidden', x: 2, z: 4, detected: false },
        { id: 'known', x: -2, z: 5, detected: true },
      ],
      interactions: [],
      viewRadius: 16,
    });
    expect(map.enemies.map((enemy) => enemy.id)).toEqual(['known']);
  });

  it('shows the next unresolved chase turn and pursuing vehicles', () => {
    const map = projectChaseMinimap({
      progress: 40,
      routeLength: 100,
      turns: [
        { id: 1, progress: 32, direction: 'RIGHT' },
        { id: 2, progress: 68, direction: 'LEFT' },
      ],
      pursuers: [
        { id: 'pursuer-1', lane: -1, distanceBehind: 12, alive: true },
        { id: 'pursuer-2', lane: 1, distanceBehind: 20, alive: false },
      ],
    });
    expect(map.nextTurn).toEqual({ direction: 'LEFT', distance: 28 });
    expect(map.enemies.map((enemy) => enemy.id)).toEqual(['pursuer-1']);
  });
});
