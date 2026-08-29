import {
  chooseAimAssistTarget,
  computeAimAssistCorrection,
  type AimAssistCandidate,
} from '../../src/game/input/aimAssist';

const candidates: AimAssistCandidate[] = [
  { id: 'occluded', alive: true, visible: false, angularError: 0.01, distance: 5, yawError: 0.01, pitchError: 0 },
  { id: 'outside', alive: true, visible: true, angularError: 0.3, distance: 5, yawError: 0.3, pitchError: 0 },
  { id: 'visible-near-reticle', alive: true, visible: true, angularError: 0.04, distance: 12, yawError: 0.035, pitchError: -0.02 },
  { id: 'visible-farther-reticle', alive: true, visible: true, angularError: 0.07, distance: 7, yawError: 0.06, pitchError: 0.02 },
];

describe('controller aim assistance', () => {
  it('selects only a living visible target inside the configured cone', () => {
    expect(chooseAimAssistTarget(candidates, { coneRadians: 0.09 })?.id).toBe('visible-near-reticle');
  });

  it('returns no correction for keyboard and mouse input', () => {
    expect(
      computeAimAssistCorrection(candidates[2]!, {
        inputDevice: 'KEYBOARD_MOUSE',
        aiming: true,
        deltaSeconds: 1 / 60,
      }),
    ).toEqual({ yaw: 0, pitch: 0, slowdown: 1 });
  });

  it('is stronger while aiming but remains rate limited', () => {
    const hip = computeAimAssistCorrection(candidates[2]!, {
      inputDevice: 'XBOX',
      aiming: false,
      deltaSeconds: 1 / 60,
    });
    const aimed = computeAimAssistCorrection(candidates[2]!, {
      inputDevice: 'PLAYSTATION',
      aiming: true,
      deltaSeconds: 1 / 60,
    });
    expect(Math.abs(aimed.yaw)).toBeGreaterThan(Math.abs(hip.yaw));
    expect(Math.abs(aimed.yaw)).toBeLessThan(0.01);
    expect(aimed.slowdown).toBeLessThan(hip.slowdown);
  });
});
