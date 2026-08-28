const STORAGE_KEY = 'hs-heist.partner-memory.v1';

export interface MemoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface MemoryEvent {
  id: string;
  runId: string;
  section: string;
  type: string;
  summary: string;
  consequence: string;
  consequential: boolean;
}

export interface LessonUse {
  eventId: string;
  action: string;
  usedAt: number;
}

export interface PartnerLesson {
  id: string;
  runId: string;
  section: string;
  evidenceEventId: string;
  evidence: string;
  consequence: string;
  lesson: string;
  affectedTactic: string;
  occurrences: number;
  createdAt: number;
  lastSeenAt: number;
  uses: LessonUse[];
}

export interface PartnerMemoryDocument {
  version: 1;
  lessons: PartnerLesson[];
}

interface MemoryRepositoryOptions {
  storage: MemoryStorage;
  now: () => number;
  createId: () => string;
  getEvent: (id: string) => MemoryEvent | undefined;
}

type RecordLessonResult =
  | { ok: true; lessonId: string; created: boolean }
  | { ok: false; reason: 'EVIDENCE_NOT_FOUND' | 'EVIDENCE_NOT_CONSEQUENTIAL' };

function emptyDocument(): PartnerMemoryDocument {
  return { version: 1, lessons: [] };
}

function loadDocument(storage: MemoryStorage): PartnerMemoryDocument {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyDocument();

  try {
    const parsed = JSON.parse(raw) as Partial<PartnerMemoryDocument>;
    if (parsed.version !== 1 || !Array.isArray(parsed.lessons)) return emptyDocument();
    return { version: 1, lessons: parsed.lessons as PartnerLesson[] };
  } catch {
    return emptyDocument();
  }
}

function semanticKey(tactic: string, lesson: string): string {
  return `${tactic.trim().toUpperCase()}::${lesson.trim().replaceAll(/\s+/g, ' ').toLowerCase()}`;
}

export class MemoryRepository {
  private document: PartnerMemoryDocument;

  constructor(private readonly options: MemoryRepositoryOptions) {
    this.document = loadDocument(options.storage);
  }

  recordLesson(input: {
    evidenceEventId: string;
    lesson: string;
    affectedTactic: string;
  }): RecordLessonResult {
    const event = this.options.getEvent(input.evidenceEventId);
    if (!event) return { ok: false, reason: 'EVIDENCE_NOT_FOUND' };
    if (!event.consequential) return { ok: false, reason: 'EVIDENCE_NOT_CONSEQUENTIAL' };

    const key = semanticKey(input.affectedTactic, input.lesson);
    const existingIndex = this.document.lessons.findIndex(
      (item) => semanticKey(item.affectedTactic, item.lesson) === key,
    );
    const now = this.options.now();

    if (existingIndex >= 0) {
      const existing = this.document.lessons[existingIndex];
      const updated: PartnerLesson = {
        ...existing,
        occurrences: existing.occurrences + 1,
        lastSeenAt: now,
      };
      this.document = {
        ...this.document,
        lessons: this.document.lessons.map((item, index) =>
          index === existingIndex ? updated : item,
        ),
      };
      this.persist();
      return { ok: true, lessonId: existing.id, created: false };
    }

    const lesson: PartnerLesson = {
      id: this.options.createId(),
      runId: event.runId,
      section: event.section,
      evidenceEventId: event.id,
      evidence: event.summary,
      consequence: event.consequence,
      lesson: input.lesson.trim(),
      affectedTactic: input.affectedTactic.trim().toUpperCase(),
      occurrences: 1,
      createdAt: now,
      lastSeenAt: now,
      uses: [],
    };
    this.document = { ...this.document, lessons: [...this.document.lessons, lesson] };
    this.persist();
    return { ok: true, lessonId: lesson.id, created: true };
  }

  getDocument(): PartnerMemoryDocument {
    return structuredClone(this.document);
  }

  markLessonUsed(
    lessonId: string,
    input: { eventId: string; action: string },
  ): { ok: true } | { ok: false; reason: 'LESSON_NOT_FOUND' } {
    const index = this.document.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index < 0) return { ok: false, reason: 'LESSON_NOT_FOUND' };

    const lesson = this.document.lessons[index];
    const updated: PartnerLesson = {
      ...lesson,
      uses: [
        ...lesson.uses,
        { eventId: input.eventId, action: input.action, usedAt: this.options.now() },
      ],
    };
    this.document = {
      ...this.document,
      lessons: this.document.lessons.map((item, itemIndex) =>
        itemIndex === index ? updated : item,
      ),
    };
    this.persist();
    return { ok: true };
  }

  toMarkdown(): string {
    const lines = [
      '# Cody “X” Vance — Partner Memory',
      '',
      '> Inspectable mission memory. These are recorded lessons, not model training or fine-tuning.',
      '',
    ];

    if (this.document.lessons.length === 0) {
      lines.push('No lessons recorded yet.', '');
      return lines.join('\n');
    }

    for (const lesson of this.document.lessons) {
      lines.push(
        `## Lesson ${lesson.id} — ${lesson.lesson}`,
        '',
        `- Run: \`${lesson.runId}\``,
        `- Section: \`${lesson.section}\``,
        `- Evidence: ${lesson.evidence} (event \`${lesson.evidenceEventId}\`)`,
        `- Consequence: ${lesson.consequence}`,
        `- Affected tactic: \`${lesson.affectedTactic}\``,
        `- Occurrences: ${lesson.occurrences}`,
      );
      for (const use of lesson.uses) {
        lines.push(`- Later use: \`${use.action}\` at event \`${use.eventId}\``);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  reset(): void {
    this.document = emptyDocument();
    this.options.storage.removeItem(STORAGE_KEY);
  }

  private persist(): void {
    this.options.storage.setItem(STORAGE_KEY, JSON.stringify(this.document));
  }
}
