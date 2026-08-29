export type AudioCue =
  | 'HUMAN_SHOT'
  | 'PARTNER_SHOT'
  | 'ENEMY_SHOT'
  | 'FOOTSTEP'
  | 'RELOAD'
  | 'EMPTY'
  | 'NEAR_MISS'
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

export interface ProceduralMusicMix {
  state: string;
  intensity: number;
  drone: number;
  pulse: number;
  danger: number;
  chase: number;
  resolution: number;
}

const PLANS: Record<AudioCue, CuePlan> = {
  HUMAN_SHOT: {
    gain: 0.13,
    noiseMs: 70,
    tones: [{ wave: 'square', startHz: 150, endHz: 58, durationMs: 85 }],
  },
  PARTNER_SHOT: {
    gain: 0.1,
    noiseMs: 62,
    tones: [{ wave: 'square', startHz: 135, endHz: 52, durationMs: 78 }],
  },
  ENEMY_SHOT: {
    gain: 0.11,
    noiseMs: 80,
    tones: [{ wave: 'sawtooth', startHz: 185, endHz: 64, durationMs: 92 }],
  },
  FOOTSTEP: {
    gain: 0.04,
    noiseMs: 42,
    tones: [{ wave: 'triangle', startHz: 72, endHz: 42, durationMs: 55 }],
  },
  RELOAD: {
    gain: 0.045,
    noiseMs: 18,
    tones: [
      { wave: 'square', startHz: 380, endHz: 220, durationMs: 38 },
      { wave: 'square', startHz: 260, endHz: 460, durationMs: 44, delayMs: 145 },
    ],
  },
  EMPTY: {
    gain: 0.035,
    noiseMs: 0,
    tones: [{ wave: 'square', startHz: 490, endHz: 340, durationMs: 28 }],
  },
  NEAR_MISS: {
    gain: 0.055,
    noiseMs: 38,
    tones: [{ wave: 'sine', startHz: 1_400, endHz: 440, durationMs: 130 }],
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
  return { ...plan, tones: plan.tones.map((tone) => ({ ...tone })) };
}

interface MusicVoice {
  oscillator: OscillatorNode;
  gain: GainNode;
}

const silentMix: ProceduralMusicMix = {
  state: 'SILENT',
  intensity: 0,
  drone: 0,
  pulse: 0,
  danger: 0,
  chase: 0,
  resolution: 0,
};

export class ProceduralAudio {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicVoices: Record<'drone' | 'pulse' | 'danger' | 'chase' | 'resolution', MusicVoice> | null = null;
  private volumes = { music: 0.65, effects: 0.82 };
  private pendingMix = silentMix;

  async unlock(): Promise<boolean> {
    if (!this.context) {
      const AudioContextConstructor = window.AudioContext;
      if (!AudioContextConstructor) return false;
      this.context = new AudioContextConstructor({ latencyHint: 'interactive' });
      this.buildBuses(this.context);
      this.buildMusic(this.context);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return this.context.state === 'running';
  }

  setVolumes(volumes: { music: number; effects: number }): void {
    this.volumes = {
      music: Math.min(Math.max(volumes.music, 0), 1),
      effects: Math.min(Math.max(volumes.effects, 0), 1),
    };
    const now = this.context?.currentTime ?? 0;
    this.musicGain?.gain.setTargetAtTime(this.volumes.music, now, 0.04);
    this.effectsGain?.gain.setTargetAtTime(this.volumes.effects, now, 0.025);
  }

  setMusicMix(mix: ProceduralMusicMix): void {
    this.pendingMix = { ...mix };
    const context = this.context;
    const voices = this.musicVoices;
    if (!context || !voices) return;
    const now = context.currentTime;
    voices.drone.gain.gain.setTargetAtTime(mix.drone * 0.038, now, 0.22);
    voices.pulse.gain.gain.setTargetAtTime(mix.pulse * 0.022, now, 0.16);
    voices.danger.gain.gain.setTargetAtTime(mix.danger * 0.018, now, 0.12);
    voices.chase.gain.gain.setTargetAtTime(mix.chase * 0.028, now, 0.1);
    voices.resolution.gain.gain.setTargetAtTime(mix.resolution * 0.032, now, 0.35);
    voices.pulse.oscillator.frequency.setTargetAtTime(82 + mix.intensity * 34, now, 0.2);
    voices.danger.oscillator.frequency.setTargetAtTime(148 + mix.intensity * 54, now, 0.18);
    voices.chase.oscillator.frequency.setTargetAtTime(48 + mix.intensity * 22, now, 0.14);
  }

  play(cue: AudioCue): void {
    const context = this.context;
    if (!context || context.state !== 'running' || !this.effectsGain) return;
    const plan = createCuePlan(cue);
    if (plan.noiseMs > 0) this.playNoise(context, plan, this.effectsGain);
    for (const tone of plan.tones) this.playTone(context, tone, plan.gain, this.effectsGain);
  }

  dispose(): void {
    const context = this.context;
    this.context = null;
    if (this.musicVoices) {
      for (const voice of Object.values(this.musicVoices)) voice.oscillator.stop();
    }
    this.musicVoices = null;
    this.masterGain = null;
    this.effectsGain = null;
    this.musicGain = null;
    if (context && context.state !== 'closed') void context.close();
  }

  private buildBuses(context: AudioContext): void {
    this.masterGain = context.createGain();
    this.effectsGain = context.createGain();
    this.musicGain = context.createGain();
    this.masterGain.gain.value = 0.86;
    this.effectsGain.gain.value = this.volumes.effects;
    this.musicGain.gain.value = this.volumes.music;
    this.effectsGain.connect(this.masterGain);
    this.musicGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
  }

  private buildMusic(context: AudioContext): void {
    if (!this.musicGain) return;
    const createVoice = (wave: OscillatorType, frequency: number): MusicVoice => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = wave;
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;
      oscillator.connect(gain).connect(this.musicGain as GainNode);
      oscillator.start();
      return { oscillator, gain };
    };
    this.musicVoices = {
      drone: createVoice('sine', 46),
      pulse: createVoice('triangle', 88),
      danger: createVoice('square', 164),
      chase: createVoice('sawtooth', 52),
      resolution: createVoice('sine', 116),
    };
    this.setMusicMix(this.pendingMix);
  }

  private playTone(context: AudioContext, tone: CueTone, gainValue: number, output: AudioNode): void {
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
    oscillator.connect(gain).connect(output);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
  }

  private playNoise(context: AudioContext, plan: CuePlan, output: AudioNode): void {
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
    source.connect(gain).connect(output);
    source.start(start);
    source.stop(start + duration + 0.01);
  }
}
