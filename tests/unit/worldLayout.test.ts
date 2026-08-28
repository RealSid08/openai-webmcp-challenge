import { CHASE_ROUTE, FACILITY_LAYOUT } from '../../src/game/worldLayout';

describe('authored world layout', () => {
  it('contains two compact facility encounters followed by one bomb gate', () => {
    expect(FACILITY_LAYOUT.encounters).toHaveLength(2);
    expect(FACILITY_LAYOUT.encounters.map((encounter) => encounter.enemySpawns.length)).toEqual([3, 4]);
    expect(FACILITY_LAYOUT.gate.position.z).toBeGreaterThan(
      FACILITY_LAYOUT.encounters[1]!.bounds.maxZ,
    );
    expect(FACILITY_LAYOUT.routeBounds).toEqual({ minX: -9, maxX: 9, minZ: -4, maxZ: 58 });
  });

  it('keeps the getaway authored to one route with exactly two significant turns', () => {
    expect(CHASE_ROUTE.turns).toEqual([
      { id: 1, progress: 32, safeAction: 'RIGHT' },
      { id: 2, progress: 68, safeAction: 'LEFT' },
    ]);
    expect(CHASE_ROUTE.length).toBe(100);
    expect(CHASE_ROUTE.laneMin).toBe(-1);
    expect(CHASE_ROUTE.laneMax).toBe(1);
  });
});
