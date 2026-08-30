import {
  ProceduralAudio,
  type AudioCue,
  type ProceduralMusicMix,
} from './ProceduralAudio';

export type AdaptiveMusicState =
  | 'SILENT'
  | 'STEALTH'
  | 'COMBAT'
  | 'BREACH'
  | 'CHASE'
  | 'LOSS'
  | 'RESOLUTION';

export interface AudioSettings {
  music: number;
  effects: number;
}

export interface AdaptiveAudioSnapshot {
  phase: 'PAIRING' | 'TITLE' | 'MISSION' | 'FAILURE' | 'COMPLETE';
  section: 'FACILITY_ONE' | 'FACILITY_TWO' | 'BOMB_GATE' | 'CHASE' | null;
  paused: boolean;
  aliveEnemies: number;
  healthFraction: number;
  decisionPending: boolean;
  bombState: 'IDLE' | 'PLANTING' | 'ARMED' | 'DETONATED';
}

export interface AdaptiveMusicTarget {
  state: AdaptiveMusicState;
  intensity: number;
}

export interface AdaptiveAudioOutput {
  unlock(): Promise<boolean>;
  play(cue: AudioCue): void;
  setMusicMix(mix: ProceduralMusicMix): void;
  setVolumes(settings: AudioSettings): void;
  dispose(): void;
}

export function deriveAdaptiveMusicTarget(snapshot: AdaptiveAudioSnapshot): AdaptiveMusicTarget {
  if (snapshot.paused) return { state: 'SILENT', intensity: 0.06 };
  if (snapshot.phase === 'COMPLETE') return { state: 'RESOLUTION', intensity: 0.38 };
  if (snapshot.phase === 'FAILURE') return { state: 'LOSS', intensity: 0.22 };
  if (snapshot.phase === 'PAIRING') return { state: 'SILENT', intensity: 0 };
  if (snapshot.phase === 'TITLE') return { state: 'STEALTH', intensity: 0.16 };
  if (snapshot.section === 'CHASE') return { state: 'CHASE', intensity: 1 };
  if (snapshot.section === 'BOMB_GATE' && snapshot.bombState !== 'IDLE') {
    return { state: 'BREACH', intensity: snapshot.bombState === 'ARMED' ? 0.88 : 0.78 };
  }
  if (snapshot.aliveEnemies > 0) {
    const danger = (1 - snapshot.healthFraction) * 0.18 + (snapshot.decisionPending ? 0.1 : 0);
    return { state: 'COMBAT', intensity: Math.min(0.95, 0.68 + danger) };
  }
  return { state: 'STEALTH', intensity: 0.28 };
}

export function advanceAdaptiveIntensity(current: number, target: number, deltaMs: number): number {
  const timeConstant = target > current ? 400 : 2_500;
  const alpha = 1 - Math.exp(-Math.max(0, deltaMs) / timeConstant);
  return current + (target - current) * alpha;
}

function createMusicMix(state: AdaptiveMusicState, intensity: number): ProceduralMusicMix {
  const active = state === 'SILENT' ? 0 : intensity;
  return {
    state,
    intensity,
    drone: state === 'LOSS' ? intensity * 0.45 : active * 0.72,
    pulse: ['COMBAT', 'BREACH', 'CHASE'].includes(state) ? intensity * 0.72 : active * 0.2,
    danger: ['COMBAT', 'BREACH'].includes(state) ? intensity * 0.58 : 0,
    chase: state === 'CHASE' ? intensity : 0,
    resolution: state === 'RESOLUTION' ? intensity : state === 'LOSS' ? intensity * 0.3 : 0,
  };
}

export class AdaptiveAudioDirector {
  private intensity = 0;

  constructor(private readonly output: AdaptiveAudioOutput = new ProceduralAudio()) {}

  unlock(): Promise<boolean> {
    return this.output.unlock();
  }

  play(cue: AudioCue): void {
    this.output.play(cue);
  }

  setVolumes(settings: AudioSettings): void {
    this.output.setVolumes(settings);
  }

  update(snapshot: AdaptiveAudioSnapshot, deltaMs: number): void {
    const target = deriveAdaptiveMusicTarget(snapshot);
    this.intensity = advanceAdaptiveIntensity(this.intensity, target.intensity, deltaMs);
    this.output.setMusicMix(createMusicMix(target.state, this.intensity));
  }

  dispose(): void {
    this.output.dispose();
  }
}
