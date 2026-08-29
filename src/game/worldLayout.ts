export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export const FACILITY_LAYOUT = {
  routeBounds: { minX: -9, maxX: 9, minZ: -4, maxZ: 58 },
  startingCover: {
    gapWidth: 6,
    left: {
      id: 'START_LEFT',
      center: { x: -6.25, y: 2.6, z: 4 },
      size: { width: 6.5, height: 5.2, depth: 0.7 },
      protectsFrom: 'NORTH',
    },
    right: {
      id: 'START_RIGHT',
      center: { x: 6.25, y: 2.6, z: 4 },
      size: { width: 6.5, height: 5.2, depth: 0.7 },
      protectsFrom: 'NORTH',
    },
  },
  navigationPath: [
    { x: 0, y: 0, z: 1.5 },
    { x: 0, y: 0, z: 8 },
    { x: 0, y: 0, z: 18 },
    { x: 0, y: 0, z: 24 },
    { x: -1.5, y: 0, z: 36 },
    { x: 0, y: 0, z: 48.5 },
  ],
  encounters: [
    {
      id: 'FACILITY_ONE',
      bounds: { minZ: -2, maxZ: 20 },
      playerStart: { x: -5.5, y: 1.7, z: 1.2 },
      partnerStart: { x: 5.5, y: 0, z: 1.6 },
      enemySpawns: [
        { x: -5.5, y: 0, z: 12 },
        { x: 4.5, y: 0, z: 15 },
        { x: 0, y: 0, z: 18 },
      ],
      coverNodes: [
        { x: -4.5, y: 0, z: 5 },
        { x: 4.5, y: 0, z: 7 },
        { x: 0, y: 0, z: 11 },
      ],
    },
    {
      id: 'FACILITY_TWO',
      bounds: { minZ: 22, maxZ: 45 },
      playerStart: { x: 3, y: 1.7, z: 24 },
      partnerStart: { x: -2.5, y: 0, z: 24 },
      enemySpawns: [
        { x: -5.8, y: 0, z: 33 },
        { x: 5.2, y: 0, z: 35 },
        { x: -1.5, y: 0, z: 40 },
        { x: 4, y: 0, z: 43 },
      ],
      coverNodes: [
        { x: -4.5, y: 0, z: 27 },
        { x: 4.5, y: 0, z: 29 },
        { x: -1.5, y: 0, z: 36 },
      ],
    },
  ],
  gate: {
    position: { x: 0, y: 3.5, z: 52 },
    plantPoint: { x: 0, y: 0, z: 48.5 },
    safePoint: { x: -7, y: 0, z: 42 },
  },
} as const;

export const CHASE_ROUTE = {
  length: 100,
  laneMin: -1,
  laneMax: 1,
  turns: [
    { id: 1, progress: 32, safeAction: 'RIGHT' },
    { id: 2, progress: 68, safeAction: 'LEFT' },
  ],
  pursuerStarts: [
    { lane: -1, distanceBehind: 14 },
    { lane: 1, distanceBehind: 21 },
    { lane: 0, distanceBehind: 28 },
  ],
} as const;
