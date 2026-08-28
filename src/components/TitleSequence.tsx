/**
 * Stage of the identity sequence. The parent owns the timing so the sequence
 * can be replayed, skipped, or held while the facility scene warms up.
 */
export type TitleStage = 'PRESENTS' | 'LOCKUP' | 'FADE_OUT';

export interface TitleSequenceProps {
  stage: TitleStage;
  /** Only true once the sequence has already been seen in this browser history. */
  canSkip?: boolean;
  onSkip?: () => void;
}

export function TitleSequence({ stage, canSkip = false, onSkip }: TitleSequenceProps) {
  return (
    <div
      className={`title title--${stage.toLowerCase().replaceAll('_', '-')}`}
      role="region"
      aria-label="Title sequence"
    >
      <p className="title__presents">RealSid Games Presents</p>

      <h1 className="title__lockup">
        <span className="title__mark">HS</span>
        <span className="title__sub">Heist</span>
      </h1>

      {canSkip && onSkip ? (
        <button type="button" className="title__skip" onClick={onSkip}>
          Skip sequence
        </button>
      ) : null}
    </div>
  );
}
