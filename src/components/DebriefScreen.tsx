export type DebriefActor = 'HUMAN' | 'AGENT' | 'ENVIRONMENT';

export interface DebriefCharacterResult {
  id: string;
  name: string;
  tag: string;
  survived: boolean;
  health: number;
  maxHealth: number;
}

export interface DebriefFailure {
  id: string;
  /** Failure card headline this attempt showed, e.g. `Mission compromised`. */
  label: string;
  cause: string;
  section?: string;
  attribution?: DebriefActor;
}

export interface DebriefLesson {
  id: string;
  lesson: string;
  evidence: string;
  affectedTactic: string;
  section?: string;
}

export interface DebriefTacticChange {
  id: string;
  tactic: string;
  /** The recorded lesson the partner cited when it chose this tactic. */
  lesson: string;
  outcome?: string;
  section?: string;
}

export interface DebriefScreenProps {
  runLabel?: string;
  runTimeLabel: string;
  characters: readonly DebriefCharacterResult[];
  vehicle?: { integrity: number; maxIntegrity: number } | null;
  checkpointsReached: readonly string[];
  criticalIncidents: number;
  failures: readonly DebriefFailure[];
  lessonsAdded: readonly DebriefLesson[];
  tacticsChanged: readonly DebriefTacticChange[];
  onReplay: () => void;
  onOpenMemory?: () => void;
  onReturnToPairing?: () => void;
}

const ACTOR_LABELS: Record<DebriefActor, string> = {
  HUMAN: 'Your call',
  AGENT: 'Partner call',
  ENVIRONMENT: 'Facility pressure',
};

function ResultCard({ character }: { character: DebriefCharacterResult }) {
  const fraction =
    character.maxHealth > 0 ? Math.min(Math.max(character.health / character.maxHealth, 0), 1) : 0;

  return (
    <li className={`result result--${character.id.toLowerCase()}`}>
      <span className="result__tag" aria-hidden="true">
        {character.tag}
      </span>
      <span className="result__name">{character.name}</span>
      <span className={`result__state ${character.survived ? 'result__state--alive' : ''}`}>
        {character.survived ? 'Survived' : 'Down'}
      </span>
      <span className="result__bar" aria-hidden="true">
        <span className="result__fill" style={{ width: `${fraction * 100}%` }} />
      </span>
      <span className="result__value">
        {Math.max(Math.round(character.health), 0)} / {character.maxHealth} health
      </span>
    </li>
  );
}

export function DebriefScreen({
  runLabel,
  runTimeLabel,
  characters,
  vehicle = null,
  checkpointsReached,
  criticalIncidents,
  failures,
  lessonsAdded,
  tacticsChanged,
  onReplay,
  onOpenMemory,
  onReturnToPairing,
}: DebriefScreenProps) {
  const vehicleFraction =
    vehicle && vehicle.maxIntegrity > 0
      ? Math.min(Math.max(vehicle.integrity / vehicle.maxIntegrity, 0), 1)
      : 0;

  return (
    <div className="debrief">
      <header className="debrief__head">
        <p className="debrief__eyebrow">{runLabel ? `Run ${runLabel}` : 'Run complete'}</p>
        <h1 className="debrief__title">HEIST COMPLETE</h1>
        <p className="debrief__lede">
          Owen and Cody cleared the pursuit together. Everything below came from recorded events in
          this attempt.
        </p>
      </header>

      <div className="debrief__body">
        <section className="dbsection dbsection--wide" aria-labelledby="debrief-crew">
          <h2 className="dbsection__title" id="debrief-crew">
            Final state
          </h2>

          <ul className="debrief__results">
            {characters.map((character) => (
              <ResultCard key={character.id} character={character} />
            ))}
          </ul>

          {vehicle ? (
            <div className="dbvehicle">
              <span className="dbvehicle__label">Getaway car</span>
              <span className="dbvehicle__bar" aria-hidden="true">
                <span className="dbvehicle__fill" style={{ width: `${vehicleFraction * 100}%` }} />
              </span>
              <span className="dbvehicle__value">
                {Math.max(Math.round(vehicle.integrity), 0)} / {vehicle.maxIntegrity} integrity
              </span>
            </div>
          ) : null}

          <dl className="dbstats">
            <div className="dbstats__row">
              <dt>Run time</dt>
              <dd>{runTimeLabel}</dd>
            </div>
            <div className="dbstats__row">
              <dt>Checkpoints reached</dt>
              <dd>{checkpointsReached.length}</dd>
            </div>
            <div className="dbstats__row">
              <dt>Checkpoint failures</dt>
              <dd>{failures.length}</dd>
            </div>
            <div className="dbstats__row">
              <dt>Critical incidents</dt>
              <dd>{criticalIncidents}</dd>
            </div>
          </dl>

          {checkpointsReached.length > 0 ? (
            <ul className="dbchain">
              {checkpointsReached.map((checkpoint) => (
                <li className="dbchain__node" key={checkpoint}>
                  {checkpoint}
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="dbsection" aria-labelledby="debrief-failures">
          <h2 className="dbsection__title" id="debrief-failures">
            What ended an attempt
          </h2>
          {failures.length === 0 ? (
            <p className="dbsection__empty">No checkpoint failures this run.</p>
          ) : (
            <ul className="dblist">
              {failures.map((failure) => (
                <li className="dbitem" key={failure.id}>
                  <p className="dbitem__title">{failure.label}</p>
                  <p className="dbitem__body">{failure.cause}</p>
                  <p className="dbitem__meta">
                    {failure.section ? <span>{failure.section}</span> : null}
                    {failure.attribution ? (
                      <span className={`dbtag dbtag--${failure.attribution.toLowerCase()}`}>
                        {ACTOR_LABELS[failure.attribution]}
                      </span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dbsection" aria-labelledby="debrief-lessons">
          <h2 className="dbsection__title" id="debrief-lessons">
            Lessons recorded
          </h2>
          {lessonsAdded.length === 0 ? (
            <p className="dbsection__empty">
              Nothing consequential enough to record. The partner kept its existing memory.
            </p>
          ) : (
            <ul className="dblist">
              {lessonsAdded.map((lesson) => (
                <li className="dbitem" key={lesson.id}>
                  <p className="dbitem__title">{lesson.lesson}</p>
                  <p className="dbitem__body">{lesson.evidence}</p>
                  <p className="dbitem__meta">
                    <span className="dbtag">{lesson.affectedTactic}</span>
                    {lesson.section ? <span>{lesson.section}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dbsection" aria-labelledby="debrief-adapted">
          <h2 className="dbsection__title" id="debrief-adapted">
            Tactics changed by memory
          </h2>
          {tacticsChanged.length === 0 ? (
            <p className="dbsection__empty">
              No earlier lesson applied this run. Fail the same way twice and it will.
            </p>
          ) : (
            <ul className="dblist">
              {tacticsChanged.map((change) => (
                <li className="dbitem" key={change.id}>
                  <p className="dbitem__title">{change.tactic}</p>
                  <p className="dbitem__body">
                    <span className="dbitem__prefix">Remembered</span>
                    {change.lesson}
                  </p>
                  {change.outcome ? <p className="dbitem__body">{change.outcome}</p> : null}
                  {change.section ? <p className="dbitem__meta">{change.section}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="debrief__foot">
        <button type="button" className="ui-btn ui-btn--primary" onClick={onReplay}>
          Replay heist
        </button>
        {onOpenMemory ? (
          <button type="button" className="ui-btn ui-btn--ghost" onClick={onOpenMemory}>
            Partner memory
          </button>
        ) : null}
        {onReturnToPairing ? (
          <button type="button" className="ui-btn ui-btn--quiet" onClick={onReturnToPairing}>
            Return to pairing
          </button>
        ) : null}
        <p className="debrief__note">Replaying keeps every recorded lesson.</p>
      </footer>
    </div>
  );
}
