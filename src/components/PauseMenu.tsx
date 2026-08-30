import { useDialogFocus } from './ControlsOverlay';
import type { AudioSettings } from '../audio/AdaptiveAudioDirector';

export interface PauseMenuProps {
  sectionLabel?: string;
  objective?: string;
  /** Pre-formatted mission clock, e.g. `04:12`. */
  elapsedLabel?: string;
  /** Readable name of the checkpoint a restart would restore. */
  checkpointLabel?: string;
  onResume: () => void;
  onOpenControls: () => void;
  onOpenMemory: () => void;
  onRestartCheckpoint: () => void;
  onReturnToPairing: () => void;
  audio: AudioSettings;
  onAudioChange: (settings: AudioSettings) => void;
}

export function PauseMenu({
  sectionLabel,
  objective,
  elapsedLabel,
  checkpointLabel,
  onResume,
  onOpenControls,
  onOpenMemory,
  onRestartCheckpoint,
  onReturnToPairing,
  audio,
  onAudioChange,
}: PauseMenuProps) {
  const { ref, onKeyDown } = useDialogFocus<HTMLDivElement>(onResume);

  return (
    <div className="scrim scrim--pause">
      <div
        ref={ref}
        className="panel panel--pause"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <header className="panel__head">
          <p className="panel__eyebrow">Mission held</p>
          <h2 className="panel__title" id="pause-title">
            Paused
          </h2>
          {objective ? <p className="panel__lede">{objective}</p> : null}
        </header>

        <dl className="pausestate">
          {sectionLabel ? (
            <div className="pausestate__row">
              <dt>Section</dt>
              <dd>{sectionLabel}</dd>
            </div>
          ) : null}
          {checkpointLabel ? (
            <div className="pausestate__row">
              <dt>Checkpoint</dt>
              <dd>{checkpointLabel}</dd>
            </div>
          ) : null}
          {elapsedLabel ? (
            <div className="pausestate__row">
              <dt>Run time</dt>
              <dd>{elapsedLabel}</dd>
            </div>
          ) : null}
        </dl>

        <fieldset className="audio-settings">
          <legend>Audio</legend>
          <label>
            <span>Music <b>{Math.round(audio.music * 100)}</b></span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(audio.music * 100)}
              aria-label="Music volume"
              onChange={(event) =>
                onAudioChange({ ...audio, music: Number(event.currentTarget.value) / 100 })
              }
            />
          </label>
          <label>
            <span>Effects <b>{Math.round(audio.effects * 100)}</b></span>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(audio.effects * 100)}
              aria-label="Effects volume"
              onChange={(event) =>
                onAudioChange({ ...audio, effects: Number(event.currentTarget.value) / 100 })
              }
            />
          </label>
        </fieldset>

        <div className="pausemenu">
          <button type="button" className="ui-btn ui-btn--primary" onClick={onResume}>
            Resume
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onOpenControls}>
            Controls
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onOpenMemory}>
            Partner memory
          </button>
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onRestartCheckpoint}>
            Restart checkpoint
          </button>
          <button type="button" className="ui-btn ui-btn--quiet" onClick={onReturnToPairing}>
            Return to pairing
          </button>
        </div>

        <p className="panel__hint">
          Danger, deadlines, and switch cooldowns are all frozen while this is open.
        </p>
      </div>
    </div>
  );
}
