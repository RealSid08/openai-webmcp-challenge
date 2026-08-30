import {
  DEFAULT_CONTROL_SETTINGS,
  MOUSE_SENSITIVITY_RANGE,
  type ControlSettings,
} from '../game/input/controlSettings';

interface SensitivityControlProps {
  settings: ControlSettings;
  onChange: (settings: ControlSettings) => void;
}

function sensitivityLabel(value: number): string {
  if (Math.abs(value - DEFAULT_CONTROL_SETTINGS.mouseSensitivity) < 0.001) return 'Default';
  return value < DEFAULT_CONTROL_SETTINGS.mouseSensitivity ? 'Lower than default' : 'Higher than default';
}

export function SensitivityControl({ settings, onChange }: SensitivityControlProps) {
  return (
    <fieldset className="sensitivity-settings">
      <legend>Look controls</legend>
      <label className="sensitivity-settings__control">
        <span>Mouse sensitivity</span>
        <input
          type="range"
          min={MOUSE_SENSITIVITY_RANGE.min}
          max={MOUSE_SENSITIVITY_RANGE.max}
          step={MOUSE_SENSITIVITY_RANGE.step}
          value={settings.mouseSensitivity}
          aria-label="Mouse sensitivity"
          aria-valuetext={sensitivityLabel(settings.mouseSensitivity)}
          onChange={(event) =>
            onChange({ mouseSensitivity: Number(event.currentTarget.value) })
          }
        />
      </label>
      <div className="sensitivity-settings__scale" aria-hidden="true">
        <span>Low</span>
        <span>Default</span>
        <span>High</span>
      </div>
      <button
        type="button"
        className="sensitivity-settings__reset"
        disabled={
          Math.abs(
            settings.mouseSensitivity - DEFAULT_CONTROL_SETTINGS.mouseSensitivity,
          ) < 0.001
        }
        onClick={() => onChange({ ...DEFAULT_CONTROL_SETTINGS })}
      >
        Reset sensitivity
      </button>
    </fieldset>
  );
}
