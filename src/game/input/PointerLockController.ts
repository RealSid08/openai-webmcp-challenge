export type PointerLockState =
  | 'IDLE'
  | 'REQUESTING'
  | 'LOCKED'
  | 'RELEASED'
  | 'DENIED'
  | 'UNAVAILABLE';

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

export class PointerLockController {
  private snapshot = INITIAL_SNAPSHOT;
  private readonly listeners = new Set<(snapshot: PointerLockSnapshot) => void>();
  private dragActive = false;
  private dragDelta = { x: 0, y: 0 };

  private readonly onPointerLockChange = () => {
    if (this.owner.pointerLockElement === this.canvas) {
      this.publish({ state: 'LOCKED', canRetry: false, dragFallback: false, message: null });
    } else if (this.snapshot.state === 'LOCKED' || this.snapshot.state === 'REQUESTING') {
      this.publish({
        state: 'RELEASED',
        canRetry: true,
        dragFallback: true,
        message: 'Mouse control released. Click to take control again.',
      });
    }
  };

  private readonly onPointerLockError = () => {
    this.publish({
      state: 'DENIED',
      canRetry: true,
      dragFallback: true,
      message: 'Mouse capture was denied. Try again, use a controller, or hold right-click to look.',
    });
  };

  private readonly onPointerMove = (event: PointerEvent) => this.handlePointerMove(event);

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly owner: Document,
  ) {
    owner.addEventListener('pointerlockchange', this.onPointerLockChange);
    owner.addEventListener('pointerlockerror', this.onPointerLockError);
    canvas.addEventListener('pointermove', this.onPointerMove);
  }

  getSnapshot(): PointerLockSnapshot {
    return this.snapshot;
  }

  async request(): Promise<PointerLockSnapshot> {
    if (typeof this.canvas.requestPointerLock !== 'function') {
      this.publish({
        state: 'UNAVAILABLE',
        canRetry: false,
        dragFallback: true,
        message: 'This browser cannot capture the mouse. Use a controller or hold right-click to look.',
      });
      return this.snapshot;
    }

    this.canvas.focus({ preventScroll: true });
    this.publish({ state: 'REQUESTING', canRetry: false, dragFallback: true, message: null });

    try {
      await Promise.resolve(this.canvas.requestPointerLock());
      if (this.owner.pointerLockElement === this.canvas) {
        this.publish({ state: 'LOCKED', canRetry: false, dragFallback: false, message: null });
      } else if (this.snapshot.state === 'REQUESTING') {
        this.onPointerLockError();
      }
    } catch (reason: unknown) {
      const detail = reason instanceof Error && reason.message ? ` ${reason.message}` : '';
      this.publish({
        state: 'DENIED',
        canRetry: true,
        dragFallback: true,
        message: `Mouse capture was denied.${detail} Try again, use a controller, or hold right-click to look.`,
      });
    }
    return this.snapshot;
  }

  release(): void {
    if (this.owner.pointerLockElement === this.canvas) this.owner.exitPointerLock?.();
  }

  setDragActive(active: boolean): void {
    this.dragActive = active;
    if (!active) this.dragDelta = { x: 0, y: 0 };
  }

  handlePointerMove(event: Pick<PointerEvent, 'movementX' | 'movementY'>): void {
    if (!this.dragActive || this.snapshot.state === 'LOCKED') return;
    this.dragDelta.x += event.movementX;
    this.dragDelta.y += event.movementY;
  }

  consumeDragDelta(): { x: number; y: number } {
    const delta = this.dragDelta;
    this.dragDelta = { x: 0, y: 0 };
    return delta;
  }

  subscribe(listener: (snapshot: PointerLockSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    this.owner.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.owner.removeEventListener('pointerlockerror', this.onPointerLockError);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.listeners.clear();
  }

  private publish(snapshot: PointerLockSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
