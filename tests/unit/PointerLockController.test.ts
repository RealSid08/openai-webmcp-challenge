import { PointerLockController } from '../../src/game/input/PointerLockController';

describe('PointerLockController', () => {
  it('reports a rejected request as retryable without disabling drag fallback', async () => {
    const canvas = document.createElement('canvas');
    canvas.requestPointerLock = vi
      .fn<() => Promise<void>>()
      .mockRejectedValue(new DOMException('Pointer lock was denied.', 'NotAllowedError'));

    const controller = new PointerLockController(canvas, document);
    const snapshot = await controller.request();

    expect(snapshot).toMatchObject({
      state: 'DENIED',
      canRetry: true,
      dragFallback: true,
    });
    expect(snapshot.message).toContain('denied');
    controller.dispose();
  });

  it('reports the unavailable state when the browser has no pointer lock API', async () => {
    const canvas = document.createElement('canvas');
    Object.defineProperty(canvas, 'requestPointerLock', { configurable: true, value: undefined });
    const controller = new PointerLockController(canvas, document);

    expect(await controller.request()).toMatchObject({
      state: 'UNAVAILABLE',
      canRetry: false,
      dragFallback: true,
    });
    controller.dispose();
  });

  it('accumulates fallback look movement only while secondary drag is active', () => {
    const canvas = document.createElement('canvas');
    const controller = new PointerLockController(canvas, document);

    controller.handlePointerMove({ movementX: 5, movementY: -2 } as PointerEvent);
    expect(controller.consumeDragDelta()).toEqual({ x: 0, y: 0 });

    controller.setDragActive(true);
    controller.handlePointerMove({ movementX: 5, movementY: -2 } as PointerEvent);
    controller.handlePointerMove({ movementX: 3, movementY: 1 } as PointerEvent);
    expect(controller.consumeDragDelta()).toEqual({ x: 8, y: -1 });
    expect(controller.consumeDragDelta()).toEqual({ x: 0, y: 0 });
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
