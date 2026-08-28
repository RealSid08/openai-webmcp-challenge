export type CompatibilityReason = 'SMALL_SCREEN' | 'TOUCH_ONLY' | 'UNSUPPORTED_INPUT';

export interface CompatibilityNoticeProps {
  reason?: CompatibilityReason;
  /** Extra context from the detection, e.g. the measured viewport width. */
  detail?: string;
  requirements?: readonly string[];
}

const REASON_LINES: Record<CompatibilityReason, string> = {
  SMALL_SCREEN: 'This window is too small to read the HUD, subtitles, and failure causes.',
  TOUCH_ONLY: 'This device reports touch input only, and the mission needs a mouse to aim.',
  UNSUPPORTED_INPUT: 'This device cannot provide the keyboard and mouse the mission needs.',
};

const DEFAULT_REQUIREMENTS: readonly string[] = [
  'A desktop or laptop browser',
  'A keyboard and a mouse',
  'A window at least 1280 by 720',
  'A WebMCP-capable agent to hold the second body',
];

export function CompatibilityNotice({
  reason = 'UNSUPPORTED_INPUT',
  detail,
  requirements = DEFAULT_REQUIREMENTS,
}: CompatibilityNoticeProps) {
  return (
    <div className="compat" role="alert">
      <div className="compat__card">
        <p className="compat__eyebrow">Cannot start here</p>
        <h1 className="compat__title">Desktop required</h1>
        <p className="compat__lede">{REASON_LINES[reason]}</p>
        {detail ? <p className="compat__detail">{detail}</p> : null}

        <ul className="compat__list">
          {requirements.map((requirement) => (
            <li className="compat__item" key={requirement}>
              {requirement}
            </li>
          ))}
        </ul>

        <p className="compat__foot">
          Open this page on a desktop browser and the pairing screen will take it from there.
        </p>
      </div>
    </div>
  );
}
