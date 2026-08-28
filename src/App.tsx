import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './styles/tokens.css';
import './styles/global.css';
import './styles/motion.css';
import './styles/pairing.css';
import './styles/game-canvas.css';
import './styles/mission-ui.css';
import './styles/mission-overlays.css';
import './styles/mission-debrief.css';
import './styles/mission-effects.css';

import { GameCanvas } from './app/GameCanvas';
import type { AppServices } from './app/createAppServices';
import { useMissionSnapshot } from './app/useMissionSnapshot';
import { CompatibilityNotice, type CompatibilityReason } from './components/CompatibilityNotice';
import { ControlsOverlay } from './components/ControlsOverlay';
import { DebriefScreen } from './components/DebriefScreen';
import { FailureScreen, type FailureCode } from './components/FailureScreen';
import { Hud, type HudBombStatus, type HudRadioLine } from './components/Hud';
import { MemoryDialog } from './components/MemoryDialog';
import { PairingScreen } from './components/PairingScreen';
import { PauseMenu } from './components/PauseMenu';
import { TitleSequence, type TitleStage } from './components/TitleSequence';
import type { GameRuntimeStatus } from './game/BabylonGameRuntime';
import type { CheckpointId, MissionFailure, MissionSection } from './game/MissionStore';
import type { PartnerEvent } from './partner/PartnerCoordinator';

export interface AppProps {
  services: AppServices;
  /** Tests and embedded previews can bypass device detection without changing production behavior. */
  compatibility?: 'AUTO' | 'SUPPORTED';
}

type Overlay = 'NONE' | 'CONTROLS' | 'MEMORY' | 'PAUSE';

const SECTION_LABELS: Record<MissionSection, string> = {
  FACILITY_ONE: 'Facility · Room one',
  FACILITY_TWO: 'Facility · Room two',
  BOMB_GATE: 'Facility · Blast gate',
  CHASE: 'Getaway · Pursuit',
};

const CHECKPOINT_LABELS: Record<CheckpointId, string> = {
  FACILITY_START: 'Facility start',
  ROOM_ONE_CLEAR: 'Room one clear',
  CHASE_START: 'Chase start',
};

const initialRuntimeStatus: GameRuntimeStatus = {
  enemiesRemaining: 0,
  chaseProgress: 0,
  prompt: null,
  pointerLocked: false,
};

function detectCompatibility(): { reason: CompatibilityReason; detail: string } | null {
  if (window.innerWidth < 960 || window.innerHeight < 600) {
    return {
      reason: 'SMALL_SCREEN',
      detail: `Window ${window.innerWidth} by ${window.innerHeight}; use at least 1280 by 720.`,
    };
  }
  if (typeof window.matchMedia === 'function') {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const fine = window.matchMedia('(any-pointer: fine)').matches;
    if (coarse && !fine) return { reason: 'TOUCH_ONLY', detail: 'No fine pointer detected.' };
  }
  return null;
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function failureCopy(failure: MissionFailure): {
  code: FailureCode;
  cause: string;
  attribution: 'HUMAN' | 'AGENT' | 'ENVIRONMENT';
} {
  if (failure.code === 'PLAYER_DOWN') {
    return {
      code: failure.code,
      cause: `${failure.character === 'OWEN' ? 'Owen' : 'Cody'} was eliminated before the pair could escape.`,
      attribution: 'HUMAN',
    };
  }
  if (failure.code === 'PARTNER_DOWN') {
    return {
      code: failure.code,
      cause: `${failure.character === 'OWEN' ? 'Owen' : 'Cody'} was eliminated while controlled by the partner.`,
      attribution: 'AGENT',
    };
  }
  if (failure.code === 'VEHICLE_DESTROYED') {
    return {
      code: failure.code,
      cause:
        failure.cause === 'COLLISION'
          ? 'A bad route choice wrecked the getaway car.'
          : 'Pursuer fire destroyed the getaway car.',
      attribution: failure.cause === 'COLLISION' ? 'HUMAN' : 'ENVIRONMENT',
    };
  }
  return {
    code: failure.code,
    cause:
      failure.cause === 'AGENT_DECISION_TIMEOUT'
        ? 'The partner did not answer a required decision before its deadline.'
        : `Three consequential mistakes compromised the checkpoint: ${failure.cause.replaceAll('_', ' ').toLowerCase()}.`,
    attribution: failure.cause === 'AGENT_DECISION_TIMEOUT' ? 'AGENT' : 'ENVIRONMENT',
  };
}

function toRadioLine(event: PartnerEvent): HudRadioLine | null {
  if (!['AGENT_RADIO', 'AGENT_TACTIC', 'AGENT_DECISION', 'AGENT_TARGET_PRIORITY', 'MEMORY_UPDATED', 'PARTNER_CLEAR_OF_CHARGE'].includes(event.type)) {
    return null;
  }
  const text = event.summary.includes(': ') ? event.summary.split(': ').slice(1).join(': ') : event.summary;
  return {
    id: `partner-${event.sequence}`,
    speaker: event.type === 'MEMORY_UPDATED' ? 'Memory' : 'Cody',
    text,
    priority:
      event.type === 'PARTNER_CLEAR_OF_CHARGE' || /warn|clear|decision/i.test(event.summary)
        ? 'CRITICAL'
        : 'CHATTER',
  };
}

export function App({ services, compatibility = 'AUTO' }: AppProps) {
  const snapshot = useMissionSnapshot(services.store);
  const [compatibilityIssue, setCompatibilityIssue] = useState(() =>
    compatibility === 'SUPPORTED' ? null : detectCompatibility(),
  );
  const [titleStage, setTitleStage] = useState<TitleStage>('PRESENTS');
  const [titleSeen, setTitleSeen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>('NONE');
  const [overlayReturn, setOverlayReturn] = useState<Overlay>('NONE');
  const [runtimeStatus, setRuntimeStatus] = useState(initialRuntimeStatus);
  const [partnerEvents, setPartnerEvents] = useState(() => services.coordinator.getEvents());
  const [activeCallout, setActiveCallout] = useState<string | null>(null);
  const [, setMemoryRevision] = useState(0);
  const [, forceClockRender] = useState(0);
  const runStartedAt = useRef(Date.now());
  const seenRun = useRef<string | null>(null);
  const previousRun = useRef<string | null>(null);

  useEffect(() => {
    if (compatibility === 'SUPPORTED') return;
    const update = () => setCompatibilityIssue(detectCompatibility());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [compatibility]);

  useEffect(
    () => services.coordinator.onEvent((event) => setPartnerEvents((current) => [...current.slice(-11), event])),
    [services],
  );

  useEffect(() => {
    const timer = window.setInterval(
      () => {
        services.store.tick();
        forceClockRender((revision) => (revision + 1) % 10_000);
      },
      100,
    );
    return () => window.clearInterval(timer);
  }, [services]);

  useEffect(() => {
    if (snapshot.runId && snapshot.runId !== previousRun.current) {
      previousRun.current = snapshot.runId;
      runStartedAt.current = Date.now();
    }
  }, [snapshot.runId]);

  useEffect(() => {
    if (snapshot.phase !== 'TITLE') return;
    setTitleStage('PRESENTS');
    const lockup = window.setTimeout(() => setTitleStage('LOCKUP'), 900);
    const fade = window.setTimeout(() => setTitleStage('FADE_OUT'), 2_650);
    const enter = window.setTimeout(() => {
      setTitleSeen(true);
      services.store.enterFacility();
    }, 3_350);
    return () => {
      window.clearTimeout(lockup);
      window.clearTimeout(fade);
      window.clearTimeout(enter);
    };
  }, [services, snapshot.phase]);

  useEffect(() => {
    if (
      snapshot.phase === 'MISSION' &&
      snapshot.section === 'FACILITY_ONE' &&
      snapshot.runId &&
      seenRun.current !== snapshot.runId
    ) {
      seenRun.current = snapshot.runId;
      services.store.pause();
      setOverlayReturn('NONE');
      setOverlay('CONTROLS');
    }
  }, [services, snapshot.phase, snapshot.runId, snapshot.section]);

  useEffect(() => {
    if (snapshot.phase !== 'FAILURE') return;
    const restore = window.setTimeout(() => services.store.restoreCheckpoint(), 2_000);
    return () => window.clearTimeout(restore);
  }, [services, snapshot.phase]);

  const handleRuntimeStatus = useCallback((status: GameRuntimeStatus) => setRuntimeStatus(status), []);
  const memoryDocument = services.memory.getDocument();
  const savedCheckpoint = services.checkpoints.load();
  const elapsed = services.store.getMissionElapsedMs();

  const radioLines = useMemo(
    () => partnerEvents.map(toRadioLine).filter((line): line is HudRadioLine => line !== null),
    [partnerEvents],
  );

  function startHeist() {
    setTitleStage('PRESENTS');
    services.store.startMission();
  }

  function finishTitle() {
    setTitleSeen(true);
    services.store.enterFacility();
  }

  function pauseMission() {
    if (snapshot.phase !== 'MISSION') return;
    if (document.pointerLockElement) void document.exitPointerLock();
    services.store.pause();
    setOverlay('PAUSE');
  }

  function resumeMission() {
    setOverlay('NONE');
    services.store.resume();
  }

  function openMemory(returnTo: Overlay) {
    if (snapshot.phase === 'MISSION' && !snapshot.paused) services.store.pause();
    setOverlayReturn(returnTo);
    setOverlay('MEMORY');
  }

  function openControls(returnTo: Overlay) {
    if (snapshot.phase === 'MISSION' && !snapshot.paused) services.store.pause();
    setOverlayReturn(returnTo);
    setOverlay('CONTROLS');
  }

  function closeSecondaryOverlay() {
    if (overlayReturn === 'PAUSE') {
      setOverlay('PAUSE');
      return;
    }
    setOverlay('NONE');
    if (services.store.getSnapshot().phase === 'MISSION') services.store.resume();
  }

  function restartCheckpoint() {
    setOverlay('NONE');
    services.store.restoreCheckpoint();
  }

  function returnToPairing() {
    setOverlay('NONE');
    services.store.returnToPairing();
  }

  function exportMemory() {
    const url = URL.createObjectURL(
      new Blob([services.memory.toMarkdown()], { type: 'text/markdown;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'hs-heist-partner-memory.md';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function sendCallout(calloutId: string) {
    const label = calloutId.replaceAll('_', ' ');
    setActiveCallout(label);
    services.coordinator.publish({ type: 'HUMAN_CALLOUT', summary: label });
    window.setTimeout(() => setActiveCallout(null), 2_400);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.code === 'Escape' && snapshot.phase === 'MISSION' && overlay === 'NONE') {
        event.preventDefault();
        pauseMission();
      }
      if (event.code === 'KeyM' && snapshot.phase === 'MISSION' && overlay === 'NONE') {
        event.preventDefault();
        openMemory('NONE');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (compatibilityIssue) {
    return <CompatibilityNotice {...compatibilityIssue} />;
  }

  const atmosphere = snapshot.phase === 'PAIRING' || snapshot.phase === 'TITLE';
  const missionVisible = snapshot.phase === 'MISSION' || snapshot.phase === 'FAILURE';
  const sectionLabel = snapshot.section ? SECTION_LABELS[snapshot.section] : undefined;
  const checkpointLabel = snapshot.checkpoint ? CHECKPOINT_LABELS[snapshot.checkpoint] : undefined;
  const humanAmmo = snapshot.characters[snapshot.humanCharacter].ammo;
  const switching = snapshot.switching;
  const nowForDomain = Date.now();
  const switchNotice =
    switching.state === 'TRANSITION'
      ? `Switching to ${switching.to === 'OWEN' ? 'Owen' : 'Cody'}`
      : switching.state === 'COOLDOWN'
        ? `Switch ready in ${Math.max(0, (switching.cooldownEndsAt - nowForDomain) / 1_000).toFixed(1)}s`
        : switching.state === 'LOCKED'
          ? `Perspective locked · ${switching.reason.replaceAll('_', ' ').toLowerCase()}`
          : null;
  const lockTimer =
    switching.state === 'LOCKED'
      ? {
          label: `Locked to ${switching.character === 'OWEN' ? 'Owen' : 'Cody'}`,
          secondsRemaining: Math.max(0, (switching.endsAt - nowForDomain) / 1_000),
          totalSeconds: 20,
        }
      : null;
  const decisionTimer = snapshot.requiredDecision
    ? {
        label: 'Partner deciding',
        secondsRemaining: Math.max(0, (snapshot.requiredDecision.deadlineAt - nowForDomain) / 1_000),
        totalSeconds: Math.max(1, (snapshot.requiredDecision.deadlineAt - snapshot.requiredDecision.openedAt) / 1_000),
      }
    : null;
  const bombStatus: HudBombStatus | null =
    snapshot.section === 'BOMB_GATE'
      ? snapshot.bomb.state === 'IDLE'
        ? 'UNPLACED'
        : snapshot.bomb.state
      : null;

  const lastHistory = snapshot.history.at(-1);
  const prompt = runtimeStatus.prompt
    ? {
        title: runtimeStatus.prompt.includes('—') ? runtimeStatus.prompt.split('—')[0] : runtimeStatus.prompt,
        body: runtimeStatus.prompt.includes('—')
          ? runtimeStatus.prompt.split('—').slice(1).join('—')
          : runtimeStatus.pointerLocked
            ? 'Keep moving. Your partner is reacting to the same mission state.'
            : 'Click the scene to lock the mouse and take control.',
      }
    : null;

  return (
    <div className={`app-shell ${missionVisible ? 'app-shell--mission' : ''}`}>
      {atmosphere ? (
        <>
          <div className="fx fx--bays" aria-hidden="true" />
          <div className="fx fx--rig" aria-hidden="true" />
          <div className="fx fx--lightpool" aria-hidden="true" />
        </>
      ) : null}

      {snapshot.phase === 'PAIRING' ? (
        <PairingScreen
          partnerOnline={snapshot.partner.online}
          partnerName={snapshot.partner.name}
          sessionId={snapshot.partner.sessionId}
          canContinue={Boolean(savedCheckpoint)}
          onStartHeist={startHeist}
          onContinueFromCheckpoint={() => {
            if (savedCheckpoint) services.store.continueFromCheckpoint(savedCheckpoint.checkpoint, savedCheckpoint.runId);
          }}
          onOpenMemory={() => openMemory('NONE')}
        />
      ) : null}

      {snapshot.phase === 'TITLE' ? (
        <TitleSequence stage={titleStage} canSkip={titleSeen} onSkip={finishTitle} />
      ) : null}

      {missionVisible ? (
        <>
          <GameCanvas services={services} onStatus={handleRuntimeStatus} />
          <Hud
            characters={[
              {
                id: 'OWEN',
                name: 'Owen “Aye” Mercer',
                tag: 'AYE',
                health: snapshot.characters.OWEN.health,
                maxHealth: 100,
                controlledBy: snapshot.humanCharacter === 'OWEN' ? 'HUMAN' : 'AGENT',
                role: snapshot.section === 'CHASE' ? 'Driver' : 'Cover · Detonator',
              },
              {
                id: 'CODY',
                name: 'Cody “X” Vance',
                tag: 'X',
                health: snapshot.characters.CODY.health,
                maxHealth: 100,
                controlledBy: snapshot.humanCharacter === 'CODY' ? 'HUMAN' : 'AGENT',
                role: snapshot.section === 'CHASE' ? 'Rear gunner' : 'Planter · Point',
              },
            ]}
            objective={snapshot.objective}
            sectionLabel={sectionLabel}
            bombStatus={bombStatus}
            criticalIncidents={{ count: snapshot.criticalIncidents, limit: 3 }}
            criticalAlert={lastHistory?.type === 'CRITICAL_INCIDENT' ? lastHistory.summary : null}
            lockTimer={lockTimer}
            decisionTimer={decisionTimer}
            switchNotice={switchNotice}
            ammo={{ ...humanAmmo, capacity: 18 }}
            vehicle={snapshot.vehicle ? { integrity: snapshot.vehicle.integrity, maxIntegrity: 100 } : null}
            prompt={prompt}
            radioLines={radioLines}
            activeCallout={activeCallout ? { label: activeCallout, acknowledged: false } : null}
            onCallout={sendCallout}
            memoryNotice={partnerEvents.at(-1)?.type === 'MEMORY_UPDATED' ? partnerEvents.at(-1)?.summary : null}
            showReticle={snapshot.section !== 'CHASE' || snapshot.humanCharacter === 'CODY'}
          />
        </>
      ) : null}

      {missionVisible && switching.state === 'TRANSITION' ? (
        <div className="switchcut" role="status" aria-label="Perspective switching">
          <span className="switchcut__eyebrow">Perspective link</span>
          <span className="switchcut__route" aria-hidden="true">
            <strong>{switching.from}</strong>
            <i />
            <strong>{switching.to}</strong>
          </span>
          <span className="switchcut__destination">
            Taking control of {switching.to === 'OWEN' ? 'Owen “Aye” Mercer' : 'Cody “X” Vance'}
          </span>
          <span className="u-visually-hidden">
            Switching from {switching.from} to {switching.to}.
          </span>
        </div>
      ) : null}

      {snapshot.phase === 'FAILURE' && snapshot.failure ? (
        <FailureScreen
          {...failureCopy(snapshot.failure)}
          checkpointLabel={checkpointLabel}
          restoreDurationMs={2_000}
        />
      ) : null}

      {snapshot.phase === 'COMPLETE' ? (
        <DebriefScreen
          runLabel={snapshot.runId ?? undefined}
          runTimeLabel={formatDuration(elapsed)}
          characters={[
            { id: 'OWEN', name: 'Owen “Aye” Mercer', tag: 'AYE', survived: snapshot.characters.OWEN.health > 0, health: snapshot.characters.OWEN.health, maxHealth: 100 },
            { id: 'CODY', name: 'Cody “X” Vance', tag: 'X', survived: snapshot.characters.CODY.health > 0, health: snapshot.characters.CODY.health, maxHealth: 100 },
          ]}
          vehicle={snapshot.vehicle ? { integrity: snapshot.vehicle.integrity, maxIntegrity: 100 } : null}
          checkpointsReached={[
            'Facility start',
            ...(snapshot.history.some((event) => event.summary.includes('Room one cleared')) ? ['Room one clear'] : []),
            ...(snapshot.history.some((event) => event.summary.includes('getaway car')) ? ['Chase start'] : []),
          ]}
          criticalIncidents={snapshot.history.filter((event) => event.type === 'CRITICAL_INCIDENT').length}
          failures={snapshot.history
            .filter(
              (event) =>
                ['CHARACTER_DOWN', 'VEHICLE_DESTROYED', 'AGENT_DECISION_TIMEOUT'].includes(event.type) ||
                (event.type === 'CRITICAL_INCIDENT' && event.summary.includes('to 3.')),
            )
            .map((event) => ({ id: event.id, label: 'Attempt ended', cause: event.summary, attribution: event.type === 'AGENT_DECISION_TIMEOUT' ? 'AGENT' : 'ENVIRONMENT' }))}
          lessonsAdded={memoryDocument.lessons
            .filter((lesson) => lesson.runId === snapshot.runId)
            .map((lesson) => ({ id: lesson.id, lesson: lesson.lesson, evidence: lesson.evidence, affectedTactic: lesson.affectedTactic, section: lesson.section }))}
          tacticsChanged={memoryDocument.lessons
            .filter((lesson) => lesson.uses.some((use) => use.usedAt >= runStartedAt.current))
            .map((lesson) => ({ id: lesson.id, tactic: lesson.affectedTactic, lesson: lesson.lesson, outcome: `${lesson.uses.length} recorded later use${lesson.uses.length === 1 ? '' : 's'}.`, section: lesson.section }))}
          onReplay={() => services.store.replay()}
          onOpenMemory={() => openMemory('NONE')}
          onReturnToPairing={returnToPairing}
        />
      ) : null}

      {overlay === 'PAUSE' ? (
        <PauseMenu
          sectionLabel={sectionLabel}
          objective={snapshot.objective}
          elapsedLabel={formatDuration(elapsed)}
          checkpointLabel={checkpointLabel}
          onResume={resumeMission}
          onOpenControls={() => openControls('PAUSE')}
          onOpenMemory={() => openMemory('PAUSE')}
          onRestartCheckpoint={restartCheckpoint}
          onReturnToPairing={returnToPairing}
        />
      ) : null}

      {overlay === 'CONTROLS' ? (
        <ControlsOverlay
          variant={overlayReturn === 'NONE' && snapshot.section === 'FACILITY_ONE' ? 'FIRST_RUN' : 'REFERENCE'}
          onDismiss={closeSecondaryOverlay}
        />
      ) : null}

      {overlay === 'MEMORY' ? (
        <MemoryDialog
          markdown={services.memory.toMarkdown()}
          lessonCount={memoryDocument.lessons.length}
          canReset={snapshot.phase === 'PAIRING'}
          onExport={exportMemory}
          onReset={() => {
            services.memory.reset();
            setMemoryRevision((revision) => revision + 1);
          }}
          onClose={closeSecondaryOverlay}
        />
      ) : null}

      <div className="fx fx--grain" aria-hidden="true" />
      {atmosphere ? <div className="fx fx--scan" aria-hidden="true" /> : null}
      <div className="fx fx--vignette" aria-hidden="true" />
    </div>
  );
}
