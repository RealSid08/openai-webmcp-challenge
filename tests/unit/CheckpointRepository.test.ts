import {
  CheckpointRepository,
  type CheckpointStorage,
} from '../../src/persistence/CheckpointRepository';

function createStorage(initial: Record<string, string> = {}): CheckpointStorage & {
  values: Map<string, string>;
} {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('CheckpointRepository', () => {
  it('persists only trusted checkpoint metadata and reloads it safely', () => {
    const storage = createStorage();
    const repository = new CheckpointRepository({ storage, now: () => 12_000 });

    repository.save({
      checkpoint: 'ROOM_ONE_CLEAR',
      runId: 'run-7',
      promptsSeen: ['movement', 'switching'],
      summary: { attempts: 2, failures: 1 },
    });

    expect(new CheckpointRepository({ storage, now: () => 99_000 }).load()).toEqual({
      version: 1,
      checkpoint: 'ROOM_ONE_CLEAR',
      runId: 'run-7',
      savedAt: 12_000,
      promptsSeen: ['movement', 'switching'],
      summary: { attempts: 2, failures: 1 },
    });
  });

  it('rejects corrupt or unknown checkpoint documents instead of restoring arbitrary state', () => {
    const storage = createStorage({
      'hs-heist.checkpoint.v1': JSON.stringify({
        version: 1,
        checkpoint: 'OPEN_WORLD_DEBUG',
        runId: 'run-danger',
        savedAt: 1,
        promptsSeen: [],
        summary: {},
        arbitraryWorldState: { health: 999999 },
      }),
    });

    expect(new CheckpointRepository({ storage, now: () => 1 }).load()).toBeNull();
  });

  it('clears its own save without touching partner memory or settings', () => {
    const storage = createStorage({
      'hs-heist.partner-memory.v1': 'memory',
      'hs-heist.settings.v1': 'settings',
    });
    const repository = new CheckpointRepository({ storage, now: () => 1 });
    repository.save({
      checkpoint: 'CHASE_START',
      runId: 'run-8',
      promptsSeen: [],
      summary: { attempts: 1, failures: 0 },
    });

    repository.clear();

    expect(repository.load()).toBeNull();
    expect(storage.values.get('hs-heist.partner-memory.v1')).toBe('memory');
    expect(storage.values.get('hs-heist.settings.v1')).toBe('settings');
  });
});
