export type AudioCue =
  | 'SHOT'
  | 'IMPACT'
  | 'EXPLOSION'
  | 'ALARM'
  | 'SWITCH'
  | 'RADIO'
  | 'ENGINE';

export interface CueTone {
  wave: OscillatorType;
  startHz: number;
  endHz: number;
  durationMs: number;
  delayMs?: number;
}

export interface CuePlan {
  gain: number;
  noiseMs: number;
  tones: readonly CueTone[];
}

const PLANS: Record<AudioCue, CuePlan> = {
  SHOT: {
    gain: 0.13,
    noiseMs: 70,
    tones: [{ wave: 'square', startHz: 150, endHz: 58, durationMs: 85 }],
  },
  IMPACT: {
    gain: 0.08,
    noiseMs: 55,
    tones: [{ wave: 'triangle', startHz: 105, endHz: 48, durationMs: 95 }],
  },
  EXPLOSION: {
    gain: 0.2,
    noiseMs: 820,
    tones: [
      { wave: 'sine', startHz: 92, endHz: 28, durationMs: 760 },
      { wave: 'triangle', startHz: 52, endHz: 24, durationMs: 620, delayMs: 55 },
    ],
  },
  ALARM: {
    gain: 0.07,
    noiseMs: 0,
    tones: [
      { wave: 'square', startHz: 680, endHz: 680, durationMs: 140 },
      { wave: 'square', startHz: 520, endHz: 520, durationMs: 140, delayMs: 165 },
    ],
  },
  SWITCH: {
    gain: 0.08,
    noiseMs: 180,
    tones: [{ wave: 'sine', startHz: 90, endHz: 460, durationMs: 420 }],
  },
  RADIO: {
    gain: 0.045,
    noiseMs: 35,
    tones: [
      { wave: 'square', startHz: 880, endHz: 880, durationMs: 45 },
      { wave: 'square', startHz: 1_120, endHz: 1_120, durationMs: 50, delayMs: 68 },
    ],
  },
  ENGINE: {
    gain: 0.035,
    noiseMs: 90,
    tones: [{ wave: 'sawtooth', startHz: 48, endHz: 56, durationMs: 340 }],
  },
};

export function createCuePlan(cue: AudioCue): CuePlan {
  const plan = PLANS[cue];
  return {
    ...plan,
    tones: plan.tones.map((tone) => ({ ...tone })),
  };
}

export class ProceduralAudio {
  private context: AudioContext | null = null;

  async unlock(): Promise<boolean> {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return false;
      this.context = new AudioContextConstructor({ latencyHint: 'interactive' });
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.state === 'running';
  }

  play(cue: AudioCue): void {
    const context = this.context;
    if (!context || context.state !== 'running') return;
    const plan = createCuePlan(cue);
    if (plan.noiseMs > 0) this.playNoise(context, plan);
    for (const tone of plan.tones) this.playTone(context, tone, plan.gain);
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close();
  }

  private playTone(context: AudioContext, tone: CueTone, gainValue: number): void {
    const start = context.currentTime + (tone.delayMs ?? 0) / 1_000;
    const end = start + tone.durationMs / 1_000;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(Math.max(1, tone.startHz), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.endHz), end);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  private playNoise(context: AudioContext, plan: CuePlan): void {
    const duration = plan.noiseMs / 1_000;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = frameCount ^ 0x5f3759df;
    for (let index = 0; index < data.length; index += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      data[index] = (seed / 0xffffffff) * 2 - 1;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(plan.gain, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(gain).connect(context.destination);
    source.start(start);
    source.stop(start + duration + 0.01);
  }
}
