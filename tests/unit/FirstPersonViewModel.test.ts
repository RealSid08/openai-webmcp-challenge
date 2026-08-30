import {
  computeViewModelPose,
  integrateRecoil,
} from '../../src/game/presentation/FirstPersonViewModel';

describe('first-person viewmodel pose', () => {
  it('lowers and rotates the weapon while sprinting', () => {
    const idle = computeViewModelPose({ sprint: 0, aim: 0, bob: 0, sway: 0, reload: 0, recoil: 0 });
    const sprint = computeViewModelPose({ sprint: 1, aim: 0, bob: 0, sway: 0, reload: 0, recoil: 0 });

    expect(sprint.position.y).toBeLessThan(idle.position.y);
    expect(sprint.rotation.x).toBeGreaterThan(idle.rotation.x);
  });

  it('aligns the weapon to the centre while aiming', () => {
    const aimed = computeViewModelPose({ sprint: 0, aim: 1, bob: 0, sway: 0, reload: 0, recoil: 0 });
    expect(aimed.position.x).toBeCloseTo(0, 4);
    expect(aimed.rotation.y).toBeCloseTo(0, 4);
  });

  it('turns reload into a visible roll and vertical drop', () => {
    const pose = computeViewModelPose({ sprint: 0, aim: 0, bob: 0, sway: 0, reload: 0.5, recoil: 0 });
    expect(Math.abs(pose.rotation.z)).toBeGreaterThan(0.2);
    expect(pose.position.y).toBeLessThan(-0.25);
  });

  it('decays recoil to zero without becoming negative', () => {
    expect(integrateRecoil(1, 0.1)).toBeLessThan(1);
    expect(integrateRecoil(0.01, 1)).toBe(0);
  });
});
