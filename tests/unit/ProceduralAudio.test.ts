import { createCuePlan } from '../../src/audio/ProceduralAudio';

describe('procedural audio cue plans', () => {
  it('keeps every game cue original, bounded, and deterministic', () => {
    const shot = createCuePlan('HUMAN_SHOT');
    const explosion = createCuePlan('EXPLOSION');
    const radio = createCuePlan('RADIO');

    expect(shot).toMatchObject({ noiseMs: 70, tones: [{ wave: 'square' }] });
    expect(explosion.noiseMs).toBeGreaterThan(shot.noiseMs);
    expect(explosion.tones[0]?.endHz).toBeLessThan(explosion.tones[0]?.startHz ?? 0);
    expect(radio.tones).toHaveLength(2);

    for (const cue of [
      'HUMAN_SHOT',
      'PARTNER_SHOT',
      'ENEMY_SHOT',
      'FOOTSTEP',
      'RELOAD',
      'EMPTY',
      'NEAR_MISS',
      'IMPACT',
      'EXPLOSION',
      'ALARM',
      'SWITCH',
      'RADIO',
      'ENGINE',
    ] as const) {
      const plan = createCuePlan(cue);
      expect(plan.noiseMs).toBeLessThanOrEqual(900);
      expect(plan.gain).toBeGreaterThan(0);
      expect(plan.gain).toBeLessThanOrEqual(0.22);
      expect(plan.tones.every((tone) => tone.durationMs <= 900)).toBe(true);
    }
  });
});
