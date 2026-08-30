import type { MissionStore, PartnerTactic } from '../game/MissionStore';
import type { MemoryRepository } from '../memory/MemoryRepository';
import { createPartnerBrief } from './partnerBrief';

interface PartnerCoordinatorOptions {
  store: MissionStore;
  memory: MemoryRepository;
  now: () => number;
}

export interface PartnerEvent {
  sequence: number;
  type: string;
  summary: string;
  timestamp: number;
  evidenceEventId?: string;
}

interface PendingWait {
  lastSequence: number;
  finish: (event: PartnerEvent | null) => void;
}

const PARTNER_LEASE_MS = 30_000;

export interface ResolvedPartnerDecision {
  decisionId: string;
  kind: string;
  action: string;
}

export class PartnerCoordinator {
  private sequence = 0;
  private targetPriority = 'CLOSEST';
  private readonly events: PartnerEvent[] = [];
  private readonly pending = new Set<PendingWait>();
  private readonly eventListeners = new Set<(event: PartnerEvent) => void>();
  private readonly decisionListeners = new Set<(decision: ResolvedPartnerDecision) => void>();
  private lastPartnerSeenAt: number | null = null;

  constructor(private readonly options: PartnerCoordinatorOptions) {}

  join(name: string) {
    const joined = this.options.store.joinPartner(name.trim() || 'Codex');
    this.lastPartnerSeenAt = this.options.now();
    const briefing = createPartnerBrief(this.options.store.getSnapshot());
    return {
      ok: true as const,
      status: 'PARTNER_ONLINE' as const,
      sessionId: joined.sessionId,
      alreadyJoined: joined.alreadyJoined,
      ...briefing,
    };
  }

  touchSession(sessionId: string): boolean {
    const partner = this.options.store.getSnapshot().partner;
    if (!sessionId || !partner.online || partner.sessionId !== sessionId) return false;
    this.lastPartnerSeenAt = this.options.now();
    return true;
  }

  tickPresence(): void {
    const sessionId = this.options.store.getSnapshot().partner.sessionId;
    if (!sessionId || this.lastPartnerSeenAt === null) return;
    if (this.options.now() - this.lastPartnerSeenAt <= PARTNER_LEASE_MS) return;
    this.disconnectSession(sessionId);
  }

  publish(input: { type: string; summary: string; evidenceEventId?: string }): PartnerEvent {
    const event: PartnerEvent = {
      sequence: ++this.sequence,
      type: input.type,
      summary: input.summary,
      timestamp: this.options.now(),
      ...(input.evidenceEventId ? { evidenceEventId: input.evidenceEventId } : {}),
    };
    this.events.push(event);
    if (this.events.length > 100) this.events.shift();

    for (const waiter of this.pending) {
      if (event.sequence > waiter.lastSequence) waiter.finish(event);
    }
    for (const listener of this.eventListeners) listener(event);
    return event;
  }

  getEvents(): PartnerEvent[] {
    return structuredClone(this.events);
  }

  setTargetPriority(targetId: string): string {
    this.targetPriority = targetId.trim().toUpperCase().slice(0, 80) || 'CLOSEST';
    return this.targetPriority;
  }

  getTargetPriority(): string {
    return this.targetPriority;
  }

  onEvent(listener: (event: PartnerEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onDecisionResolved(listener: (decision: ResolvedPartnerDecision) => void): () => void {
    this.decisionListeners.add(listener);
    return () => this.decisionListeners.delete(listener);
  }

  resolveDecision(input: {
    sessionId: string;
    decisionId: string;
    action: string;
    radioLine: string;
    usedLessonIds: string[];
  }):
    | { ok: true }
    | {
        ok: false;
        reason: 'INVALID_SESSION' | 'STALE_DECISION' | 'ACTION_NOT_AVAILABLE' | 'DECISION_EXPIRED';
      } {
    const snapshot = this.options.store.getSnapshot();
    if (!this.touchSession(input.sessionId)) {
      return { ok: false, reason: 'INVALID_SESSION' };
    }
    const decision = snapshot.requiredDecision;
    const result = this.options.store.resolveRequiredDecision(input.decisionId, input.action);
    if (!result.ok || !decision) return result;

    const event = this.publish({
      type: 'AGENT_DECISION',
      summary: `${input.action} — ${input.radioLine.trim().slice(0, 160)}`,
    });
    for (const lessonId of input.usedLessonIds) {
      this.options.memory.markLessonUsed(lessonId, {
        eventId: `partner-event-${event.sequence}`,
        action: input.action,
      });
    }
    const resolved = {
      decisionId: input.decisionId,
      kind: decision.kind,
      action: input.action,
    };
    for (const listener of this.decisionListeners) listener(resolved);
    return { ok: true };
  }

  setTactic(input: {
    sessionId: string;
    tactic: PartnerTactic;
    radioLine: string;
    usedLessonIds: string[];
  }):
    | { ok: true; tactic: PartnerTactic }
    | { ok: false; reason: 'INVALID_SESSION' | 'TACTIC_NOT_AVAILABLE' } {
    if (!this.touchSession(input.sessionId)) {
      return { ok: false, reason: 'INVALID_SESSION' };
    }

    const changed = this.options.store.setPartnerTactic(input.tactic);
    if (!changed.ok) return { ok: false, reason: 'TACTIC_NOT_AVAILABLE' };
    const event = this.publish({
      type: 'AGENT_TACTIC',
      summary: `${input.tactic} — ${input.radioLine.trim().slice(0, 160)}`,
    });
    for (const lessonId of input.usedLessonIds) {
      this.options.memory.markLessonUsed(lessonId, {
        eventId: `partner-event-${event.sequence}`,
        action: input.tactic,
      });
    }
    return { ok: true, tactic: input.tactic };
  }

  async waitForEvent(
    input: { sessionId: string; lastSequence: number; maxWaitMs: number },
    signal: AbortSignal,
  ): Promise<
    | { ok: false; reason: 'INVALID_SESSION' }
    | {
        ok: true;
        sequence: number;
        event: PartnerEvent | null;
        heartbeat: boolean;
        observation: ReturnType<PartnerCoordinator['createObservation']>;
      }
  > {
    if (!this.touchSession(input.sessionId)) {
      return { ok: false, reason: 'INVALID_SESSION' };
    }

    const available = this.events.find((event) => event.sequence > input.lastSequence);
    if (available) return this.eventResponse(available);

    return new Promise((resolve, reject) => {
      const waitMs = Math.min(Math.max(input.maxWaitMs, 25), 15_000);
      const waiter: PendingWait = {
        lastSequence: input.lastSequence,
        finish: (event) => {
          cleanup();
          this.touchSession(input.sessionId);
          resolve(this.eventResponse(event));
        },
      };
      const timeout = window.setTimeout(() => waiter.finish(null), waitMs);
      const onAbort = () => {
        cleanup();
        this.disconnectSession(input.sessionId);
        reject(new DOMException('Tool execution was cancelled.', 'AbortError'));
      };
      const cleanup = () => {
        window.clearTimeout(timeout);
        signal.removeEventListener('abort', onAbort);
        this.pending.delete(waiter);
      };

      this.pending.add(waiter);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  private eventResponse(event: PartnerEvent | null) {
    return {
      ok: true as const,
      sequence: event?.sequence ?? this.sequence,
      event,
      heartbeat: event === null,
      observation: this.createObservation(),
    };
  }

  private disconnectSession(sessionId: string): void {
    if (!this.options.store.disconnectPartner(sessionId).ok) return;
    this.lastPartnerSeenAt = null;
  }

  private createObservation() {
    const snapshot = this.options.store.getSnapshot();
    const partnerCharacter = snapshot.humanCharacter === 'OWEN' ? 'CODY' : 'OWEN';
    return {
      phase: snapshot.phase,
      section: snapshot.section,
      checkpoint: snapshot.checkpoint,
      objective: snapshot.objective,
      humanCharacter: snapshot.humanCharacter,
      partnerCharacter,
      characters: snapshot.characters,
      vehicle: snapshot.vehicle,
      criticalIncidents: snapshot.criticalIncidents,
      partnerTactic: snapshot.partnerTactic,
      requiredDecision: snapshot.requiredDecision,
      switching: snapshot.switching,
      relevantLessons: this.options.memory.getDocument().lessons.slice(-5),
    };
  }
}
