import type { InputDevice } from '../game/input/inputBindings';

export type PairingScreenProps = {
  /** True only after a real WebMCP agent has completed `join_heist`. */
  partnerOnline?: boolean;
  /** Display name reported by the joining agent, when it supplied one. */
  partnerName?: string | null;
  /** Session id returned by `join_heist`. */
  sessionId?: string | null;
  /** True when a valid local checkpoint can be resumed. */
  canContinue?: boolean;
  onStartHeist?: () => void;
  onContinueFromCheckpoint?: () => void;
  onOpenMemory?: () => void;
  inputDevice?: InputDevice;
};

const CREW = [
  { key: 'owen', tag: 'AYE', name: 'Owen “Aye” Mercer', role: 'Cover · Detonator' },
  { key: 'cody', tag: 'X', name: 'Cody “X” Vance', role: 'Planter · Point' },
] as const;

function LockIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M4.6 7.2V5a3.4 3.4 0 0 1 6.8 0v2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="2.9" y="7.2" width="10.2" height="6.6" fill="currentColor" />
    </svg>
  );
}

function AdvanceIcon() {
  return (
    <svg className="btn__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d="M2 8h10.5M9 4.5 12.5 8 9 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function PairingScreen({
  partnerOnline = false,
  partnerName = null,
  sessionId = null,
  canContinue = false,
  onStartHeist,
  onContinueFromCheckpoint,
  onOpenMemory,
  inputDevice = 'KEYBOARD_MOUSE',
}: PairingScreenProps) {
  const partnerLabel = partnerName?.trim() || 'The partner';

  return (
    <div className="pair">
      <header className="pair__rail pair__rail--top">
        <span className="pair__mark">
          RealSid Games <b>//</b> HS: Heist
        </span>
        <span className="pair__rail-spacer" />
        <span className="pair__rail-item--optional">Sector 07 · Lockdown</span>
        <span>Session {sessionId ?? '—— ——'}</span>
      </header>

      <main className="pair__stage">
        <div className="pair__brief">
          <p className="pair__eyebrow m-rise m-rise-1">Partner link</p>

          <div className="pair__status" aria-live="polite">
            <p
              className={`pair__link m-rise m-rise-2 ${
                partnerOnline ? 'pair__link--online' : 'pair__link--standby'
              }`}
            >
              <span className="pair__dot" />
              {partnerOnline ? 'Handshake accepted' : 'No inbound link'}
            </p>

            <h1
              className={`pair__headline m-rise m-rise-2 ${
                partnerOnline ? 'pair__headline--online' : ''
              }`}
            >
              {partnerOnline ? 'PARTNER ONLINE' : 'WAITING FOR PARTNER'}
            </h1>
          </div>

          <div className="pair__underline m-rule" />

          <p className="pair__instruction m-rise m-rise-3">
            {partnerOnline ? (
              <>
                <b>{partnerLabel}</b> holds the other body now. Owen and Cody are behind cover
                inside the facility, and the lockdown is still running.
              </>
            ) : (
              <>
                Ask ChatGPT or Codex to <b>join the heist</b> on this page. Two infiltrators need
                two decision-makers — there is no solo way out of this facility.
              </>
            )}
          </p>

          <ul className="pair__crew m-rise m-rise-3">
            {CREW.map((member) => (
              <li key={member.key} className={`crew crew--${member.key}`}>
                <span className="crew__tag">{member.tag}</span>
                <span className="crew__id">
                  <span className="crew__name">{member.name}</span>
                  <span className="crew__role">{member.role}</span>
                </span>
                <span className={`crew__state ${partnerOnline ? 'crew__state--live' : ''}`}>
                  {partnerOnline ? 'Ready' : 'Standby'}
                </span>
              </li>
            ))}
          </ul>

          <div className="pair__actions m-rise m-rise-4">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!partnerOnline}
              aria-describedby={partnerOnline ? undefined : 'pair-lock-note'}
              onClick={onStartHeist}
            >
              {partnerOnline ? <AdvanceIcon /> : <LockIcon />}
              Start heist
            </button>

            {partnerOnline && canContinue ? (
              <button type="button" className="btn btn--ghost" onClick={onContinueFromCheckpoint}>
                Continue from checkpoint
              </button>
            ) : null}

            <button type="button" className="btn btn--ghost" onClick={onOpenMemory}>
              Partner memory
            </button>
          </div>

          {partnerOnline ? null : (
            <p className="pair__locknote" id="pair-lock-note">
              Start unlocks the moment the partner joins
            </p>
          )}
        </div>

        <aside className="pair__plate" aria-hidden="true">
          <span className="plate__lamp" />
          <span className="plate__seam" />
          <p className="plate__label">Bay · Blast door</p>
          <p className="plate__stencil">07</p>
          <div className="plate__foot">
            <div className="plate__hazard" />
            <p className="plate__caption">
              <span className="plate__strobe" />
              Facility lockdown active
            </p>
          </div>
        </aside>
      </main>

      <footer className="pair__rail pair__rail--bottom">
        <span>
          Best experienced with a controller or external mouse
          {inputDevice === 'KEYBOARD_MOUSE' ? '' : ` · ${inputDevice === 'PLAYSTATION' ? 'PlayStation' : inputDevice === 'XBOX' ? 'Xbox' : 'Controller'} active`}
        </span>
        <span className="pair__rail-item--optional">No solo mode</span>
        <span className="pair__rail-spacer" />
        <span className="pair__rail-item--optional">
          Switch bodies · Share risk · Remember the failure
        </span>
      </footer>
    </div>
  );
}
