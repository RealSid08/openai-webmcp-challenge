import { MissionStore } from '../../src/game/MissionStore';

describe('MissionStore pairing', () => {
  it('rejects mission start until a WebMCP partner has joined', () => {
    const store = new MissionStore({ now: () => 1_000, createId: () => 'fixed-id' });

    const result = store.startMission();

    expect(result).toEqual({ ok: false, reason: 'PARTNER_REQUIRED' });
    expect(store.getSnapshot().phase).toBe('PAIRING');
  });

  it('pairs one idempotent agent session and unlocks the title sequence', () => {
    const store = new MissionStore({ now: () => 1_000, createId: () => 'session-7' });

    expect(store.joinPartner('Codex')).toEqual({
      ok: true,
      sessionId: 'session-7',
      alreadyJoined: false,
    });
    expect(store.joinPartner('Codex again')).toEqual({
      ok: true,
      sessionId: 'session-7',
      alreadyJoined: true,
    });
    expect(store.startMission()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'TITLE',
      partner: { online: true, name: 'Codex', sessionId: 'session-7' },
    });
  });
});

describe('MissionStore mission lifecycle', () => {
  it('publishes immutable snapshots only after successful commands and records an action history', () => {
    const store = new MissionStore({ now: () => 1_500, createId: () => 'history-id' });
    const snapshots: string[] = [];
    const unsubscribe = store.subscribe(() => snapshots.push(store.getSnapshot().phase));

    store.startMission();
    expect(snapshots).toEqual([]);

    store.joinPartner('Codex');
    store.startMission();
    unsubscribe();
    store.enterFacility();

    expect(snapshots).toEqual(['PAIRING', 'TITLE']);
    expect(store.getSnapshot().history.map((event) => event.type)).toEqual([
      'PARTNER_JOINED',
      'MISSION_STARTED',
      'FACILITY_ENTERED',
    ]);
  });

  it('enters the facility with a complete survivable mission baseline', () => {
    const store = new MissionStore({ now: () => 2_000, createId: () => 'run-1' });
    store.joinPartner('Codex');
    store.startMission();

    expect(store.enterFacility()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'MISSION',
      section: 'FACILITY_ONE',
      checkpoint: 'FACILITY_START',
      objective: 'ESCAPE THE LOCKDOWN',
      humanCharacter: 'OWEN',
      partnerTactic: 'HOLD',
      characters: {
        OWEN: { health: 100, ammo: { magazine: 18, reserve: 72 } },
        CODY: { health: 100, ammo: { magazine: 18, reserve: 72 } },
      },
      criticalIncidents: 0,
    });
  });

  it('fails with role-aware attribution when the agent-controlled character is downed', () => {
    const store = new MissionStore({ now: () => 3_000, createId: () => 'run-2' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    expect(store.damageCharacter('CODY', 100, 'ENEMY_FIRE')).toEqual({ ok: true, applied: 100 });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'FAILURE',
      failure: { code: 'PARTNER_DOWN', character: 'CODY', cause: 'ENEMY_FIRE' },
      characters: { CODY: { health: 0 } },
    });
  });

  it('records the concrete enemy and shot that caused firearm damage', () => {
    const store = new MissionStore({ now: () => 3_200, createId: () => 'run-shot' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    store.damageCharacter('OWEN', 6, 'ENEMY_FIRE', {
      sourceId: 'guard-1',
      shotId: 'enemy-shot-4',
    });

    expect(store.getSnapshot().history.at(-1)?.summary).toContain('guard-1 / enemy-shot-4');
  });

  it('keeps two critical incidents recoverable and fails the third', () => {
    const store = new MissionStore({ now: () => 4_000, createId: () => 'run-3' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    expect(store.recordCriticalIncident('LEFT_PARTNER_EXPOSED')).toMatchObject({ ok: true, count: 1 });
    expect(store.recordCriticalIncident('LOST_COVER_POSITION')).toMatchObject({ ok: true, count: 2 });
    expect(store.getSnapshot().phase).toBe('MISSION');

    expect(store.recordCriticalIncident('MISSED_OBJECTIVE_WINDOW')).toMatchObject({ ok: true, count: 3 });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'FAILURE',
      criticalIncidents: 3,
      failure: { code: 'MISSION_COMPROMISED', cause: 'MISSED_OBJECTIVE_WINDOW' },
    });
  });

  it('restores the authored checkpoint baseline without carrying section damage', () => {
    const store = new MissionStore({ now: () => 5_000, createId: () => 'run-4' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.damageCharacter('OWEN', 45, 'ENEMY_FIRE');
    store.recordCriticalIncident('BAD_POSITION');
    store.forceHumanCharacter('CODY', 0, 'TEST_ROLE_CHANGE');
    store.damageCharacter('CODY', 100, 'ENEMY_FIRE');

    expect(store.restoreCheckpoint()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'MISSION',
      section: 'FACILITY_ONE',
      humanCharacter: 'OWEN',
      checkpoint: 'FACILITY_START',
      failure: null,
      criticalIncidents: 0,
      characters: {
        OWEN: { health: 100, ammo: { magazine: 18, reserve: 72 } },
        CODY: { health: 100, ammo: { magazine: 18, reserve: 72 } },
      },
    });
  });

  it('freezes required-decision deadlines while paused and fails after resumed expiry', () => {
    let now = 1_000;
    const store = new MissionStore({ now: () => now, createId: () => 'run-5' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.openRequiredDecision({
      id: 'decision-1',
      kind: 'BOMB_PLANT',
      actions: ['PLANT', 'WAIT', 'RETREAT'],
      timeoutMs: 10_000,
    });

    now = 5_000;
    store.pause();
    expect(store.getMissionElapsedMs()).toBe(4_000);
    now = 20_000;
    store.tick();
    expect(store.getSnapshot().phase).toBe('MISSION');
    expect(store.getMissionElapsedMs()).toBe(4_000);

    store.resume();
    expect(store.getSnapshot().requiredDecision?.deadlineAt).toBe(26_000);
    now = 26_001;
    store.tick();
    expect(store.getMissionElapsedMs()).toBe(10_001);
    expect(store.getSnapshot()).toMatchObject({
      phase: 'FAILURE',
      failure: { code: 'MISSION_COMPROMISED', cause: 'AGENT_DECISION_TIMEOUT' },
    });
  });

  it('rejects stale or invalid agent decisions and accepts the active allowed action', () => {
    const store = new MissionStore({ now: () => 8_000, createId: () => 'run-6' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.openRequiredDecision({
      id: 'turn-a',
      kind: 'CHASE_TURN',
      actions: ['LEFT', 'RIGHT', 'HOLD'],
      timeoutMs: 30_000,
    });

    expect(store.resolveRequiredDecision('turn-old', 'LEFT')).toEqual({
      ok: false,
      reason: 'STALE_DECISION',
    });
    expect(store.resolveRequiredDecision('turn-a', 'REVERSE')).toEqual({
      ok: false,
      reason: 'ACTION_NOT_AVAILABLE',
    });
    expect(store.getSnapshot().requiredDecision?.id).toBe('turn-a');

    expect(store.resolveRequiredDecision('turn-a', 'RIGHT')).toEqual({ ok: true });
    expect(store.getSnapshot().requiredDecision).toBeNull();
  });

  it('protects both bodies only during a switch and enforces the cooldown afterward', () => {
    let now = 1_000;
    const store = new MissionStore({ now: () => now, createId: () => 'run-7' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    expect(store.beginSwitch()).toEqual({ ok: true, from: 'OWEN', to: 'CODY' });
    expect(store.damageCharacter('CODY', 50, 'ENEMY_FIRE')).toEqual({
      ok: true,
      applied: 0,
      protected: true,
    });

    now = 2_801;
    store.tick();
    expect(store.getSnapshot()).toMatchObject({
      humanCharacter: 'CODY',
      switching: { state: 'COOLDOWN', cooldownEndsAt: 7_801 },
    });
    expect(store.beginSwitch()).toEqual({ ok: false, reason: 'SWITCH_COOLDOWN' });

    now = 7_802;
    store.tick();
    expect(store.getSnapshot().switching.state).toBe('READY');
  });

  it('uses the chase checkpoint and fails when pursuing fire destroys the car', () => {
    const store = new MissionStore({ now: () => 9_000, createId: () => 'run-8' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    expect(store.activateChaseCheckpoint()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'MISSION',
      section: 'CHASE',
      checkpoint: 'CHASE_START',
      objective: 'ESCAPE THE PURSUIT',
      vehicle: { integrity: 100 },
    });

    expect(store.damageVehicle(100, 'PURSUER_FIRE')).toEqual({ ok: true, applied: 100 });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'FAILURE',
      vehicle: { integrity: 0 },
      failure: { code: 'VEHICLE_DESTROYED', cause: 'PURSUER_FIRE' },
    });

    store.restoreCheckpoint();
    expect(store.getSnapshot()).toMatchObject({
      phase: 'MISSION',
      section: 'CHASE',
      checkpoint: 'CHASE_START',
      vehicle: { integrity: 100 },
    });
  });

  it('restores the second authored checkpoint after room one without carrying damage', () => {
    const store = new MissionStore({ now: () => 10_000, createId: () => 'run-room-one' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.damageCharacter('OWEN', 25, 'ENEMY_FIRE');

    expect(store.activateRoomOneCheckpoint()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      section: 'FACILITY_TWO',
      checkpoint: 'ROOM_ONE_CLEAR',
      objective: 'REACH THE BLAST GATE',
      characters: { OWEN: { health: 88 }, CODY: { health: 88 } },
    });

    store.damageCharacter('OWEN', 70, 'ENEMY_FIRE');
    store.restoreCheckpoint();
    expect(store.getSnapshot()).toMatchObject({
      section: 'FACILITY_TWO',
      checkpoint: 'ROOM_ONE_CLEAR',
      characters: { OWEN: { health: 88 }, CODY: { health: 88 } },
    });
  });

  it('locks a forced perspective, completes the charge safely, and unlocks on time', () => {
    let now = 20_000;
    const store = new MissionStore({ now: () => now, createId: () => 'run-bomb' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.activateRoomOneCheckpoint();

    expect(store.enterBombGate()).toEqual({ ok: true });
    expect(store.forceHumanCharacter('OWEN', 20_000, 'CODY_PLANTING')).toEqual({ ok: true });
    expect(store.beginSwitch()).toEqual({ ok: false, reason: 'SWITCH_LOCKED' });
    expect(store.startChargePlant()).toEqual({ ok: true });
    expect(store.armCharge()).toEqual({ ok: true });
    expect(store.detonateCharge(true)).toEqual({ ok: true, safe: true });
    expect(store.getSnapshot()).toMatchObject({
      bomb: { state: 'DETONATED', safeDetonation: true },
      objective: 'REACH THE GETAWAY CAR',
    });

    now = 40_001;
    store.tick();
    expect(store.getSnapshot().switching).toEqual({ state: 'READY' });
  });

  it('tracks ammunition and preserves memory-ready run identity across replay', () => {
    const ids = ['session-replay', 'run-2'];
    const store = new MissionStore({ now: () => 30_000, createId: () => ids.shift() ?? 'later' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();

    expect(store.fireWeapon('OWEN')).toEqual({ ok: true, remaining: 17 });
    expect(store.reloadWeapon('OWEN')).toEqual({ ok: true, magazine: 18, reserve: 71 });
    store.activateChaseCheckpoint();
    expect(store.completeMission()).toEqual({ ok: true });
    const firstRunId = store.getSnapshot().runId;
    expect(store.getSnapshot().phase).toBe('COMPLETE');

    expect(store.replay()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'TITLE',
      section: null,
      checkpoint: null,
      partner: { online: true, sessionId: 'session-replay' },
    });
    expect(store.getSnapshot().runId).not.toBe(firstRunId);
    expect(store.getSnapshot().history.map((event) => event.type)).toEqual(['REPLAY_STARTED']);
  });

  it('returns to pairing and continues only from a trusted authored checkpoint', () => {
    const store = new MissionStore({ now: () => 40_000, createId: () => 'session-continue' });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.activateRoomOneCheckpoint();

    expect(store.returnToPairing()).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'PAIRING',
      section: null,
      partner: { online: true, sessionId: 'session-continue' },
    });

    expect(store.continueFromCheckpoint('ROOM_ONE_CLEAR', 'saved-run')).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      phase: 'MISSION',
      runId: 'saved-run',
      checkpoint: 'ROOM_ONE_CLEAR',
      section: 'FACILITY_TWO',
      characters: { OWEN: { health: 88 }, CODY: { health: 88 } },
    });
  });

  it('starts a clean run history after returning to pairing without losing the partner session', () => {
    let id = 0;
    const store = new MissionStore({ now: () => 45_000, createId: () => `new-run-${++id}` });
    store.joinPartner('Codex');
    store.startMission();
    store.enterFacility();
    store.damageCharacter('OWEN', 10, 'ENEMY_FIRE');
    store.returnToPairing();

    store.startMission();
    store.enterFacility();

    expect(store.getSnapshot().partner).toMatchObject({ online: true, sessionId: 'new-run-1' });
    expect(store.getSnapshot().history.map((event) => event.type)).toEqual([
      'MISSION_STARTED',
      'FACILITY_ENTERED',
    ]);
  });
});
