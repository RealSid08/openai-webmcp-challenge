import { createAppServices } from '../../src/app/createAppServices';
import type { CheckpointStorage } from '../../src/persistence/CheckpointRepository';

function createStorage(): CheckpointStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('app service composition', () => {
  it('bridges committed mission history into sequenced partner events and checkpoint saves', async () => {
    const storage = createStorage();
    let id = 0;
    const services = createAppServices({
      storage,
      now: () => 5_000,
      createId: () => `id-${++id}`,
    });

    const { sessionId } = services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();

    await expect(
      services.coordinator.waitForEvent(
        { sessionId, lastSequence: 0, maxWaitMs: 25 },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      event: {
        type: 'PARTNER_JOINED',
        evidenceEventId: 'mission-event-1',
      },
    });

    const saved = services.checkpoints.load();
    expect(saved).toMatchObject({ checkpoint: 'FACILITY_START', runId: 'id-2' });
    services.destroy();
  });

  it('lets a consequential domain event become validated partner-memory evidence', () => {
    const services = createAppServices({
      storage: createStorage(),
      now: () => 6_000,
      createId: () => 'fixed-id',
    });
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();
    services.store.recordCriticalIncident('LEFT_PARTNER_EXPOSED');
    const evidence = services.store.getSnapshot().history.at(-1)!;

    expect(
      services.memory.recordLesson({
        evidenceEventId: evidence.id,
        lesson: 'Protect the exposed partner before advancing.',
        affectedTactic: 'PROTECT',
      }),
    ).toMatchObject({ ok: true, created: true });
    services.destroy();
  });

  it('updates checkpoint failure metadata and removes a stale continuation after completion', () => {
    const services = createAppServices({
      storage: createStorage(),
      now: () => 7_000,
      createId: () => 'run-id',
    });
    services.coordinator.join('Codex');
    services.store.startMission();
    services.store.enterFacility();
    services.store.damageCharacter('OWEN', 100, 'ENEMY_FIRE');
    expect(services.checkpoints.load()?.summary.failures).toBe(1);

    services.store.restoreCheckpoint();
    services.store.activateRoomOneCheckpoint();
    services.store.enterBombGate();
    services.store.startChargePlant();
    services.store.armCharge();
    services.store.detonateCharge(true);
    services.store.activateChaseCheckpoint();
    services.store.completeMission();
    expect(services.checkpoints.load()).toBeNull();
    services.destroy();
  });
});
