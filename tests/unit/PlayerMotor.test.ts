import { createPlayerMotorState, updatePlayerMotor } from '../../src/game/systems/PlayerMotor';

describe('PlayerMotor', () => {
  it('accelerates toward sprint speed and brakes firmly when input stops', () => {
    let state = createPlayerMotorState();
    const accelerating = updatePlayerMotor(state, { move: { x: 0, y: 1 }, sprinting: true }, 0.1);
    state = accelerating.state;
    expect(state.speed).toBeGreaterThan(0);
    expect(state.speed).toBeLessThanOrEqual(6.2);

    const braking = updatePlayerMotor(state, { move: { x: 0, y: 0 }, sprinting: true }, 0.1);
    expect(braking.state.speed).toBeLessThan(state.speed);
  });

  it('caps walking below sprinting and brakes before reversing', () => {
    let walking = createPlayerMotorState();
    let sprinting = createPlayerMotorState();
    for (let index = 0; index < 20; index += 1) {
      walking = updatePlayerMotor(walking, { move: { x: 0, y: 1 }, sprinting: false }, 0.05).state;
      sprinting = updatePlayerMotor(sprinting, { move: { x: 0, y: 1 }, sprinting: true }, 0.05).state;
    }
    expect(walking.speed).toBeCloseTo(3.2, 1);
    expect(sprinting.speed).toBeCloseTo(6.2, 1);

    const reversed = updatePlayerMotor(sprinting, { move: { x: 0, y: -1 }, sprinting: true }, 0.05).state;
    expect(reversed.velocity.y).toBeGreaterThanOrEqual(0);
  });

  it('emits footsteps from travelled distance rather than render frame count', () => {
    function simulate(frameRate: number): number {
      let state = createPlayerMotorState();
      let steps = 0;
      const dt = 1 / frameRate;
      for (let time = 0; time < 3; time += dt) {
        const result = updatePlayerMotor(state, { move: { x: 0, y: 1 }, sprinting: true }, dt);
        state = result.state;
        if (result.footstep) steps += 1;
      }
      return steps;
    }

    expect(Math.abs(simulate(30) - simulate(120))).toBeLessThanOrEqual(1);
  });

  it('returns restrained camera motion while stationary', () => {
    const result = updatePlayerMotor(createPlayerMotorState(), { move: { x: 0, y: 0 }, sprinting: true }, 0.1);
    expect(result.camera.bobY).toBeCloseTo(0, 4);
    expect(result.camera.lean).toBeCloseTo(0, 4);
  });
});
