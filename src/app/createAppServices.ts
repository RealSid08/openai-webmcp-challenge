import { MissionStore, type MissionHistoryEvent } from '../game/MissionStore';
import { GameplayDirector } from '../game/GameplayDirector';
import { MemoryRepository, type MemoryEvent, type MemoryStorage } from '../memory/MemoryRepository';
import {
  CheckpointRepository,
  type CheckpointStorage,
} from '../persistence/CheckpointRepository';
import { PartnerCoordinator } from '../partner/PartnerCoordinator';

export interface AppStorage extends MemoryStorage, CheckpointStorage {}

interface CreateAppServicesOptions {
  storage: AppStorage;
  now?: () => number;
  createId?: () => string;
}

export interface AppServices {
  store: MissionStore;
  memory: MemoryRepository;
  checkpoints: CheckpointRepository;
  coordinator: PartnerCoordinator;
  director: GameplayDirector;
  destroy: () => void;
}

function toMemoryEvent(event: MissionHistoryEvent, runId: string | null, section: string | null): MemoryEvent {
  return {
    id: event.id,
    runId: runId ?? 'unstarted-run',
    section: section ?? 'PAIRING',
    type: event.type,
    summary: event.summary,
    consequence: event.consequential ? event.summary : 'No consequential outcome was recorded.',
    consequential: event.consequential,
  };
}

export function createAppServices(options: CreateAppServicesOptions): AppServices {
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const store = new MissionStore({ now, createId });
  const checkpoints = new CheckpointRepository({ storage: options.storage, now });
  const memory = new MemoryRepository({
    storage: options.storage,
    now,
    createId,
    getEvent: (eventId) => {
      const snapshot = store.getSnapshot();
      const event = snapshot.history.find((candidate) => candidate.id === eventId);
      return event ? toMemoryEvent(event, snapshot.runId, snapshot.section) : undefined;
    },
  });
  const coordinator = new PartnerCoordinator({ store, memory, now });
  const director = new GameplayDirector({ store, coordinator, createId });

  let lastHistoryId: string | null = null;
  let lastCheckpoint: string | null = null;
  const unsubscribe = store.subscribe(() => {
    const snapshot = store.getSnapshot();
    const newest = snapshot.history.at(-1);
    if (newest && newest.id !== lastHistoryId) {
      lastHistoryId = newest.id;
      coordinator.publish({
        type: newest.type,
        summary: newest.summary,
        evidenceEventId: newest.id,
      });
    }

    if (snapshot.phase === 'COMPLETE') {
      checkpoints.clear();
      lastCheckpoint = null;
      return;
    }

    const attemptEnded =
      newest &&
      (['CHARACTER_DOWN', 'VEHICLE_DESTROYED', 'AGENT_DECISION_TIMEOUT'].includes(newest.type) ||
        (newest.type === 'CRITICAL_INCIDENT' && snapshot.phase === 'FAILURE'));
    if (
      snapshot.checkpoint &&
      snapshot.runId &&
      (snapshot.checkpoint !== lastCheckpoint || attemptEnded)
    ) {
      lastCheckpoint = snapshot.checkpoint;
      checkpoints.save({
        checkpoint: snapshot.checkpoint,
        runId: snapshot.runId,
        promptsSeen: [],
        summary: {
          attempts: Math.max(
            1,
            snapshot.history.filter((event) =>
              ['FACILITY_ENTERED', 'REPLAY_STARTED', 'CHECKPOINT_RESTORED'].includes(event.type),
            ).length,
          ),
          failures: snapshot.history.filter(
            (event) =>
              ['CHARACTER_DOWN', 'VEHICLE_DESTROYED', 'AGENT_DECISION_TIMEOUT'].includes(
                event.type,
              ) || (event.type === 'CRITICAL_INCIDENT' && event.summary.includes('to 3.')),
          ).length,
        },
      });
    }
  });

  return {
    store,
    memory,
    checkpoints,
    coordinator,
    director,
    destroy: () => {
      unsubscribe();
      director.destroy();
    },
  };
}
