import { detectInputDevice, type InputDevice } from './inputBindings';

export interface InputFrame {
  device: InputDevice;
  move: { x: number; y: number };
  look: { x: number; y: number };
  aim: number;
  fire: number;
  reloadPressed: boolean;
  interactPressed: boolean;
  switchPressed: boolean;
  calloutPressed: boolean;
  pausePressed: boolean;
  skipTrainingHeld: boolean;
  sprinting: boolean;
}

interface InputManagerOptions {
  target?: Window;
  getGamepads?: () => readonly (Gamepad | null)[];
  consumePointerDelta?: () => { x: number; y: number };
}

const GAMEPAD_DEAD_ZONE = 0.16;

function radialDeadZone(x: number, y: number): { x: number; y: number } {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= GAMEPAD_DEAD_ZONE) return { x: 0, y: 0 };
  if (magnitude >= 1) return { x: x / magnitude, y: y / magnitude };
  const scaled = (magnitude - GAMEPAD_DEAD_ZONE) / (1 - GAMEPAD_DEAD_ZONE);
  return { x: (x / magnitude) * scaled, y: (y / magnitude) * scaled };
}

function value(button: GamepadButton | undefined): number {
  return button?.value ?? 0;
}

function pressed(buttons: readonly GamepadButton[], index: number): boolean {
  return buttons[index]?.pressed === true || value(buttons[index]) > 0.5;
}

export function sampleGamepad(
  pad: Gamepad,
  previousPressed: ReadonlySet<number>,
  sprinting: boolean,
): InputFrame {
  const move = radialDeadZone(pad.axes[0] ?? 0, -(pad.axes[1] ?? 0));
  const look = radialDeadZone(pad.axes[2] ?? 0, -(pad.axes[3] ?? 0));
  const edge = (index: number) => pressed(pad.buttons, index) && !previousPressed.has(index);
  return {
    device: detectInputDevice(pad.id),
    move,
    look,
    aim: value(pad.buttons[6]),
    fire: value(pad.buttons[7]),
    reloadPressed: edge(2),
    interactPressed: edge(0),
    switchPressed: edge(3),
    calloutPressed: edge(1),
    pausePressed: edge(9),
    skipTrainingHeld: pressed(pad.buttons, 13),
    sprinting,
  };
}

function meaningfulGamepadInput(pad: Gamepad): boolean {
  return pad.axes.some((axis) => Math.abs(axis) > GAMEPAD_DEAD_ZONE) || pad.buttons.some((item) => item.pressed || item.value > 0.1);
}

export class InputManager {
  private readonly target: Window;
  private readonly getGamepads: () => readonly (Gamepad | null)[];
  private readonly consumePointerDelta: () => { x: number; y: number };
  private readonly keys = new Set<string>();
  private readonly keyEdges = new Set<string>();
  private readonly gamepadPressed = new Set<number>();
  private activeDevice: InputDevice = 'KEYBOARD_MOUSE';
  private sprinting = true;
  private mouseAim = false;
  private mouseFire = false;
  private mouseDelta = { x: 0, y: 0 };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (!this.keys.has(event.code)) {
      this.keyEdges.add(event.code);
      if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.sprinting = !this.sprinting;
    }
    this.keys.add(event.code);
    this.activeDevice = 'KEYBOARD_MOUSE';
  };

  private readonly onKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);
  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.button === 0) this.mouseFire = true;
    if (event.button === 2) this.mouseAim = true;
    this.activeDevice = 'KEYBOARD_MOUSE';
  };
  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.button === 0) this.mouseFire = false;
    if (event.button === 2) this.mouseAim = false;
  };
  private readonly onMouseMove = (event: MouseEvent) => {
    if (event.movementX === 0 && event.movementY === 0) return;
    this.mouseDelta.x += event.movementX;
    this.mouseDelta.y += event.movementY;
    this.activeDevice = 'KEYBOARD_MOUSE';
  };

  constructor(options: InputManagerOptions = {}) {
    this.target = options.target ?? window;
    this.getGamepads = options.getGamepads ?? (() => navigator.getGamepads?.() ?? []);
    this.consumePointerDelta = options.consumePointerDelta ?? (() => ({ x: 0, y: 0 }));
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('pointerdown', this.onPointerDown);
    this.target.addEventListener('pointerup', this.onPointerUp);
    this.target.addEventListener('mousemove', this.onMouseMove);
  }

  poll(): InputFrame {
    const pad = this.getGamepads().find((candidate): candidate is Gamepad => candidate?.connected === true);
    if (pad && meaningfulGamepadInput(pad)) {
      if (pressed(pad.buttons, 10) && !this.gamepadPressed.has(10)) this.sprinting = !this.sprinting;
      const frame = sampleGamepad(pad, this.gamepadPressed, this.sprinting);
      this.activeDevice = frame.device;
      this.gamepadPressed.clear();
      pad.buttons.forEach((item, index) => {
        if (item.pressed || item.value > 0.5) this.gamepadPressed.add(index);
      });
      return frame;
    }

    if (!pad) this.gamepadPressed.clear();
    const fallback = this.consumePointerDelta();
    const look = { x: this.mouseDelta.x + fallback.x, y: this.mouseDelta.y + fallback.y };
    this.mouseDelta = { x: 0, y: 0 };
    const edge = (code: string) => this.keyEdges.has(code);
    const frame: InputFrame = {
      device: this.activeDevice === 'KEYBOARD_MOUSE' || !pad ? 'KEYBOARD_MOUSE' : this.activeDevice,
      move: {
        x: Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')),
        y: Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')),
      },
      look,
      aim: Number(this.mouseAim),
      fire: Number(this.mouseFire),
      reloadPressed: edge('KeyR'),
      interactPressed: edge('KeyE'),
      switchPressed: edge('KeyQ'),
      calloutPressed: ['Digit1', 'Digit2', 'Digit3', 'Digit4'].some(edge),
      pausePressed: edge('Escape'),
      skipTrainingHeld: this.keys.has('KeyT'),
      sprinting: this.sprinting,
    };
    this.keyEdges.clear();
    return frame;
  }

  resetForCheckpoint(): void {
    this.keys.clear();
    this.keyEdges.clear();
    this.gamepadPressed.clear();
    this.sprinting = true;
    this.mouseAim = false;
    this.mouseFire = false;
    this.mouseDelta = { x: 0, y: 0 };
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('pointerdown', this.onPointerDown);
    this.target.removeEventListener('pointerup', this.onPointerUp);
    this.target.removeEventListener('mousemove', this.onMouseMove);
  }
}
