export interface PlayerMotorState {
  velocity: { x: number; y: number };
  speed: number;
  bobPhase: number;
  stepDistance: number;
}

export interface PlayerMotorInput {
  move: { x: number; y: number };
  sprinting: boolean;
}

export interface PlayerMotorResult {
  state: PlayerMotorState;
  delta: { x: number; y: number };
  camera: { bobY: number; swayX: number; lean: number };
  footstep: boolean;
}

const WALK_SPEED = 3.2;
const SPRINT_SPEED = 6.2;
const ACCELERATION = 22;
const BRAKING = 30;

export function createPlayerMotorState(): PlayerMotorState {
  return { velocity: { x: 0, y: 0 }, speed: 0, bobPhase: 0, stepDistance: 0 };
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  if (current > target) return Math.max(current - maxDelta, target);
  return target;
}

export function updatePlayerMotor(
  previous: PlayerMotorState,
  input: PlayerMotorInput,
  deltaSeconds: number,
): PlayerMotorResult {
  const dt = Math.min(Math.max(deltaSeconds, 0), 0.1);
  const rawMagnitude = Math.hypot(input.move.x, input.move.y);
  const inputScale = rawMagnitude > 1 ? 1 / rawMagnitude : 1;
  const move = { x: input.move.x * inputScale, y: input.move.y * inputScale };
  const topSpeed = input.sprinting ? SPRINT_SPEED : WALK_SPEED;
  const target = { x: move.x * topSpeed, y: move.y * topSpeed };
  const moving = rawMagnitude > 0.001;
  const opposing = previous.velocity.x * target.x + previous.velocity.y * target.y < 0;
  const rate = !moving || opposing ? BRAKING : ACCELERATION;
  const velocity = {
    x: approach(previous.velocity.x, target.x, rate * dt),
    y: approach(previous.velocity.y, target.y, rate * dt),
  };
  const speed = Math.hypot(velocity.x, velocity.y);
  const distance = speed * dt;
  const stepSpacing = input.sprinting ? 1.18 : 1.38;
  let stepDistance = previous.stepDistance + distance;
  let footstep = false;
  if (speed > 0.35 && stepDistance >= stepSpacing) {
    stepDistance %= stepSpacing;
    footstep = true;
  }
  if (speed <= 0.35) stepDistance = Math.min(stepDistance, stepSpacing * 0.5);
  const bobPhase = previous.bobPhase + (distance / stepSpacing) * Math.PI * 2;
  const motion = Math.min(speed / topSpeed, 1);
  const bobAmplitude = (input.sprinting ? 0.035 : 0.022) * motion;

  return {
    state: { velocity, speed, bobPhase, stepDistance },
    delta: { x: velocity.x * dt, y: velocity.y * dt },
    camera: {
      bobY: speed > 0.35 ? Math.sin(bobPhase * 2) * bobAmplitude : 0,
      swayX: speed > 0.35 ? Math.cos(bobPhase) * bobAmplitude * 0.55 : 0,
      lean: speed > 0.35 ? -(velocity.x / topSpeed) * 0.028 : 0,
    },
    footstep,
  };
}

export class PlayerMotor {
  private state = createPlayerMotorState();

  update(input: PlayerMotorInput, deltaSeconds: number): PlayerMotorResult {
    const result = updatePlayerMotor(this.state, input, deltaSeconds);
    this.state = result.state;
    return result;
  }

  reset(): void {
    this.state = createPlayerMotorState();
  }
}
