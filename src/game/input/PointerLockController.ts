export type PointerLockState =
  | 'IDLE'
  | 'REQUESTING'
  | 'LOCKED'
  | 'RELEASED'
  | 'LOCKLESS';

export interface PointerLockSnapshot {
  state: PointerLockState;
  canRetry: boolean;
  dragFallback: boolean;
  message: string | null;
}

const INITIAL_SNAPSHOT: PointerLockSnapshot = {
  state: 'IDLE',
  canRetry: true,
  dragFallback: true,
  message: null,
};

const LOCKLESS_SNAPSHOT: PointerLockSnapshot = {
  state: 'LOCKLESS',
  canRetry: false,
  dragFallback: true,
  message: null,
};

const EDGE_TURN_START = 0.72;

function edgeTurnAxis(position: number, start: number, size: number): number {
  if (size <= 0) return 0;
  const normalized = Math.max(-1, Math.min(1, ((position - start) / size) * 2 - 1));
  const magnitude = Math.abs(normalized);
  if (magnitude <= EDGE_TURN_START) return 0;
  const strength = (magnitude - EDGE_TURN_START) / (1 - EDGE_TURN_START);
  return Math.sign(normalized) * strength * strength;
}

export function isMouseLookActive(state: PointerLockState): boolean {
  return state === 'LOCKED' || state === 'LOCKLESS';
}

export class PointerLockController {
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<(snapshot: PointerLockSnapshot) => void>();
  private locklessEdgeTurn = { x: 0, y: 0 };

  private readonly onPointerLockChange = () => {
    if (this.owner.pointerLockElement === this.canvas) {
      this.locklessEdgeTurn = { x: 0, y: 0 };
      this.publish({ state: 'LOCKED', canRetry: false, dragFallback: false, message: null });
    } else if (this.snapshot.state === 'REQUESTING') {
      this.enableLockless();
    } else if (this.snapshot.state === 'LOCKED') {
      this.publish({
        state: 'RELEASED',
        canRetry: true,
        dragFallback: true,
        message: 'Mouse control released. Click to take control again.',
      });
    }
  };

  private readonly onPointerLockError = () => this.enableLockless();

  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);
  private readonly onPointerLeave = () => {
    this.locklessEdgeTurn = { x: 0, y: 0 };
  };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly owner: Document,
  ) {
    owner.addEventListener('pointerlockchange', this.onPointerLockChange);
    owner.addEventListener('pointerlockerror', this.onPointerLockError);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  getSnapshot(): PointerLockSnapshot {
    return this.snapshot;
  }

  async request(): Promise<PointerLockSnapshot> {
    if (typeof this.canvas.requestPointerLock !== 'function') {
      this.enableLockless();
      return this.snapshot;
    }

    this.canvas.focus({ preventScroll: true });
    this.publish({ state: 'REQUESTING', canRetry: false, dragFallback: true, message: null });

    try {
      await Promise.resolve(this.canvas.requestPointerLock());
      if (this.owner.pointerLockElement === this.canvas) {
        this.locklessEdgeTurn = { x: 0, y: 0 };
        this.publish({ state: 'LOCKED', canRetry: false, dragFallback: false, message: null });
      } else if (this.snapshot.state === 'REQUESTING') {
        this.enableLockless();
      }
    } catch {
      this.enableLockless();
    }
    return this.snapshot;
  }

  release(): void {
    if (this.owner.pointerLockElement === this.canvas) this.owner.exitPointerLock?.();
  }

  handlePointerMove(event: Pick<PointerEvent, 'clientX' | 'clientY'>): void {
    if (this.snapshot.state !== 'LOCKLESS') return;
    const bounds = this.canvas.getBoundingClientRect();
    this.locklessEdgeTurn = {
      x: edgeTurnAxis(event.clientX, bounds.left, bounds.width),
      y: edgeTurnAxis(event.clientY, bounds.top, bounds.height),
    };
  }

  getLocklessEdgeTurn(): Readonly<{ x: number; y: number }> {
    return this.snapshot.state === 'LOCKLESS' ? this.locklessEdgeTurn : { x: 0, y: 0 };
  }

  subscribe(listener: (snapshot: PointerLockSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.owner.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.owner.removeEventListener('pointerlockerror', this.onPointerLockError);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    this.listeners.clear();
  }

  private enableLockless(): void {
    if (this.snapshot.state === 'LOCKLESS') return;
    this.publish(LOCKLESS_SNAPSHOT);
  }

  private publish(snapshot: PointerLockSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
