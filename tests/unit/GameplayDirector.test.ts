import { GameplayDirector } from '../../src/game/GameplayDirector';
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

function createHarness() {
  let id = 0;
  const store = new MissionStore({ now: () => 10_000, createId: () => `id-${++id}` });
  const memory = new MemoryRepository({
    storage: createStorage(),
    now: () => 10_000,
    createId: () => `lesson-${++id}`,
    getEvent: () => undefined,
  });
  const coordinator = new PartnerCoordinator({ store, memory, now: () => 10_000 });
  const director = new GameplayDirector({ store, coordinator, createId: () => `decision-${++id}` });
  const { sessionId } = coordinator.join('Codex');
  store.startMission();
  store.enterFacility();
  return { store, coordinator, director, sessionId };
}

describe('GameplayDirector', () => {
  it('advances the two encounters into a genuine agent-controlled bomb sequence', () => {
    const { store, coordinator, director, sessionId } = createHarness();

    expect(director.completeEncounter()).toEqual({ ok: true, advancedTo: 'FACILITY_TWO' });
    expect(store.getSnapshot().checkpoint).toBe('ROOM_ONE_CLEAR');

    expect(director.completeEncounter()).toEqual({ ok: true, advancedTo: 'BOMB_GATE' });
    expect(store.getSnapshot().requiredDecision).toMatchObject({
      kind: 'BOMB_PLANT',
      actions: ['PLANT', 'WAIT', 'RETREAT'],
    });
    const plantId = store.getSnapshot().requiredDecision!.id;

    expect(
      coordinator.resolveDecision({
        sessionId,
        decisionId: plantId,
        action: 'PLANT',
        radioLine: 'Cover me. Moving to the gate.',
        usedLessonIds: [],
      }),
    ).toEqual({ ok: true });
    expect(store.getSnapshot()).toMatchObject({
      bomb: { state: 'PLANTING' },
      humanCharacter: 'OWEN',
      switching: { state: 'LOCKED', reason: 'CODY_PLANTING' },
    });

    expect(director.finishChargePlant()).toEqual({ ok: true });
    expect(store.getSnapshot().requiredDecision).toMatchObject({ kind: 'BOMB_RETREAT' });
    const retreatId = store.getSnapshot().requiredDecision!.id;
    coordinator.resolveDecision({
      sessionId,
      decisionId: retreatId,
      action: 'RETREAT',
      radioLine: 'Charge live. Falling back now.',
      usedLessonIds: [],
    });

    expect(director.detonateCharge()).toEqual({ ok: true, safe: true });
    expect(store.getSnapshot().bomb).toEqual({ state: 'DETONATED', safeDetonation: true });
    director.destroy();
  });

  it('requires the agent to steer when the human occupies Cody and carries its choice to the chase', () => {
    const { store, coordinator, director, sessionId } = createHarness();
    store.activateChaseCheckpoint();
    store.forceHumanCharacter('CODY', 0, 'CHASE_ROLE_ASSIGNMENT');
    store.tick();

    expect(director.requestChaseTurn(1)).toEqual({ ok: true, controller: 'AGENT' });
    const decision = store.getSnapshot().requiredDecision!;
    expect(decision).toMatchObject({ kind: 'CHASE_TURN_1', actions: ['LEFT', 'RIGHT', 'HOLD'] });

    coordinator.resolveDecision({
      sessionId,
      decisionId: decision.id,
      action: 'RIGHT',
      radioLine: 'Taking the right line.',
      usedLessonIds: [],
    });
    expect(director.consumeSteeringAction()).toBe('RIGHT');
    expect(director.consumeSteeringAction()).toBeNull();
    director.destroy();
  });
});
