import { MissionStore } from '../../src/game/MissionStore';
import { MemoryRepository, type MemoryStorage } from '../../src/memory/MemoryRepository';
import { PartnerCoordinator } from '../../src/partner/PartnerCoordinator';

function createStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('PartnerCoordinator pairing', () => {
  it('joins one real page session and returns the continuous agent-loop contract', () => {
    const store = new MissionStore({ now: () => 1_000, createId: () => 'session-1' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 1_000,
      createId: () => 'lesson-1',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 1_000 });

    const first = coordinator.join('Codex');
    const repeated = coordinator.join('Second name');

    expect(first).toMatchObject({
      ok: true,
      status: 'PARTNER_ONLINE',
      sessionId: 'session-1',
      alreadyJoined: false,
    });
    expect(first.instructionsText).toContain('wait_for_mission_event');
    expect(repeated).toMatchObject({
      ok: true,
      sessionId: 'session-1',
      alreadyJoined: true,
    });
    expect(store.getSnapshot().partner).toEqual({
      online: true,
      name: 'Codex',
      sessionId: 'session-1',
    });
  });
});

describe('PartnerCoordinator event loop', () => {
  it('notifies visible UI subscribers for every published partner event and supports cleanup', () => {
    const store = new MissionStore({ now: () => 1_500, createId: () => 'session-ui' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 1_500,
      createId: () => 'lesson-ui',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 1_500 });
    const listener = vi.fn();
    const unsubscribe = coordinator.onEvent(listener);

    const first = coordinator.publish({ type: 'AGENT_RADIO', summary: 'ACK: Moving.' });
    expect(listener).toHaveBeenCalledWith(first);

    unsubscribe();
    coordinator.publish({ type: 'AGENT_RADIO', summary: 'ACK: Holding.' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns the next sequenced event with the same live mission observation', async () => {
    const store = new MissionStore({ now: () => 2_000, createId: () => 'session-2' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 2_000,
      createId: () => 'lesson-2',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 2_000 });
    const { sessionId } = coordinator.join('Codex');
    store.startMission();
    store.enterFacility();
    coordinator.publish({ type: 'HUMAN_CALLOUT', summary: 'COVER ME' });

    await expect(
      coordinator.waitForEvent(
        { sessionId, lastSequence: 0, maxWaitMs: 100 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      ok: true,
      sequence: 1,
      event: { type: 'HUMAN_CALLOUT', summary: 'COVER ME' },
      observation: {
        phase: 'MISSION',
        section: 'FACILITY_ONE',
        humanCharacter: 'OWEN',
        partnerCharacter: 'CODY',
        objective: 'ESCAPE THE LOCKDOWN',
      },
    });
  });

  it('cancels a pending event wait through the WebMCP AbortSignal', async () => {
    const store = new MissionStore({ now: () => 3_000, createId: () => 'session-3' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 3_000,
      createId: () => 'lesson-3',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 3_000 });
    const { sessionId } = coordinator.join('Codex');
    const controller = new AbortController();

    const waiting = coordinator.waitForEvent(
      { sessionId, lastSequence: 0, maxWaitMs: 25 },
      controller.signal,
    );
    controller.abort();

    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('applies an authenticated agent tactic and publishes its visible consequence', async () => {
    const store = new MissionStore({ now: () => 4_000, createId: () => 'session-4' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 4_000,
      createId: () => 'lesson-4',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 4_000 });
    const { sessionId } = coordinator.join('Codex');
    store.startMission();
    store.enterFacility();

    expect(
      coordinator.setTactic({
        sessionId,
        tactic: 'COVER',
        radioLine: 'I have your lane. Move.',
        usedLessonIds: [],
      }),
    ).toEqual({ ok: true, tactic: 'COVER' });
    expect(store.getSnapshot().partnerTactic).toBe('COVER');

    await expect(
      coordinator.waitForEvent(
        { sessionId, lastSequence: 0, maxWaitMs: 25 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      event: { type: 'AGENT_TACTIC', summary: 'COVER — I have your lane. Move.' },
    });
  });

  it('rejects an invalid tactic even when a caller bypasses the WebMCP schema', () => {
    const store = new MissionStore({ now: () => 4_500, createId: () => 'session-invalid' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 4_500,
      createId: () => 'lesson-invalid',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 4_500 });
    const { sessionId } = coordinator.join('Codex');

    expect(
      coordinator.setTactic({
        sessionId,
        tactic: 'TELEPORT' as never,
        radioLine: 'Skipping the map.',
        usedLessonIds: [],
      }),
    ).toEqual({ ok: false, reason: 'TACTIC_NOT_AVAILABLE' });
    expect(store.getSnapshot().partnerTactic).toBe('HOLD');
  });

  it('resolves a required decision once and notifies the gameplay listener', () => {
    const store = new MissionStore({ now: () => 5_000, createId: () => 'session-5' });
    const memory = new MemoryRepository({
      storage: createStorage(),
      now: () => 5_000,
      createId: () => 'lesson-5',
      getEvent: () => undefined,
    });
    const coordinator = new PartnerCoordinator({ store, memory, now: () => 5_000 });
    const { sessionId } = coordinator.join('Codex');
    store.startMission();
    store.enterFacility();
    store.openRequiredDecision({
      id: 'plant-1',
      kind: 'BOMB_PLANT',
      actions: ['PLANT', 'WAIT', 'RETREAT'],
      timeoutMs: 20_000,
    });
    const listener = vi.fn();
    coordinator.onDecisionResolved(listener);

    expect(
      coordinator.resolveDecision({
        sessionId,
        decisionId: 'plant-1',
        action: 'PLANT',
        radioLine: 'Moving to the charge point.',
        usedLessonIds: [],
      }),
    ).toEqual({ ok: true });
    expect(listener).toHaveBeenCalledWith({
      decisionId: 'plant-1',
      kind: 'BOMB_PLANT',
      action: 'PLANT',
    });

    expect(
      coordinator.resolveDecision({
        sessionId,
        decisionId: 'plant-1',
        action: 'WAIT',
        radioLine: 'Waiting.',
        usedLessonIds: [],
      }),
    ).toEqual({ ok: false, reason: 'STALE_DECISION' });
  });
});
