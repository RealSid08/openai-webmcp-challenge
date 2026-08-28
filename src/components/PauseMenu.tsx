import { useDialogFocus } from './ControlsOverlay';

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
