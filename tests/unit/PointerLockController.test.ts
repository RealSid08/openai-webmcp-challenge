import {
  isMouseLookActive,
  PointerLockController,
} from '../../src/game/input/PointerLockController';

describe('PointerLockController', () => {
  it('seamlessly activates lockless control when pointer lock is rejected', async () => {
    const canvas = document.createElement('canvas');
    canvas.requestPointerLock = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new DOMException('Pointer lock was denied.', 'NotAllowedError'));

    const controller = new PointerLockController(canvas, document);
    const snapshot = await controller.request();

    expect(snapshot).toMatchObject({
      state: 'LOCKLESS',
      canRetry: false,
      dragFallback: true,
      message: null,
    });
    expect(isMouseLookActive(snapshot.state)).toBe(true);
    controller.dispose();
  });

  it('seamlessly activates lockless control when the browser has no pointer lock API', async () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: undefined });
    const controller = new PointerLockController(canvas, document);

    expect(await controller.request()).toMatchObject({
      state: 'LOCKLESS',
      canRetry: false,
      dragFallback: true,
      message: null,
    });
    controller.dispose();
  });

  it('turns continuously near the canvas edge without requiring an aim button', async () => {
    const canvas = document.createElement('canvas');
    canvas.requestPointerLock = vi.fn<() => Promise<void>>().mockRejectedValue(
      new DOMException('Pointer lock was denied.', 'NotAllowedError'),
    );
    canvas.getBoundingClientRect = () => ({
      bottom: 800,
      height: 800,
      left: 0,
      right: 1_000,
      top: 0,
      width: 1_000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const controller = new PointerLockController(canvas, document);
    await controller.request();

    controller.handlePointerMove({ clientX: 500, clientY: 400 } as PointerEvent);
    expect(controller.getLocklessEdgeTurn()).toEqual({ x: 0, y: 0 });

    controller.handlePointerMove({ clientX: 990, clientY: 400 } as PointerEvent);
    expect(controller.getLocklessEdgeTurn().x).toBeGreaterThan(0.8);
    expect(controller.getLocklessEdgeTurn().y).toBe(0);
    controller.dispose();
  });

  it('tracks successful lock and release events from the owner document', async () => {
    const canvas = document.createElement('canvas');
    let lockedElement: Element | null = null;
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => lockedElement,
    });
    canvas.requestPointerLock = vi.fn(async () => {
      lockedElement = canvas;
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    Object.defineProperty(document, 'exitPointerLock', {
      configurable: true,
      value: vi.fn(() => {
        lockedElement = null;
        document.dispatchEvent(new Event('pointerlockchange'));
      }),
    });
    const controller = new PointerLockController(canvas, document);

    expect((await controller.request()).state).toBe('LOCKED');
    controller.release();
    expect(controller.getSnapshot().state).toBe('RELEASED');
    controller.dispose();
  });
});
