import type { MissionStore, PartnerTactic } from '../game/MissionStore';
import type { MemoryRepository } from '../memory/MemoryRepository';
import type { PartnerCoordinator } from './PartnerCoordinator';
import { createPartnerBrief } from './partnerBrief';

type JsonSchema = Record<string, unknown>;

export interface WebMcpToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: Record<string, unknown>, options: { signal: AbortSignal }) => Promise<unknown>;
}

export interface WebMcpModelContext {
  registerTool(tool: WebMcpToolDefinition): Promise<void>;
}

interface ToolDependencies {
  store: MissionStore;
  memory: MemoryRepository;
  coordinator: PartnerCoordinator;
}

const tactics: PartnerTactic[] = ['ADVANCE', 'COVER', 'FLANK', 'RETREAT', 'PROTECT', 'HOLD'];

const stringProperty = (description: string, maxLength = 160) => ({
  type: 'string',
  description,
  maxLength,
});

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema => ({
  type: 'object',
  properties,
  ...(required.length > 0 ? { required } : {}),
  additionalProperties: false,
});

function asString(input: Record<string, unknown>, key: string): string {
  return typeof input[key] === 'string' ? input[key] : '';
}

function asStringArray(input: Record<string, unknown>, key: string): string[] {
  const value = input[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function hasSession(coordinator: PartnerCoordinator, sessionId: string): boolean {
  return coordinator.touchSession(sessionId);
}

export function createWebMcpTools({
  store,
  memory,
  coordinator,
}: ToolDependencies): WebMcpToolDefinition[] {
  return [
    {
      name: 'join_heist',
      description:
        'Join this visible HS: Heist page as the required agent partner. This unlocks the human start control and returns the page session id.',
      inputSchema: objectSchema({
        agentName: stringProperty('Short display name for the joining agent.', 48),
      }),
      execute: async (input) => coordinator.join(asString(input, 'agentName') || 'Codex'),
    },
    {
      name: 'get_mission_briefing',
      description:
        'Read the current heist pairing state, characters, controls, partnership rules, and continuous event-loop instructions without changing the mission.',
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true },
      execute: async () => createPartnerBrief(store.getSnapshot()),
    },
    {
      name: 'wait_for_mission_event',
      description:
        'Wait for the next sequenced heist event or a bounded heartbeat. Returns the live shared observation and does not change mission state.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          lastSequence: { type: 'integer', minimum: 0, description: 'Last processed event sequence.' },
          maxWaitMs: {
            type: 'integer',
            minimum: 25,
            maximum: 15_000,
            description: 'Maximum bounded wait in milliseconds.',
          },
        },
        ['sessionId', 'lastSequence', 'maxWaitMs'],
      ),
      annotations: { readOnlyHint: true },
      execute: async (input, options) =>
        coordinator.waitForEvent(
          {
            sessionId: asString(input, 'sessionId'),
            lastSequence: Number(input.lastSequence) || 0,
            maxWaitMs: Number(input.maxWaitMs) || 25,
          },
          options.signal,
        ),
    },
    {
      name: 'set_partner_tactic',
      description:
        'Change how the agent-controlled infiltrator moves and protects the human between required decisions, and publish the supplied radio line in the game.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          tactic: { type: 'string', enum: tactics },
          radioLine: stringProperty('Concise diegetic radio subtitle shown to the human.', 160),
          usedLessonIds: {
            type: 'array',
            maxItems: 5,
            uniqueItems: true,
            items: stringProperty('Partner-memory lesson id.', 80),
          },
        },
        ['sessionId', 'tactic', 'radioLine'],
      ),
      execute: async (input) =>
        coordinator.setTactic({
          sessionId: asString(input, 'sessionId'),
          tactic: asString(input, 'tactic') as PartnerTactic,
          radioLine: asString(input, 'radioLine'),
          usedLessonIds: asStringArray(input, 'usedLessonIds'),
        }),
    },
    {
      name: 'resolve_partner_decision',
      description:
        'Resolve the currently visible bomb, route, obstacle, or role decision. A stale decision id or unavailable action never changes mission state.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          decisionId: stringProperty('Exact active required-decision id.', 80),
          action: stringProperty('One action exactly as listed in the current observation.', 48),
          radioLine: stringProperty('Concise radio subtitle explaining the decision.', 160),
          usedLessonIds: {
            type: 'array',
            maxItems: 5,
            uniqueItems: true,
            items: stringProperty('Partner-memory lesson id.', 80),
          },
        },
        ['sessionId', 'decisionId', 'action', 'radioLine'],
      ),
      execute: async (input) =>
        coordinator.resolveDecision({
          sessionId: asString(input, 'sessionId'),
          decisionId: asString(input, 'decisionId'),
          action: asString(input, 'action'),
          radioLine: asString(input, 'radioLine'),
          usedLessonIds: asStringArray(input, 'usedLessonIds'),
        }),
    },
    {
      name: 'prioritize_pursuer',
      description:
        'Choose the agent shooter’s visible pursuer target or target priority during the getaway chase and show the supplied radio acknowledgement.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          targetId: stringProperty('Visible pursuer id or priority such as CLOSEST or HIGHEST_THREAT.', 80),
          radioLine: stringProperty('Concise radio subtitle shown to the human.', 160),
          usedLessonIds: {
            type: 'array',
            maxItems: 5,
            uniqueItems: true,
            items: stringProperty('Partner-memory lesson id.', 80),
          },
        },
        ['sessionId', 'targetId', 'radioLine'],
      ),
      execute: async (input) => {
        if (!hasSession(coordinator, asString(input, 'sessionId'))) {
          return { ok: false, reason: 'INVALID_SESSION' };
        }
        if (store.getSnapshot().section !== 'CHASE') {
          return { ok: false, reason: 'CHASE_NOT_ACTIVE' };
        }
        const targetId = coordinator.setTargetPriority(asString(input, 'targetId'));
        const event = coordinator.publish({
          type: 'AGENT_TARGET_PRIORITY',
          summary: `${targetId} — ${asString(input, 'radioLine').slice(0, 160)}`,
        });
        for (const lessonId of asStringArray(input, 'usedLessonIds')) {
          memory.markLessonUsed(lessonId, {
            eventId: `partner-event-${event.sequence}`,
            action: `PRIORITIZE:${asString(input, 'targetId')}`,
          });
        }
        return { ok: true, targetId };
      },
    },
    {
      name: 'send_radio_message',
      description:
        'Send one short agent-authored radio message into the game subtitle queue without changing the current tactic or resolving a decision.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          line: stringProperty('Short text rendered as untrusted plain-text subtitle.', 160),
          intent: { type: 'string', enum: ['ACK', 'WARN', 'REQUEST', 'PLAN'] },
        },
        ['sessionId', 'line', 'intent'],
      ),
      annotations: { untrustedContentHint: true },
      execute: async (input) => {
        if (!hasSession(coordinator, asString(input, 'sessionId'))) {
          return { ok: false, reason: 'INVALID_SESSION' };
        }
        const event = coordinator.publish({
          type: 'AGENT_RADIO',
          summary: `${asString(input, 'intent')}: ${asString(input, 'line').slice(0, 160)}`,
        });
        return { ok: true, sequence: event.sequence };
      },
    },
    {
      name: 'read_partner_memory',
      description:
        'Read structured local partner lessons and a deterministic Markdown artifact. This is inspectable memory, not model training or fine-tuning.',
      inputSchema: objectSchema({
        section: stringProperty('Optional exact mission-section filter.', 80),
        tactic: stringProperty('Optional exact affected-tactic filter.', 48),
        limit: { type: 'integer', minimum: 1, maximum: 20 },
      }),
      annotations: { readOnlyHint: true },
      execute: async (input) => {
        const section = asString(input, 'section').toUpperCase();
        const tactic = asString(input, 'tactic').toUpperCase();
        const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 20);
        const lessons = memory
          .getDocument()
          .lessons.filter((lesson) => !section || lesson.section.toUpperCase() === section)
          .filter((lesson) => !tactic || lesson.affectedTactic.toUpperCase() === tactic)
          .slice(-limit);
        return { version: 1, lessons, markdown: memory.toMarkdown() };
      },
    },
    {
      name: 'record_partner_lesson',
      description:
        'Record or deduplicate one concise local partner lesson only when its evidence id names a real consequential mission event.',
      inputSchema: objectSchema(
        {
          sessionId: stringProperty('Session id returned by join_heist.', 80),
          evidenceEventId: stringProperty('Consequential mission event id returned by the game.', 100),
          lesson: stringProperty('Concise reusable lesson grounded in that event.', 220),
          affectedTactic: stringProperty('Tactic or decision category this lesson should influence.', 48),
        },
        ['sessionId', 'evidenceEventId', 'lesson', 'affectedTactic'],
      ),
      execute: async (input) => {
        if (!hasSession(coordinator, asString(input, 'sessionId'))) {
          return { ok: false, reason: 'INVALID_SESSION' };
        }
        const result = memory.recordLesson({
          evidenceEventId: asString(input, 'evidenceEventId'),
          lesson: asString(input, 'lesson'),
          affectedTactic: asString(input, 'affectedTactic'),
        });
        if (result.ok) {
          coordinator.publish({
            type: 'MEMORY_UPDATED',
            summary: `${result.created ? 'Recorded' : 'Reinforced'} lesson ${result.lessonId}`,
          });
        }
        return result;
      },
    },
    {
      name: 'get_run_debrief',
      description:
        'Read the active run’s current outcome, character and vehicle state, failure cause, incidents, and all inspectable memory-use links.',
      inputSchema: objectSchema({}),
      annotations: { readOnlyHint: true },
      execute: async () => ({
        snapshot: store.getSnapshot(),
        memory: memory.getDocument(),
      }),
    },
  ];
}

export async function registerWebMcpTools(
  modelContext: WebMcpModelContext | null | undefined,
  dependencies: ToolDependencies,
): Promise<boolean> {
  if (!modelContext || typeof modelContext.registerTool !== 'function') return false;
  for (const tool of createWebMcpTools(dependencies)) {
    await modelContext.registerTool(tool);
  }
  return true;
}
