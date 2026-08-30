export type MissionPhase = 'PAIRING' | 'TITLE' | 'MISSION' | 'FAILURE' | 'COMPLETE';
export type CharacterId = 'OWEN' | 'CODY';
export type MissionSection = 'FACILITY_ONE' | 'FACILITY_TWO' | 'BOMB_GATE' | 'CHASE';
export type CheckpointId = 'FACILITY_START' | 'ROOM_ONE_CLEAR' | 'CHASE_START';
export type PartnerTactic = 'ADVANCE' | 'COVER' | 'FLANK' | 'RETREAT' | 'PROTECT' | 'HOLD';

export interface CharacterState {
  health: number;
  ammo: { magazine: number; reserve: number };
}

export interface MissionHistoryEvent {
  id: string;
  type: string;
  summary: string;
  timestamp: number;
  consequential: boolean;
}

export type MissionFailure =
  | {
      code: 'PLAYER_DOWN' | 'PARTNER_DOWN';
      character: CharacterId;
      cause: 'ENEMY_FIRE' | 'EXPLOSION';
    }
  | { code: 'MISSION_COMPROMISED'; cause: string }
  | { code: 'VEHICLE_DESTROYED'; cause: 'PURSUER_FIRE' | 'COLLISION' }
  | { code: 'PARTNER_DISCONNECTED'; cause: 'AGENT_DISCONNECTED' };

export type SwitchingState =
  | { state: 'READY' }
  | { state: 'TRANSITION'; from: CharacterId; to: CharacterId; endsAt: number }
  | { state: 'COOLDOWN'; cooldownEndsAt: number }
  | { state: 'LOCKED'; character: CharacterId; reason: string; endsAt: number };

export interface MissionSnapshot {
  phase: MissionPhase;
  runId: string | null;
  partner: { online: boolean; name: string | null; sessionId: string | null };
  section: MissionSection | null;
  checkpoint: CheckpointId | null;
  objective: string;
  humanCharacter: CharacterId;
  partnerTactic: PartnerTactic;
  characters: Record<CharacterId, CharacterState>;
  criticalIncidents: number;
  failure: MissionFailure | null;
  paused: boolean;
  requiredDecision: {
    id: string;
    kind: string;
    actions: readonly string[];
    openedAt: number;
    deadlineAt: number;
  } | null;
  switching: SwitchingState;
  vehicle: { integrity: number } | null;
  bomb: {
    state: 'IDLE' | 'PLANTING' | 'ARMED' | 'DETONATED';
    safeDetonation: boolean | null;
  };
  history: MissionHistoryEvent[];
}

export interface MissionStoreOptions {
  now: () => number;
  createId: () => string;
}

type CommandResult = { ok: true } | { ok: false; reason: string };

interface JoinResult {
  ok: true;
  sessionId: string;
  alreadyJoined: boolean;
}

const BASELINES: Record<CheckpointId, Pick<MissionSnapshot, 'section' | 'objective' | 'characters' | 'vehicle'>> = {
  FACILITY_START: {
    section: 'FACILITY_ONE',
    objective: 'ESCAPE THE LOCKDOWN',
    characters: {
      OWEN: { health: 100, ammo: { magazine: 18, reserve: 72 } },
      CODY: { health: 100, ammo: { magazine: 18, reserve: 72 } },
    },
    vehicle: null,
  },
  ROOM_ONE_CLEAR: {
    section: 'FACILITY_TWO',
    objective: 'REACH THE BLAST GATE',
    characters: {
      OWEN: { health: 88, ammo: { magazine: 18, reserve: 54 } },
      CODY: { health: 88, ammo: { magazine: 18, reserve: 54 } },
    },
    vehicle: null,
  },
  CHASE_START: {
    section: 'CHASE',
    objective: 'ESCAPE THE PURSUIT',
    characters: {
      OWEN: { health: 85, ammo: { magazine: 18, reserve: 54 } },
      CODY: { health: 85, ammo: { magazine: 18, reserve: 54 } },
    },
    vehicle: { integrity: 100 },
  },
};

function cloneCharacters(
  characters: Record<CharacterId, CharacterState>,
): Record<CharacterId, CharacterState> {
  return {
    OWEN: { ...characters.OWEN, ammo: { ...characters.OWEN.ammo } },
    CODY: { ...characters.CODY, ammo: { ...characters.CODY.ammo } },
  };
}

export class MissionStore {
  private historySequence = 0;
  private pausedAt: number | null = null;
  private runStartedAt: number | null = null;
  private runEndedAt: number | null = null;
  private pausedDurationMs = 0;
  private resetHistoryOnFacilityEntry = false;
  private readonly listeners = new Set<() => void>();
  private snapshot: MissionSnapshot = {
    phase: 'PAIRING',
    runId: null,
    partner: { online: false, name: null, sessionId: null },
    section: null,
    checkpoint: null,
    objective: 'PAIR WITH YOUR PARTNER',
    humanCharacter: 'OWEN',
    partnerTactic: 'HOLD',
    characters: cloneCharacters(BASELINES.FACILITY_START.characters),
    criticalIncidents: 0,
    failure: null,
    paused: false,
    requiredDecision: null,
    switching: { state: 'READY' },
    vehicle: null,
    bomb: { state: 'IDLE', safeDetonation: null },
    history: [],
  };

  constructor(private readonly options: MissionStoreOptions) {}

  getSnapshot(): MissionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getMissionElapsedMs(): number {
    if (this.runStartedAt === null) return 0;
    const effectiveNow = this.pausedAt ?? this.runEndedAt ?? this.options.now();
    return Math.max(0, effectiveNow - this.runStartedAt - this.pausedDurationMs);
  }

  joinPartner(name: string): JoinResult {
    if (this.snapshot.partner.sessionId) {
      return { ok: true, sessionId: this.snapshot.partner.sessionId, alreadyJoined: true };
    }

    const sessionId = this.options.createId();
    this.commit(
      { ...this.snapshot, partner: { online: true, name: name.trim() || 'Codex', sessionId } },
      'PARTNER_JOINED',
      `${name.trim() || 'Codex'} joined the page session.`,
    );
    return { ok: true, sessionId, alreadyJoined: false };
  }

  disconnectPartner(sessionId: string): CommandResult {
    if (!sessionId || this.snapshot.partner.sessionId !== sessionId) {
      return { ok: false, reason: 'INVALID_SESSION' };
    }

    const partner = { online: false, name: null, sessionId: null };
    const partnerName = this.snapshot.partner.name ?? 'The agent partner';
    if (this.snapshot.phase === 'MISSION') {
      this.commit(
        {
          ...this.snapshot,
          partner,
          phase: 'FAILURE',
          objective: 'PARTNER CONNECTION LOST',
          failure: { code: 'PARTNER_DISCONNECTED', cause: 'AGENT_DISCONNECTED' },
          requiredDecision: null,
          switching: { state: 'READY' },
        },
        'PARTNER_DISCONNECTED',
        `${partnerName} disconnected during the active attempt.`,
        true,
      );
      return { ok: true };
    }

    if (this.snapshot.phase === 'TITLE') {
      this.runStartedAt = null;
      this.runEndedAt = null;
      this.pausedAt = null;
      this.pausedDurationMs = 0;
      this.commit(
        {
          ...this.snapshot,
          partner,
          phase: 'PAIRING',
          runId: null,
          section: null,
          checkpoint: null,
          objective: 'PAIR WITH YOUR PARTNER',
          failure: null,
          paused: false,
          requiredDecision: null,
          switching: { state: 'READY' },
          vehicle: null,
          bomb: { state: 'IDLE', safeDetonation: null },
        },
        'PARTNER_DISCONNECTED',
        `${partnerName} disconnected before the attempt began.`,
      );
      return { ok: true };
    }

    this.commit(
      {
        ...this.snapshot,
        partner,
        objective:
          this.snapshot.phase === 'PAIRING' ? 'PAIR WITH YOUR PARTNER' : this.snapshot.objective,
      },
      'PARTNER_DISCONNECTED',
      `${partnerName} disconnected from the page session.`,
    );
    return { ok: true };
  }

  startMission(): CommandResult {
    if (!this.snapshot.partner.online) return { ok: false, reason: 'PARTNER_REQUIRED' };
    if (this.snapshot.phase !== 'PAIRING' && this.snapshot.phase !== 'TITLE') {
      return { ok: false, reason: 'MISSION_ALREADY_ACTIVE' };
    }
    const history = this.resetHistoryOnFacilityEntry ? [] : this.snapshot.history;
    this.resetHistoryOnFacilityEntry = false;
    this.commit(
      { ...this.snapshot, history, phase: 'TITLE' },
      'MISSION_STARTED',
      'The human started the title sequence.',
    );
    return { ok: true };
  }

  enterFacility(): CommandResult {
    const baseline = BASELINES.FACILITY_START;
    this.runStartedAt = this.options.now();
    this.runEndedAt = null;
    this.pausedAt = null;
    this.pausedDurationMs = 0;
    this.commit(
      {
        ...this.snapshot,
        phase: 'MISSION',
        runId: this.snapshot.runId ?? this.options.createId(),
        section: baseline.section,
        checkpoint: 'FACILITY_START',
        objective: baseline.objective,
        humanCharacter: 'OWEN',
        partnerTactic: 'HOLD',
        characters: cloneCharacters(baseline.characters),
        criticalIncidents: 0,
        failure: null,
        paused: false,
        requiredDecision: null,
        switching: { state: 'READY' },
        vehicle: null,
        bomb: { state: 'IDLE', safeDetonation: null },
      },
      'FACILITY_ENTERED',
      'Owen and Cody entered the first facility room behind cover.',
    );
    return { ok: true };
  }

  damageCharacter(
    character: CharacterId,
    amount: number,
    cause: 'ENEMY_FIRE' | 'EXPLOSION',
    source?: { sourceId: string; shotId: string },
  ): { ok: true; applied: number; protected?: true } {
    if (this.snapshot.switching.state === 'TRANSITION') {
      return { ok: true, applied: 0, protected: true };
    }
    const current = this.snapshot.characters[character];
    const applied = Math.min(Math.max(amount, 0), current.health);
    const health = current.health - applied;
    let next: MissionSnapshot = {
      ...this.snapshot,
      characters: {
        ...this.snapshot.characters,
        [character]: { ...current, health },
      },
    };

    if (health === 0) {
      next = {
        ...next,
        phase: 'FAILURE',
        failure: {
          code: character === this.snapshot.humanCharacter ? 'PLAYER_DOWN' : 'PARTNER_DOWN',
          character,
          cause,
        },
      };
    }
    this.commit(
      next,
      health === 0 ? 'CHARACTER_DOWN' : 'CHARACTER_DAMAGED',
      `${character} took ${applied} damage from ${cause}${source ? ` (${source.sourceId} / ${source.shotId})` : ''}.`,
      health === 0,
    );
    return { ok: true, applied };
  }

  fireWeapon(
    character: CharacterId,
  ): { ok: true; remaining: number } | { ok: false; reason: 'EMPTY_MAGAZINE' } {
    const current = this.snapshot.characters[character];
    if (current.ammo.magazine <= 0) return { ok: false, reason: 'EMPTY_MAGAZINE' };
    const remaining = current.ammo.magazine - 1;
    this.commit(
      {
        ...this.snapshot,
        characters: {
          ...this.snapshot.characters,
          [character]: { ...current, ammo: { ...current.ammo, magazine: remaining } },
        },
      },
      'WEAPON_FIRED',
      `${character} fired one round.`,
    );
    return { ok: true, remaining };
  }

  reloadWeapon(
    character: CharacterId,
  ):
    | { ok: true; magazine: number; reserve: number }
    | { ok: false; reason: 'NO_RESERVE_AMMO' | 'MAGAZINE_FULL' } {
    const current = this.snapshot.characters[character];
    if (current.ammo.magazine >= 18) return { ok: false, reason: 'MAGAZINE_FULL' };
    if (current.ammo.reserve <= 0) return { ok: false, reason: 'NO_RESERVE_AMMO' };
    const transfer = Math.min(18 - current.ammo.magazine, current.ammo.reserve);
    const ammo = {
      magazine: current.ammo.magazine + transfer,
      reserve: current.ammo.reserve - transfer,
    };
    this.commit(
      {
        ...this.snapshot,
        characters: {
          ...this.snapshot.characters,
          [character]: { ...current, ammo },
        },
      },
      'WEAPON_RELOADED',
      `${character} reloaded ${transfer} rounds.`,
    );
    return { ok: true, ...ammo };
  }

  recordCriticalIncident(cause: string): { ok: true; count: number } {
    const count = this.snapshot.criticalIncidents + 1;
    const failed = count >= 3;
    this.commit(
      {
        ...this.snapshot,
        criticalIncidents: count,
        ...(failed
          ? {
              phase: 'FAILURE' as const,
              failure: { code: 'MISSION_COMPROMISED' as const, cause },
            }
          : {}),
      },
      'CRITICAL_INCIDENT',
      `${cause} raised the section incident count to ${count}.`,
      true,
    );
    return { ok: true, count };
  }

  activateRoomOneCheckpoint(): CommandResult {
    const baseline = BASELINES.ROOM_ONE_CLEAR;
    this.commit(
      {
        ...this.snapshot,
        phase: 'MISSION',
        section: baseline.section,
        checkpoint: 'ROOM_ONE_CLEAR',
        objective: baseline.objective,
        characters: cloneCharacters(baseline.characters),
        vehicle: null,
        criticalIncidents: 0,
        failure: null,
        requiredDecision: null,
        switching: { state: 'READY' },
      },
      'CHECKPOINT_REACHED',
      'Room one cleared. Checkpoint baseline saved.',
    );
    return { ok: true };
  }

  enterBombGate(): CommandResult {
    if (this.snapshot.checkpoint !== 'ROOM_ONE_CLEAR') {
      return { ok: false, reason: 'ROOM_ONE_NOT_CLEAR' };
    }
    this.commit(
      {
        ...this.snapshot,
        section: 'BOMB_GATE',
        objective: 'PLANT THE CHARGE',
        bomb: { state: 'IDLE', safeDetonation: null },
      },
      'BOMB_GATE_ENTERED',
      'The pair reached the locked blast gate.',
    );
    return { ok: true };
  }

  startChargePlant(): CommandResult {
    if (this.snapshot.section !== 'BOMB_GATE') return { ok: false, reason: 'BOMB_GATE_NOT_ACTIVE' };
    if (this.snapshot.bomb.state !== 'IDLE') return { ok: false, reason: 'CHARGE_ALREADY_STARTED' };
    this.commit(
      {
        ...this.snapshot,
        objective: 'COVER CODY WHILE HE PLANTS',
        bomb: { state: 'PLANTING', safeDetonation: null },
      },
      'CHARGE_PLANT_STARTED',
      'Cody started planting the gate charge.',
    );
    return { ok: true };
  }

  armCharge(): CommandResult {
    if (this.snapshot.bomb.state !== 'PLANTING') return { ok: false, reason: 'CHARGE_NOT_PLANTING' };
    this.commit(
      {
        ...this.snapshot,
        objective: 'GET CODY CLEAR — DETONATE THE CHARGE',
        bomb: { state: 'ARMED', safeDetonation: null },
      },
      'CHARGE_ARMED',
      'The gate charge is armed.',
    );
    return { ok: true };
  }

  detonateCharge(safe: boolean): { ok: true; safe: boolean } | { ok: false; reason: string } {
    if (this.snapshot.bomb.state !== 'ARMED') return { ok: false, reason: 'CHARGE_NOT_ARMED' };
    this.commit(
      {
        ...this.snapshot,
        objective: safe ? 'REACH THE GETAWAY CAR' : 'RECOVER AND REACH THE GETAWAY CAR',
        bomb: { state: 'DETONATED', safeDetonation: safe },
      },
      'CHARGE_DETONATED',
      safe ? 'The charge opened the gate after Cody reached cover.' : 'The charge detonated before Cody reached safety.',
      !safe,
    );
    if (!safe) {
      this.damageCharacter('CODY', 55, 'EXPLOSION');
      if (this.snapshot.phase === 'MISSION') this.recordCriticalIncident('PREMATURE_DETONATION');
    }
    return { ok: true, safe };
  }

  activateChaseCheckpoint(): CommandResult {
    const baseline = BASELINES.CHASE_START;
    this.commit(
      {
        ...this.snapshot,
        phase: 'MISSION',
        section: baseline.section,
        checkpoint: 'CHASE_START',
        objective: baseline.objective,
        characters: cloneCharacters(baseline.characters),
        criticalIncidents: 0,
        failure: null,
        requiredDecision: null,
        switching: { state: 'READY' },
        vehicle: baseline.vehicle ? { ...baseline.vehicle } : null,
        bomb: { state: 'DETONATED', safeDetonation: this.snapshot.bomb.safeDetonation },
      },
      'CHECKPOINT_REACHED',
      'Owen and Cody reached the getaway car.',
    );
    return { ok: true };
  }

  restoreCheckpoint(): CommandResult {
    const checkpoint = this.snapshot.checkpoint ?? 'FACILITY_START';
    const baseline = BASELINES[checkpoint];
    this.commit(
      {
        ...this.snapshot,
        phase: 'MISSION',
        section: baseline.section,
        checkpoint,
        objective: baseline.objective,
        humanCharacter: 'OWEN',
        partnerTactic: 'HOLD',
        characters: cloneCharacters(baseline.characters),
        vehicle: baseline.vehicle ? { ...baseline.vehicle } : null,
        criticalIncidents: 0,
        failure: null,
        paused: false,
        requiredDecision: null,
        switching: { state: 'READY' },
        bomb: { state: checkpoint === 'CHASE_START' ? 'DETONATED' : 'IDLE', safeDetonation: null },
      },
      'CHECKPOINT_RESTORED',
      `${checkpoint} restored with its authored fair baseline.`,
    );
    return { ok: true };
  }

  damageVehicle(
    amount: number,
    cause: 'PURSUER_FIRE' | 'COLLISION',
  ): { ok: true; applied: number } {
    const current = this.snapshot.vehicle?.integrity ?? 0;
    const applied = Math.min(Math.max(amount, 0), current);
    const integrity = current - applied;
    let next: MissionSnapshot = { ...this.snapshot, vehicle: { integrity } };
    if (integrity === 0) {
      next = {
        ...next,
        phase: 'FAILURE',
        failure: { code: 'VEHICLE_DESTROYED', cause },
      };
    }
    this.commit(
      next,
      integrity === 0 ? 'VEHICLE_DESTROYED' : 'VEHICLE_DAMAGED',
      `The getaway car took ${applied} damage from ${cause}.`,
      integrity === 0,
    );
    return { ok: true, applied };
  }

  openRequiredDecision(input: {
    id: string;
    kind: string;
    actions: readonly string[];
    timeoutMs: number;
  }): CommandResult {
    if (this.snapshot.phase !== 'MISSION') return { ok: false, reason: 'MISSION_NOT_ACTIVE' };
    const openedAt = this.options.now();
    this.commit(
      {
        ...this.snapshot,
        requiredDecision: {
          id: input.id,
          kind: input.kind,
          actions: [...input.actions],
          openedAt,
          deadlineAt: openedAt + input.timeoutMs,
        },
      },
      'AGENT_DECISION_REQUIRED',
      `${input.kind} requires an agent choice.`,
    );
    return { ok: true };
  }

  resolveRequiredDecision(
    decisionId: string,
    action: string,
  ):
    | { ok: true }
    | { ok: false; reason: 'STALE_DECISION' | 'ACTION_NOT_AVAILABLE' | 'DECISION_EXPIRED' } {
    const decision = this.snapshot.requiredDecision;
    if (!decision || decision.id !== decisionId) return { ok: false, reason: 'STALE_DECISION' };
    if (this.options.now() > decision.deadlineAt) {
      this.failDecisionTimeout();
      return { ok: false, reason: 'DECISION_EXPIRED' };
    }
    if (!decision.actions.includes(action)) return { ok: false, reason: 'ACTION_NOT_AVAILABLE' };
    this.commit(
      { ...this.snapshot, requiredDecision: null },
      'AGENT_DECISION_RESOLVED',
      `${decision.kind} resolved with ${action}.`,
    );
    return { ok: true };
  }

  beginSwitch():
    | { ok: true; from: CharacterId; to: CharacterId }
    | { ok: false; reason: 'SWITCH_COOLDOWN' | 'SWITCH_UNAVAILABLE' | 'SWITCH_LOCKED' } {
    if (this.snapshot.switching.state === 'LOCKED') return { ok: false, reason: 'SWITCH_LOCKED' };
    if (this.snapshot.switching.state === 'COOLDOWN') return { ok: false, reason: 'SWITCH_COOLDOWN' };
    if (
      this.snapshot.switching.state !== 'READY' ||
      this.snapshot.phase !== 'MISSION' ||
      this.snapshot.requiredDecision?.kind.startsWith('CHASE_TURN_')
    ) {
      return { ok: false, reason: 'SWITCH_UNAVAILABLE' };
    }
    const from = this.snapshot.humanCharacter;
    const to: CharacterId = from === 'OWEN' ? 'CODY' : 'OWEN';
    this.commit(
      {
        ...this.snapshot,
        switching: { state: 'TRANSITION', from, to, endsAt: this.options.now() + 1_800 },
      },
      'SWITCH_STARTED',
      `Perspective transition started from ${from} to ${to}.`,
    );
    return { ok: true, from, to };
  }

  forceHumanCharacter(character: CharacterId, lockMs: number, reason: string): CommandResult {
    if (this.snapshot.phase !== 'MISSION') return { ok: false, reason: 'MISSION_NOT_ACTIVE' };
    this.commit(
      {
        ...this.snapshot,
        humanCharacter: character,
        switching: {
          state: 'LOCKED',
          character,
          reason,
          endsAt: this.options.now() + Math.max(lockMs, 0),
        },
      },
      'FORCED_SWITCH_LOCK',
      `${character} is human-controlled for ${lockMs}ms: ${reason}.`,
    );
    return { ok: true };
  }

  setPartnerTactic(tactic: PartnerTactic): CommandResult {
    if (!tacticsSet.has(tactic)) return { ok: false, reason: 'TACTIC_NOT_AVAILABLE' };
    this.commit(
      { ...this.snapshot, partnerTactic: tactic },
      'PARTNER_TACTIC_SET',
      `The agent set ${tactic}.`,
    );
    return { ok: true };
  }

  pause(): CommandResult {
    if (!this.snapshot.paused) {
      this.pausedAt = this.options.now();
      this.commit({ ...this.snapshot, paused: true }, 'MISSION_PAUSED', 'The human paused the mission.');
    }
    return { ok: true };
  }

  resume(): CommandResult {
    if (!this.snapshot.paused || this.pausedAt === null) return { ok: true };
    const pausedFor = this.options.now() - this.pausedAt;
    const switching = this.shiftSwitchingDeadline(this.snapshot.switching, pausedFor);
    this.pausedDurationMs += pausedFor;
    this.pausedAt = null;
    this.commit(
      {
        ...this.snapshot,
        paused: false,
        requiredDecision: this.snapshot.requiredDecision
          ? {
              ...this.snapshot.requiredDecision,
              deadlineAt: this.snapshot.requiredDecision.deadlineAt + pausedFor,
            }
          : null,
        switching,
      },
      'MISSION_RESUMED',
      `The mission resumed after ${pausedFor}ms.`,
    );
    return { ok: true };
  }

  completeMission(): CommandResult {
    if (this.snapshot.section !== 'CHASE' || this.snapshot.phase !== 'MISSION') {
      return { ok: false, reason: 'ESCAPE_NOT_REACHED' };
    }
    this.runEndedAt = this.options.now();
    this.commit(
      {
        ...this.snapshot,
        phase: 'COMPLETE',
        objective: 'HEIST COMPLETE',
        requiredDecision: null,
        switching: { state: 'READY' },
      },
      'HEIST_COMPLETE',
      'Owen and Cody escaped the pursuit together.',
      true,
    );
    return { ok: true };
  }

  returnToPairing(): CommandResult {
    this.runStartedAt = null;
    this.runEndedAt = null;
    this.pausedAt = null;
    this.pausedDurationMs = 0;
    this.resetHistoryOnFacilityEntry = true;
    this.commit(
      {
        ...this.snapshot,
        phase: 'PAIRING',
        runId: null,
        section: null,
        checkpoint: null,
        objective: this.snapshot.partner.online ? 'PARTNER ONLINE — READY' : 'PAIR WITH YOUR PARTNER',
        criticalIncidents: 0,
        failure: null,
        paused: false,
        requiredDecision: null,
        switching: { state: 'READY' },
        vehicle: null,
        bomb: { state: 'IDLE', safeDetonation: null },
      },
      'RETURNED_TO_PAIRING',
      'The human returned to the pairing screen.',
    );
    return { ok: true };
  }

  continueFromCheckpoint(checkpoint: CheckpointId, runId: string): CommandResult {
    if (!this.snapshot.partner.online) return { ok: false, reason: 'PARTNER_REQUIRED' };
    const baseline = BASELINES[checkpoint];
    this.runStartedAt = this.options.now();
    this.runEndedAt = null;
    this.pausedAt = null;
    this.pausedDurationMs = 0;
    this.resetHistoryOnFacilityEntry = false;
    this.commit(
      {
        ...this.snapshot,
        phase: 'MISSION',
        runId,
        section: baseline.section,
        checkpoint,
        objective: baseline.objective,
        humanCharacter: 'OWEN',
        partnerTactic: 'HOLD',
        characters: cloneCharacters(baseline.characters),
        criticalIncidents: 0,
        failure: null,
        paused: false,
        requiredDecision: null,
        switching: { state: 'READY' },
        vehicle: baseline.vehicle ? { ...baseline.vehicle } : null,
        bomb: {
          state: checkpoint === 'CHASE_START' ? 'DETONATED' : 'IDLE',
          safeDetonation: checkpoint === 'CHASE_START' ? true : null,
        },
      },
      'CHECKPOINT_CONTINUED',
      `${checkpoint} was reconstructed from its trusted authored baseline.`,
    );
    return { ok: true };
  }

  replay(): CommandResult {
    if (this.snapshot.phase !== 'COMPLETE') return { ok: false, reason: 'RUN_NOT_COMPLETE' };
    this.runStartedAt = null;
    this.runEndedAt = null;
    this.pausedAt = null;
    this.pausedDurationMs = 0;
    this.resetHistoryOnFacilityEntry = false;
    this.commit(
      {
        ...this.snapshot,
        history: [],
        phase: 'TITLE',
        runId: this.options.createId(),
        section: null,
        checkpoint: null,
        objective: 'PREPARE TO REPLAY',
        humanCharacter: 'OWEN',
        partnerTactic: 'HOLD',
        characters: cloneCharacters(BASELINES.FACILITY_START.characters),
        criticalIncidents: 0,
        failure: null,
        paused: false,
        requiredDecision: null,
        switching: { state: 'READY' },
        vehicle: null,
        bomb: { state: 'IDLE', safeDetonation: null },
      },
      'REPLAY_STARTED',
      'A new run was created while long-term partner memory remained intact.',
    );
    return { ok: true };
  }

  tick(): void {
    if (this.snapshot.paused) return;
    const now = this.options.now();
    const switching = this.snapshot.switching;
    if (switching.state === 'TRANSITION' && now >= switching.endsAt) {
      this.commit(
        {
          ...this.snapshot,
          humanCharacter: switching.to,
          switching: { state: 'COOLDOWN', cooldownEndsAt: now + 5_000 },
        },
        'SWITCH_COMPLETED',
        `The human now controls ${switching.to}.`,
      );
    } else if (switching.state === 'COOLDOWN' && now >= switching.cooldownEndsAt) {
      this.commit({ ...this.snapshot, switching: { state: 'READY' } });
    } else if (switching.state === 'LOCKED' && now >= switching.endsAt) {
      this.commit({ ...this.snapshot, switching: { state: 'READY' } }, 'SWITCH_LOCK_RELEASED', 'Free switching is available again.');
    }

    const decision = this.snapshot.requiredDecision;
    if (
      this.snapshot.phase === 'MISSION' &&
      decision &&
      this.options.now() > decision.deadlineAt
    ) {
      this.failDecisionTimeout();
    }
  }

  private failDecisionTimeout(): void {
    const decision = this.snapshot.requiredDecision;
    this.commit(
      {
        ...this.snapshot,
        phase: 'FAILURE',
        requiredDecision: null,
        failure: { code: 'MISSION_COMPROMISED', cause: 'AGENT_DECISION_TIMEOUT' },
      },
      'AGENT_DECISION_TIMEOUT',
      `${decision?.kind ?? 'Required decision'} expired without a valid agent action.`,
      true,
    );
  }

  private shiftSwitchingDeadline(switching: SwitchingState, by: number): SwitchingState {
    if (switching.state === 'TRANSITION') return { ...switching, endsAt: switching.endsAt + by };
    if (switching.state === 'COOLDOWN') {
      return { ...switching, cooldownEndsAt: switching.cooldownEndsAt + by };
    }
    if (switching.state === 'LOCKED') return { ...switching, endsAt: switching.endsAt + by };
    return switching;
  }

  private commit(
    next: MissionSnapshot,
    type?: string,
    summary?: string,
    consequential = false,
  ): void {
    if (type && summary) {
      const event: MissionHistoryEvent = {
        id: `mission-event-${++this.historySequence}`,
        type,
        summary,
        timestamp: this.options.now(),
        consequential,
      };
      this.snapshot = { ...next, history: [...next.history, event] };
    } else {
      this.snapshot = next;
    }
    for (const listener of this.listeners) listener();
  }
}

const tacticsSet = new Set<PartnerTactic>([
  'ADVANCE',
  'COVER',
  'FLANK',
  'RETREAT',
  'PROTECT',
  'HOLD',
]);
