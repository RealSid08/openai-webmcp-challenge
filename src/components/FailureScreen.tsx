import type { CSSProperties } from 'react';

export type FailureCode =
  | 'PLAYER_DOWN'
  | 'PARTNER_DOWN'
  | 'VEHICLE_DESTROYED'
  | 'MISSION_COMPROMISED';

export interface FailureScreenProps {
  code: FailureCode;
  /** Recorded cause, already phrased for the player. */
  cause: string;
  detail?: string;
  /** Checkpoint the parent is about to restore. */
  checkpointLabel?: string;
  /**
   * Who the recorded cause actually belongs to. Omit it unless the run history
   * attributes the failure, so the card never invents blame.
   */
  attribution?: 'HUMAN' | 'AGENT' | 'ENVIRONMENT';
  /**
   * Length of the restore meter in milliseconds. Presentation only: the parent
   * decides when the card leaves the screen.
   */
  restoreDurationMs?: number;
}

const HEADLINES: Record<FailureCode, string> = {
  PLAYER_DOWN: 'Player down',
  PARTNER_DOWN: 'Partner down',
  VEHICLE_DESTROYED: 'Vehicle destroyed',
  MISSION_COMPROMISED: 'Mission compromised',
};

const ATTRIBUTION_LABELS: Record<
  NonNullable<FailureScreenProps['attribution']>,
  string
> = {
  HUMAN: 'Recorded against your action',
  AGENT: 'Recorded against a partner action',
  ENVIRONMENT: 'Recorded as facility pressure',
};

export function FailureScreen({
  code,
  cause,
  detail,
  checkpointLabel,
  attribution,
  restoreDurationMs = 2000,
}: FailureScreenProps) {
  const meterStyle = { '--fail-hold': `${restoreDurationMs}ms` } as CSSProperties;

  return (
    <div className="scrim scrim--failure">
      <div className="failcard" role="alert" aria-live="assertive">
        <span className="failcard__rule" aria-hidden="true" />

        <p className="failcard__eyebrow">Attempt ended</p>
        <h2 className="failcard__title">{HEADLINES[code]}</h2>
        <p className="failcard__cause">{cause}</p>

        {detail ? <p className="failcard__detail">{detail}</p> : null}

        {attribution ? (
          <p className="failcard__attribution">{ATTRIBUTION_LABELS[attribution]}</p>
        ) : null}

        <div className="failcard__restore">
          <p className="failcard__restoretext">
            {checkpointLabel ? `Restoring ${checkpointLabel}` : 'Restoring the last checkpoint'}
          </p>
          <span className="failcard__meter" style={meterStyle} aria-hidden="true">
            <span className="failcard__meterfill" />
          </span>
        </div>

        <p className="failcard__memory">Partner memory survives this reset.</p>
      </div>
    </div>
  );
}
