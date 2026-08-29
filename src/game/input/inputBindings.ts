export type InputDevice = 'KEYBOARD_MOUSE' | 'XBOX' | 'PLAYSTATION' | 'GENERIC_GAMEPAD';

export interface ControlBinding {
  keys: string;
  action: string;
  note?: string;
}

export interface ControlGroup {
  title: string;
  bindings: readonly ControlBinding[];
}

export function detectInputDevice(id: string): Exclude<InputDevice, 'KEYBOARD_MOUSE'> {
  const normalized = id.toLowerCase();
  if (/playstation|dualsense|dualshock|sony|vendor:\s*054c/.test(normalized)) return 'PLAYSTATION';
  if (/xbox|xinput|microsoft|vendor:\s*045e/.test(normalized)) return 'XBOX';
  return 'GENERIC_GAMEPAD';
}

const KEYBOARD_GROUPS: readonly ControlGroup[] = [
  {
    title: 'On foot',
    bindings: [
      { keys: 'W A S D', action: 'Move' },
      { keys: 'Shift', action: 'Toggle sprint / walk', note: 'Sprint starts enabled' },
      { keys: 'Mouse', action: 'Look' },
      { keys: 'Right mouse', action: 'Aim or drag-to-look fallback' },
    ],
  },
  {
    title: 'Weapon and mission',
    bindings: [
      { keys: 'Left mouse', action: 'Fire' },
      { keys: 'R', action: 'Reload' },
      { keys: 'E', action: 'Interact or detonate' },
      { keys: 'Q', action: 'Switch characters' },
      { keys: '1 – 4', action: 'Partner callouts' },
      { keys: 'Esc', action: 'Pause' },
    ],
  },
];

function controllerGroups(playStation: boolean): readonly ControlGroup[] {
  return [
    {
      title: 'Controller movement',
      bindings: [
        { keys: 'Left stick', action: 'Move' },
        { keys: 'Right stick', action: 'Look' },
        { keys: playStation ? 'L3' : 'LS', action: 'Toggle sprint / walk', note: 'Sprint starts enabled' },
        { keys: playStation ? 'L2' : 'LT', action: 'Aim' },
        { keys: playStation ? 'R2' : 'RT', action: 'Fire' },
      ],
    },
    {
      title: 'Controller actions',
      bindings: [
        { keys: playStation ? 'Square' : 'X', action: 'Reload' },
        { keys: playStation ? 'Cross' : 'A', action: 'Interact or detonate' },
        { keys: playStation ? 'Triangle' : 'Y', action: 'Switch characters' },
        { keys: playStation ? 'Circle' : 'B', action: 'Partner callout' },
        { keys: playStation ? 'Options' : 'Menu', action: 'Pause' },
      ],
    },
  ];
}

export function getControlGroups(device: InputDevice): readonly ControlGroup[] {
  if (device === 'KEYBOARD_MOUSE') return KEYBOARD_GROUPS;
  return controllerGroups(device === 'PLAYSTATION');
}
