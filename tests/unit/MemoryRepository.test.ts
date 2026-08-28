import { MemoryRepository, type MemoryStorage } from '../../src/memory/MemoryRepository';

function createStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

describe('MemoryRepository evidence validation', () => {
  it('rejects a lesson whose evidence event does not exist', () => {
    const repository = new MemoryRepository({
      storage: createStorage(),
      now: () => 10_000,
      createId: () => 'lesson-1',
      getEvent: () => undefined,
    });

    expect(
      repository.recordLesson({
        evidenceEventId: 'missing-event',
        lesson: 'Wait for Owen to establish cover before crossing.',
        affectedTactic: 'ADVANCE',
      }),
    ).toEqual({ ok: false, reason: 'EVIDENCE_NOT_FOUND' });
    expect(repository.getDocument().lessons).toEqual([]);
  });

  it('persists an evidence-backed lesson and deduplicates the same tactic lesson', () => {
    const storage = createStorage();
    const event = {
      id: 'event-9',
      runId: 'run-2',
      section: 'BOMB_GATE',
      type: 'CRITICAL_INCIDENT',
      summary: 'Cody crossed before Owen established cover.',
      consequence: 'Cody lost 45 health and the plant was interrupted.',
      consequential: true,
    } as const;
    let now = 20_000;
    const create = () =>
      new MemoryRepository({
        storage,
        now: () => now,
        createId: () => (now === 20_000 ? 'lesson-1' : 'lesson-2'),
        getEvent: (id) => (id === event.id ? event : undefined),
      });

    expect(
      create().recordLesson({
        evidenceEventId: event.id,
        lesson: 'Wait for Owen to establish cover before crossing.',
        affectedTactic: 'ADVANCE',
      }),
    ).toEqual({ ok: true, lessonId: 'lesson-1', created: true });

    now = 30_000;
    const reloaded = create();
    expect(
      reloaded.recordLesson({
        evidenceEventId: event.id,
        lesson: 'Wait for Owen to establish cover before crossing.',
        affectedTactic: 'ADVANCE',
      }),
    ).toEqual({ ok: true, lessonId: 'lesson-1', created: false });
    expect(reloaded.getDocument().lessons).toEqual([
      {
        id: 'lesson-1',
        runId: 'run-2',
        section: 'BOMB_GATE',
        evidenceEventId: 'event-9',
        evidence: 'Cody crossed before Owen established cover.',
        consequence: 'Cody lost 45 health and the plant was interrupted.',
        lesson: 'Wait for Owen to establish cover before crossing.',
        affectedTactic: 'ADVANCE',
        occurrences: 2,
        createdAt: 20_000,
        lastSeenAt: 30_000,
        uses: [],
      },
    ]);
  });

  it('links a later action, renders Markdown, and resets only partner memory', () => {
    const storage = createStorage();
    storage.setItem('unrelated-setting', 'keep-me');
    const event = {
      id: 'event-11',
      runId: 'run-3',
      section: 'CHASE',
      type: 'FAILURE',
      summary: 'The driver chose left at the loading-bay fork.',
      consequence: 'The car hit the barrier and lost 40 integrity.',
      consequential: true,
    };
    const repository = new MemoryRepository({
      storage,
      now: () => 40_000,
      createId: () => 'lesson-drive',
      getEvent: (id) => (id === event.id ? event : undefined),
    });
    repository.recordLesson({
      evidenceEventId: event.id,
      lesson: 'Hold the centre line at the loading-bay fork.',
      affectedTactic: 'DRIVE',
    });

    expect(
      repository.markLessonUsed('lesson-drive', {
        eventId: 'event-12',
        action: 'HOLD',
      }),
    ).toEqual({ ok: true });
    expect(repository.toMarkdown()).toContain(
      '## Lesson lesson-drive — Hold the centre line at the loading-bay fork.',
    );
    expect(repository.toMarkdown()).toContain(
      '- Later use: `HOLD` at event `event-12`',
    );

    repository.reset();
    expect(repository.getDocument().lessons).toEqual([]);
    expect(storage.getItem('unrelated-setting')).toBe('keep-me');
  });
});
