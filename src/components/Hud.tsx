export type HudCharacterId = 'OWEN' | 'CODY';
export type HudController = 'HUMAN' | 'AGENT';
export type HudBombStatus = 'UNPLACED' | 'PLANTING' | 'ARMED' | 'DETONATED';

export interface HudCharacter {
  id: HudCharacterId;
  name: string;
  /** Short callsign stencil: `AYE`, `X`. */
  tag: string;
  health: number;
  maxHealth: number;
  controlledBy: HudController;
  /** Chase seat or facility role, when one is assigned. */
  role?: string;
}

export interface HudTimer {
  label: string;
  secondsRemaining: number;
  totalSeconds: number;
}

export interface HudRadioLine {
  id: string;
  /** Character or callsign the line belongs to. */
  speaker: string;
  /** Agent-authored text. Always rendered as text, never markup. */
  text: string;
  priority: 'CHATTER' | 'CRITICAL';
}

export interface HudCallout {
  id: string;
  label: string;
  /** Key hint shown beside the callout. */
  key: string;
}

export interface HudAmmo {
  magazine: number;
  reserve: number;
  capacity: number;
}

export interface HudProps {
  characters: readonly HudCharacter[];
  objective: string;
  sectionLabel?: string;
  bombStatus?: HudBombStatus | null;
  criticalIncidents: { count: number; limit: number };
  /** Transient `CRITICAL ERROR` banner text. The parent owns how long it stays. */
  criticalAlert?: string | null;
  /** Forced-switch countdown shown beside the objective. */
  lockTimer?: HudTimer | null;
  /** Required agent decision window. Outranks every other objective timer. */
  decisionTimer?: HudTimer | null;
  /** Short non-blocking switch feedback, e.g. cooldown remaining. */
  switchNotice?: string | null;
  ammo?: HudAmmo | null;
  weaponLabel?: string;
  vehicle?: { integrity: number; maxIntegrity: number; label?: string } | null;
  /** First-time contextual prompt. Sits above the subtitles, never over them. */
  prompt?: { title: string; body: string } | null;
  radioLines?: readonly HudRadioLine[];
  activeCallout?: { label: string; acknowledged?: boolean } | null;
  callouts?: readonly HudCallout[];
  onCallout?: (calloutId: string) => void;
  memoryNotice?: string | null;
  showReticle?: boolean;
}

export const DEFAULT_CALLOUTS: readonly HudCallout[] = [
  { id: 'COVER_ME', label: 'Cover me', key: '1' },
  { id: 'HOLD', label: 'Hold', key: '2' },
  { id: 'MOVE', label: 'Move', key: '3' },
  { id: 'FOCUS_TARGET', label: 'Focus target', key: '4' },
];

const BOMB_LABELS: Record<HudBombStatus, string> = {
  UNPLACED: 'Charge unplaced',
  PLANTING: 'Charge going in',
  ARMED: 'Charge armed',
  DETONATED: 'Gate breached',
};

/** Visible subtitle depth. Older chatter scrolls off rather than growing the block. */
const SUBTITLE_WINDOW = 3;

function ratio(value: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

function healthTone(fraction: number): 'ok' | 'hurt' | 'critical' {
  if (fraction <= 0.25) return 'critical';
  if (fraction <= 0.55) return 'hurt';
  return 'ok';
}

function Vitals({ character }: { character: HudCharacter }) {
  const fraction = ratio(character.health, character.maxHealth);
  const tone = healthTone(fraction);
  const down = character.health <= 0;

  return (
    <li
      className={`vital vital--${character.id.toLowerCase()} ${
        character.controlledBy === 'HUMAN' ? 'vital--human' : ''
      }`}
      data-tone={tone}
    >
      <span className="vital__tag" aria-hidden="true">
        {character.tag}
      </span>

      <span className="vital__body">
        <span className="vital__head">
          <span className="vital__name">{character.name}</span>
          <span className="vital__owner">
            {character.controlledBy === 'HUMAN' ? 'You' : 'Partner'}
          </span>
        </span>

        <span className="vital__bar">
          <span className="vital__fill" style={{ width: `${fraction * 100}%` }} />
        </span>

        <span className="vital__foot">
          <span className="vital__role">{character.role ?? (down ? 'Down' : 'Active')}</span>
          <span className="vital__count">
            {Math.max(Math.round(character.health), 0)}
            <span aria-hidden="true"> / {character.maxHealth}</span>
            <span className="u-visually-hidden"> of {character.maxHealth} health</span>
          </span>
        </span>
      </span>
    </li>
  );
}

function TimerRow({ timer, kind }: { timer: HudTimer; kind: 'lock' | 'decision' }) {
  const seconds = Math.max(timer.secondsRemaining, 0);
  const fraction = ratio(seconds, timer.totalSeconds);

  return (
    <div className={`hudtimer hudtimer--${kind}`}>
      <span className="hudtimer__label">{timer.label}</span>
      <span className="hudtimer__value">{seconds.toFixed(1)}s</span>
      <span className="hudtimer__track" aria-hidden="true">
        <span className="hudtimer__fill" style={{ width: `${fraction * 100}%` }} />
      </span>
    </div>
  );
}

export function Hud({
  characters,
  objective,
  sectionLabel,
  bombStatus = null,
  criticalIncidents,
  criticalAlert = null,
  lockTimer = null,
  decisionTimer = null,
  switchNotice = null,
  ammo = null,
  weaponLabel = 'Sidearm',
  vehicle = null,
  prompt = null,
  radioLines = [],
  activeCallout = null,
  callouts = DEFAULT_CALLOUTS,
  onCallout,
  memoryNotice = null,
  showReticle = true,
}: HudProps) {
  const visibleLines = radioLines.slice(-SUBTITLE_WINDOW);
  const vehicleFraction = vehicle ? ratio(vehicle.integrity, vehicle.maxIntegrity) : 0;
  const magazineEmpty = ammo ? ammo.magazine <= 0 : false;

  return (
    <div className="hud">
      {showReticle ? <div className="hud__reticle" aria-hidden="true" /> : null}

      <section className="hud__vitals" aria-label="Infiltrator status">
        <ul className="hud__vitallist">
          {characters.map((character) => (
            <Vitals key={character.id} character={character} />
          ))}
        </ul>
      </section>

      <section className="hud__objective" aria-label="Objective">
        {sectionLabel ? <p className="hud__section">{sectionLabel}</p> : null}
        <p className="hud__objectivetext">{objective}</p>

        {bombStatus ? <p className="hud__bomb" data-state={bombStatus}>{BOMB_LABELS[bombStatus]}</p> : null}

        {decisionTimer ? <TimerRow timer={decisionTimer} kind="decision" /> : null}
        {lockTimer ? <TimerRow timer={lockTimer} kind="lock" /> : null}

        <p className="hud__incidents" data-limit={criticalIncidents.count >= criticalIncidents.limit - 1}>
          <span className="hud__incidentlabel">Critical</span>
          <span className="hud__incidentcount">
            {criticalIncidents.count} / {criticalIncidents.limit}
          </span>
        </p>

        <div className="hud__alerts" aria-live="assertive">
          {criticalAlert ? (
            <p className="hud__critical">
              <span className="hud__criticaltitle">Critical error</span>
              <span className="hud__criticalbody">{criticalAlert}</span>
            </p>
          ) : null}
        </div>

        <div className="hud__switchnotice" aria-live="polite">
          {switchNotice ? <p className="hud__switchtext">{switchNotice}</p> : null}
        </div>
      </section>

      <section className="hud__lower" aria-label="Partner communication">
        {prompt ? (
          <div className="hudprompt">
            <p className="hudprompt__title">{prompt.title}</p>
            <p className="hudprompt__body">{prompt.body}</p>
          </div>
        ) : null}

        <div className="hud__subs" aria-live="polite">
          {visibleLines.map((line) => (
            <p key={line.id} className={`sub sub--${line.priority.toLowerCase()}`}>
              <span className="sub__speaker">{line.speaker}</span>
              <span className="sub__text">{line.text}</span>
            </p>
          ))}
        </div>

        {activeCallout ? (
          <p className="hud__calloutack" aria-live="polite">
            <span className="hud__calloutlabel">Callout</span>
            <span className="hud__calloutvalue">{activeCallout.label}</span>
            {activeCallout.acknowledged ? (
              <span className="hud__calloutstate">Acknowledged</span>
            ) : (
              <span className="hud__calloutstate hud__calloutstate--pending">Sent</span>
            )}
          </p>
        ) : null}

        {callouts.length > 0 ? (
          <ul className="hud__callouts">
            {callouts.map((callout) => (
              <li key={callout.id}>
                <button
                  type="button"
                  className="calloutkey"
                  onClick={onCallout ? () => onCallout(callout.id) : undefined}
                >
                  <span className="calloutkey__key" aria-hidden="true">
                    {callout.key}
                  </span>
                  {callout.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="hud__right" aria-label="Loadout and vehicle">
        {vehicle ? (
          <div className="hudvehicle" data-tone={healthTone(vehicleFraction)}>
            <p className="hudvehicle__label">{vehicle.label ?? 'Getaway car'}</p>
            <span className="hudvehicle__bar">
              <span className="hudvehicle__fill" style={{ width: `${vehicleFraction * 100}%` }} />
            </span>
            <p className="hudvehicle__value">
              {Math.max(Math.round(vehicle.integrity), 0)}
              <span aria-hidden="true">%</span>
              <span className="u-visually-hidden"> percent integrity</span>
            </p>
          </div>
        ) : null}

        {ammo ? (
          <div className={`hudammo ${magazineEmpty ? 'hudammo--empty' : ''}`}>
            <p className="hudammo__weapon">{weaponLabel}</p>
            <p className="hudammo__counts">
              <span className="hudammo__magazine">{ammo.magazine}</span>
              <span className="hudammo__divider" aria-hidden="true">
                /
              </span>
              <span className="hudammo__reserve">{ammo.reserve}</span>
            </p>
            <p className="hudammo__state">
              {magazineEmpty ? 'Reload' : `Magazine ${ammo.magazine} of ${ammo.capacity}`}
            </p>
          </div>
        ) : null}
      </section>

      <div className="hud__notice" aria-live="polite">
        {memoryNotice ? <p className="hudnotice">{memoryNotice}</p> : null}
      </div>
    </div>
  );
}
