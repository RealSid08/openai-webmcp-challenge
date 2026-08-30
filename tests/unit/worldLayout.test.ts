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

  it('starts both infiltrators behind separate full-height walls with a broad centre gap', () => {
    const { left, right, gapWidth } = FACILITY_LAYOUT.startingCover;
    expect(left.center.x + left.size.width / 2).toBeLessThanOrEqual(-gapWidth / 2);
    expect(right.center.x - right.size.width / 2).toBeGreaterThanOrEqual(gapWidth / 2);
    expect(left.size.height).toBeGreaterThanOrEqual(4);
    expect(right.size.height).toBeGreaterThanOrEqual(4);
    expect(gapWidth).toBeGreaterThanOrEqual(4);
    expect(FACILITY_LAYOUT.encounters[0].playerStart.x).toBeLessThan(0);
    expect(FACILITY_LAYOUT.encounters[0].partnerStart.x).toBeGreaterThan(0);
  });

  it('provides an authored navigation route from cover to the getaway gate', () => {
    expect(FACILITY_LAYOUT.navigationPath[0]!.z).toBeLessThan(
      FACILITY_LAYOUT.navigationPath.at(-1)!.z,
    );
    expect(FACILITY_LAYOUT.navigationPath.at(-1)).toEqual(FACILITY_LAYOUT.gate.plantPoint);
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
