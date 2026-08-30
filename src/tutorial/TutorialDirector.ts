export type TutorialStep = 'MOVE' | 'AIM' | 'FIRE' | 'CALLOUT' | 'SWITCH' | 'COMPLETE';
export type TutorialEvent =
  | { type: 'MOVED' }
  | { type: 'AIMED' }
  | { type: 'HIT_ENEMY' }
  | { type: 'CALLOUT_SENT' }
  | { type: 'CHARACTER_SWITCHED' };

export interface TutorialSnapshot {
  active: boolean;
  step: TutorialStep;
  completed: boolean;
  skipped: boolean;
  refresher: boolean;
  skipProgress: number;
}

const ORDER: readonly TutorialStep[] = ['MOVE', 'AIM', 'FIRE', 'CALLOUT', 'SWITCH', 'COMPLETE'];
const EXPECTED: Partial<Record<TutorialStep, TutorialEvent['type']>> = {
  MOVE: 'MOVED',
  AIM: 'AIMED',
  FIRE: 'HIT_ENEMY',
  CALLOUT: 'CALLOUT_SENT',
  SWITCH: 'CHARACTER_SWITCHED',
};

export class TutorialDirector {
  private snapshot: TutorialSnapshot;
  private readonly skipHoldSeconds: number;

  constructor(options: { completedBefore: boolean; skipHoldSeconds?: number }) {
    this.skipHoldSeconds = options.skipHoldSeconds ?? 0.85;
    this.snapshot = options.completedBefore
      ? {
          active: false,
          step: 'COMPLETE',
          completed: true,
          skipped: false,
          refresher: true,
          skipProgress: 0,
        }
      : {
          active: true,
          step: 'MOVE',
          completed: false,
          skipped: false,
          refresher: false,
          skipProgress: 0,
        };
  }

  getSnapshot(): TutorialSnapshot {
    return this.snapshot;
  }

  record(event: TutorialEvent): TutorialSnapshot {
    if (!this.snapshot.active || EXPECTED[this.snapshot.step] !== event.type) return this.snapshot;
    const index = ORDER.indexOf(this.snapshot.step);
    const next = ORDER[index + 1] ?? 'COMPLETE';
    const completed = next === 'COMPLETE';
    this.snapshot = {
      ...this.snapshot,
      active: !completed,
      step: next,
      completed,
      skipProgress: 0,
    };
    return this.snapshot;
  }

  updateSkipHeld(held: boolean, deltaSeconds: number): TutorialSnapshot {
    if (!this.snapshot.active) return this.snapshot;
    const skipProgress = held
      ? Math.min(1, this.snapshot.skipProgress + Math.max(deltaSeconds, 0) / this.skipHoldSeconds)
      : 0;
    if (skipProgress >= 1) return this.skip();
    this.snapshot = { ...this.snapshot, skipProgress };
    return this.snapshot;
  }

  skip(): TutorialSnapshot {
    this.snapshot = {
      ...this.snapshot,
      active: false,
      step: 'COMPLETE',
      completed: false,
      skipped: true,
      skipProgress: 1,
    };
    return this.snapshot;
  }
}
