export interface ControlSettings {
  mouseSensitivity: number;
}

export const DEFAULT_CONTROL_SETTINGS: Readonly<ControlSettings> = {
  mouseSensitivity: 0.7,
};

export const MOUSE_SENSITIVITY_RANGE = {
  min: 0.25,
  max: 1.5,
  step: 0.05,
} as const;

export const CONTROL_SETTINGS_STORAGE_KEY = 'hs-heist:control-settings';

export function clampMouseSensitivity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_CONTROL_SETTINGS.mouseSensitivity;
  return Math.min(Math.max(value, MOUSE_SENSITIVITY_RANGE.min), MOUSE_SENSITIVITY_RANGE.max);
}

export function loadControlSettings(storage: Pick<Storage, 'getItem'>): ControlSettings {
  try {
    const saved = storage.getItem(CONTROL_SETTINGS_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_CONTROL_SETTINGS };
    const parsed = JSON.parse(saved) as Partial<ControlSettings>;
    return {
      mouseSensitivity: clampMouseSensitivity(
        typeof parsed.mouseSensitivity === 'number'
          ? parsed.mouseSensitivity
          : DEFAULT_CONTROL_SETTINGS.mouseSensitivity,
      ),
    };
  } catch {
    return { ...DEFAULT_CONTROL_SETTINGS };
  }
}

export function saveControlSettings(
  storage: Pick<Storage, 'setItem'>,
  settings: ControlSettings,
): void {
  storage.setItem(
    CONTROL_SETTINGS_STORAGE_KEY,
    JSON.stringify({ mouseSensitivity: clampMouseSensitivity(settings.mouseSensitivity) }),
  );
}
