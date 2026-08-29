import {
  AdaptiveAudioDirector,
  advanceAdaptiveIntensity,
  deriveAdaptiveMusicTarget,
  type AdaptiveAudioOutput,
} from '../../src/audio/AdaptiveAudioDirector';

describe('adaptive audio direction', () => {
  it('escalates from facility tension through breach and chase', () => {
    expect(
      deriveAdaptiveMusicTarget({
        phase: 'MISSION',
        section: 'FACILITY_ONE',
        paused: false,
        aliveEnemies: 0,
        healthFraction: 1,
        decisionPending: false,
        bombState: 'IDLE',
      }),
    ).toMatchObject({ state: 'STEALTH', intensity: 0.28 });

    expect(
      deriveAdaptiveMusicTarget({
        phase: 'MISSION',
        section: 'BOMB_GATE',
        paused: false,
        aliveEnemies: 2,
        healthFraction: 0.55,
        decisionPending: true,
        bombState: 'ARMED',
      }),
    ).toMatchObject({ state: 'BREACH', intensity: 0.88 });

    expect(
      deriveAdaptiveMusicTarget({
        phase: 'MISSION',
        section: 'CHASE',
        paused: false,
        aliveEnemies: 3,
        healthFraction: 0.8,
        decisionPending: false,
        bombState: 'DETONATED',
      }),
    ).toMatchObject({ state: 'CHASE', intensity: 1 });
  });

  it('attacks quickly and releases slowly so music does not flutter', () => {
    const attack = advanceAdaptiveIntensity(0.2, 1, 500);
    const release = advanceAdaptiveIntensity(1, 0.2, 500);
    expect(attack).toBeGreaterThan(0.65);
    expect(release).toBeGreaterThan(0.75);
    expect(1 - release).toBeLessThan(attack - 0.2);
  });

  it('routes effects, mix, volume, unlock, and disposal through one owner', async () => {
    const output: AdaptiveAudioOutput = {
      unlock: vi.fn(async () => true),
      play: vi.fn(),
      setMusicMix: vi.fn(),
      setVolumes: vi.fn(),
      dispose: vi.fn(),
    };
    const director = new AdaptiveAudioDirector(output);

    await expect(director.unlock()).resolves.toBe(true);
    director.setVolumes({ music: 0.4, effects: 0.7 });
    director.play('FOOTSTEP');
    director.update(
      {
        phase: 'MISSION',
        section: 'CHASE',
        paused: false,
        aliveEnemies: 2,
        healthFraction: 0.9,
        decisionPending: false,
        bombState: 'DETONATED',
      },
      1_000,
    );
    director.dispose();

    expect(output.setVolumes).toHaveBeenCalledWith({ music: 0.4, effects: 0.7 });
    expect(output.play).toHaveBeenCalledWith('FOOTSTEP');
    expect(output.setMusicMix).toHaveBeenCalledWith(expect.objectContaining({ state: 'CHASE' }));
    expect(output.dispose).toHaveBeenCalledOnce();
  });
});
