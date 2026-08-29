import { InputManager, sampleGamepad } from '../../src/game/input/InputManager';
import { detectInputDevice, getControlGroups } from '../../src/game/input/inputBindings';

function button(value = 0): GamepadButton {
  return { pressed: value > 0.5, touched: value > 0, value };
}

function gamepad(id: string, options: { axes?: number[]; buttons?: Record<number, number> } = {}): Gamepad {
  const buttons = Array.from({ length: 18 }, (_, index) => button(options.buttons?.[index] ?? 0));
  return {
    axes: options.axes ?? [0, 0, 0, 0],
    buttons,
    connected: true,
    id,
    index: 0,
    mapping: 'standard',
    timestamp: 1,
    vibrationActuator: null,
    hapticActuators: [],
  } as unknown as Gamepad;
}

describe('InputManager', () => {
  it('starts sprinting and toggles stance once per Shift press', () => {
    const input = new InputManager({ target: window, getGamepads: () => [] });

    expect(input.poll().sprinting).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    expect(input.poll().sprinting).toBe(false);
    expect(input.poll().sprinting).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ShiftLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));
    expect(input.poll().sprinting).toBe(true);
    input.dispose();
  });

  it('normalizes a PlayStation controller to standard FPS actions', () => {
    const frame = sampleGamepad(
      gamepad('Sony DualSense Wireless Controller', {
        axes: [0.5, -1, 0.4, -0.25],
        buttons: { 6: 1, 7: 0.75, 2: 1 },
      }),
      new Set(),
      true,
    );

    expect(frame.device).toBe('PLAYSTATION');
    expect(frame.move.y).toBeCloseTo(0.8944, 3);
    expect(frame.look.x).toBeGreaterThan(0);
    expect(frame.aim).toBe(1);
    expect(frame.fire).toBe(0.75);
    expect(frame.reloadPressed).toBe(true);
  });

  it('applies a radial dead zone without changing full stick input', () => {
    expect(sampleGamepad(gamepad('Xbox Controller', { axes: [0.08, 0.04, 0, 0] }), new Set(), true).move).toEqual({ x: 0, y: 0 });
    expect(sampleGamepad(gamepad('Xbox Controller', { axes: [1, 0, 0, 0] }), new Set(), true).move.x).toBeCloseTo(1, 5);
  });

  it('detects controller family and provides matching accessible labels', () => {
    expect(detectInputDevice('Wireless Controller (STANDARD GAMEPAD Vendor: 054c)')).toBe('PLAYSTATION');
    expect(detectInputDevice('Xbox Wireless Controller')).toBe('XBOX');
    expect(getControlGroups('PLAYSTATION').flatMap((group) => group.bindings).some((binding) => binding.keys === 'L2')).toBe(true);
    expect(getControlGroups('XBOX').flatMap((group) => group.bindings).some((binding) => binding.keys === 'LT')).toBe(true);
  });

  it('switches back to keyboard as soon as meaningful keyboard input arrives', () => {
    let pads: Gamepad[] = [gamepad('Xbox Controller', { axes: [0.8, 0, 0, 0] })];
    const input = new InputManager({ target: window, getGamepads: () => pads });
    expect(input.poll().device).toBe('XBOX');
    pads = [];
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.poll()).toMatchObject({ device: 'KEYBOARD_MOUSE', move: { x: 0, y: 1 } });
    input.dispose();
  });

  it('reports a held training-skip input without making it edge-triggered', () => {
    const input = new InputManager({ target: window, getGamepads: () => [] });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
    expect(input.poll().skipTrainingHeld).toBe(true);
    expect(input.poll().skipTrainingHeld).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyT' }));
    expect(input.poll().skipTrainingHeld).toBe(false);
    input.dispose();
  });
});
