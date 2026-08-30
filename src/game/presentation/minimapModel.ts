export interface MapPoint {
  x: number;
  y: number;
}

export interface MinimapCharacter extends MapPoint {
  id: 'OWEN' | 'CODY';
  controlled: boolean;
}

export interface MinimapEnemy extends MapPoint {
  id: string;
}

export interface MinimapInteraction extends MapPoint {
  id: string;
  label: string;
}

export interface MinimapObjective extends MapPoint {
  label: string;
  edgeArrow: boolean;
  angle: number;
}

export interface MinimapSnapshot {
  mode: 'FACILITY' | 'CHASE';
  route: readonly MapPoint[];
  characters: readonly MinimapCharacter[];
  enemies: readonly MinimapEnemy[];
  interactions: readonly MinimapInteraction[];
  objective: MinimapObjective;
  nextTurn: { direction: 'LEFT' | 'RIGHT'; distance: number } | null;
  accessibleLabel: string;
}

interface FacilityWorldPoint {
  x: number;
  z: number;
}

interface FacilityInput {
  controlledPosition: FacilityWorldPoint;
  controlledYaw: number;
  objective: FacilityWorldPoint & { label: string };
  route: readonly FacilityWorldPoint[];
  characters: readonly (FacilityWorldPoint & { id: 'OWEN' | 'CODY'; controlled: boolean })[];
  enemies: readonly (FacilityWorldPoint & { id: string; detected: boolean })[];
  interactions: readonly (FacilityWorldPoint & { id: string; label: string })[];
  viewRadius: number;
}

function project(
  point: FacilityWorldPoint,
  origin: FacilityWorldPoint,
  yaw: number,
  radius: number,
): MapPoint {
  const dx = point.x - origin.x;
  const dz = point.z - origin.z;
  const cosine = Math.cos(-yaw);
  const sine = Math.sin(-yaw);
  return {
    x: (dx * cosine - dz * sine) / radius,
    y: -(dx * sine + dz * cosine) / radius,
  };
}

function directionLabel(angle: number): string {
  const quarter = Math.PI / 4;
  if (angle > -quarter && angle <= quarter) return 'ahead';
  if (angle > quarter && angle <= Math.PI - quarter) return 'right';
  if (angle <= -quarter && angle > -Math.PI + quarter) return 'left';
  return 'behind';
}

export function projectFacilityMinimap(input: FacilityInput): MinimapSnapshot {
  const objectiveRaw = project(
    input.objective,
    input.controlledPosition,
    input.controlledYaw,
    input.viewRadius,
  );
  const objectiveDistance = Math.hypot(objectiveRaw.x, objectiveRaw.y);
  const edgeArrow = objectiveDistance > 0.88;
  const scale = edgeArrow ? 0.88 / objectiveDistance : 1;
  const objective = {
    x: objectiveRaw.x * scale,
    y: objectiveRaw.y * scale,
    label: input.objective.label,
    edgeArrow,
    angle: Math.atan2(objectiveRaw.x, -objectiveRaw.y),
  };
  const enemies = input.enemies
    .filter((enemy) => enemy.detected)
    .map((enemy) => ({ id: enemy.id, ...project(enemy, input.controlledPosition, input.controlledYaw, input.viewRadius) }));
  const enemyCopy = `${enemies.length} ${enemies.length === 1 ? 'enemy' : 'enemies'} detected`;
  return {
    mode: 'FACILITY',
    route: input.route.map((point) => project(point, input.controlledPosition, input.controlledYaw, input.viewRadius)),
    characters: input.characters.map((character) => ({
      id: character.id,
      controlled: character.controlled,
      ...project(character, input.controlledPosition, input.controlledYaw, input.viewRadius),
    })),
    enemies,
    interactions: input.interactions.map((interaction) => ({
      id: interaction.id,
      label: interaction.label,
      ...project(interaction, input.controlledPosition, input.controlledYaw, input.viewRadius),
    })),
    objective,
    nextTurn: null,
    accessibleLabel: `Objective ${objective.label} is ${directionLabel(objective.angle)}. ${enemyCopy}.`,
  };
}

interface ChaseInput {
  progress: number;
  routeLength: number;
  turns: readonly { id: number; progress: number; direction: 'LEFT' | 'RIGHT' }[];
  pursuers: readonly { id: string; lane: number; distanceBehind: number; alive: boolean }[];
}

export function projectChaseMinimap(input: ChaseInput): MinimapSnapshot {
  const next = input.turns.find((turn) => turn.progress > input.progress) ?? null;
  const nextTurn = next
    ? { direction: next.direction, distance: Math.round(next.progress - input.progress) }
    : null;
  const enemies = input.pursuers
    .filter((pursuer) => pursuer.alive)
    .map((pursuer) => ({
      id: pursuer.id,
      x: Math.min(Math.max(pursuer.lane * 0.32, -0.75), 0.75),
      y: Math.min(0.82, 0.22 + pursuer.distanceBehind / 45),
    }));
  return {
    mode: 'CHASE',
    route: [{ x: 0, y: 0.85 }, { x: 0, y: -0.85 }],
    characters: [
      { id: 'OWEN', x: -0.06, y: 0.08, controlled: true },
      { id: 'CODY', x: 0.06, y: 0.08, controlled: false },
    ],
    enemies,
    interactions: [],
    objective: {
      x: 0,
      y: -0.85,
      label: 'Escape route',
      edgeArrow: true,
      angle: 0,
    },
    nextTurn,
    accessibleLabel: nextTurn
      ? `Next turn ${nextTurn.direction.toLowerCase()} in ${nextTurn.distance}. ${enemies.length} pursuers detected.`
      : `Escape route ahead. ${enemies.length} pursuers detected.`,
  };
}
