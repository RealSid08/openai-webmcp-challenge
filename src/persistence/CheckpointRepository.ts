import type { CheckpointId } from '../game/MissionStore';

const STORAGE_KEY = 'hs-heist.checkpoint.v1';
const CHECKPOINTS = new Set<CheckpointId>([
  'FACILITY_START',
  'ROOM_ONE_CLEAR',
  'CHASE_START',
]);
const DOCUMENT_KEYS = new Set([
  'version',
  'checkpoint',
  'runId',
  'savedAt',
  'promptsSeen',
  'summary',
]);

export interface CheckpointStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CheckpointDocument {
  version: 1;
  checkpoint: CheckpointId;
  runId: string;
  savedAt: number;
  promptsSeen: string[];
  summary: { attempts: number; failures: number };
}

interface CheckpointRepositoryOptions {
  storage: CheckpointStorage;
  now: () => number;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isCheckpointDocument(value: unknown): value is CheckpointDocument {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !DOCUMENT_KEYS.has(key))) return false;
  if (record.version !== 1 || typeof record.checkpoint !== 'string') return false;
  if (!CHECKPOINTS.has(record.checkpoint as CheckpointId)) return false;
  if (typeof record.runId !== 'string' || record.runId.length === 0 || record.runId.length > 100) {
    return false;
  }
  if (typeof record.savedAt !== 'number' || !Number.isFinite(record.savedAt)) return false;
  if (
    !Array.isArray(record.promptsSeen) ||
    record.promptsSeen.length > 24 ||
    !record.promptsSeen.every((item) => typeof item === 'string' && item.length <= 80)
  ) {
    return false;
  }
  if (!record.summary || typeof record.summary !== 'object' || Array.isArray(record.summary)) {
    return false;
  }
  const summary = record.summary as Record<string, unknown>;
  return (
    Object.keys(summary).length === 2 &&
    isNonNegativeInteger(summary.attempts) &&
    isNonNegativeInteger(summary.failures)
  );
}

export class CheckpointRepository {
  constructor(private readonly options: CheckpointRepositoryOptions) {}

  load(): CheckpointDocument | null {
    const raw = this.options.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isCheckpointDocument(parsed) ? structuredClone(parsed) : null;
    } catch {
      return null;
    }
  }

  save(
    input: Omit<CheckpointDocument, 'version' | 'savedAt'>,
  ): CheckpointDocument {
    const document: CheckpointDocument = {
      version: 1,
      checkpoint: input.checkpoint,
      runId: input.runId,
      savedAt: this.options.now(),
      promptsSeen: [...new Set(input.promptsSeen)].slice(0, 24),
      summary: { ...input.summary },
    };
    this.options.storage.setItem(STORAGE_KEY, JSON.stringify(document));
    return structuredClone(document);
  }

  clear(): void {
    this.options.storage.removeItem(STORAGE_KEY);
  }
}
