import { MissionStore } from '../../src/game/MissionStore';
import { MemoryRepository, type MemoryStorage } from '../../src/memory/MemoryRepository';
import { PartnerCoordinator } from '../../src/partner/PartnerCoordinator';
import {
  createWebMcpTools,
  registerWebMcpTools,
  type WebMcpToolDefinition,
} from '../../src/partner/webMcpTools';

function createStorage(): MemoryStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function createHarness() {
  const store = new MissionStore({ now: () => 1_000, createId: () => 'session-webmcp' });
  const memory = new MemoryRepository({
    storage: createStorage(),
    now: () => 1_000,
    createId: () => 'lesson-webmcp',
    getEvent: () => undefined,
  });
  const coordinator = new PartnerCoordinator({ store, memory, now: () => 1_000 });
  return { store, memory, coordinator };
}

describe('WebMCP tool definitions', () => {
  it('exposes the complete narrow top-level contract with explicit read/write annotations', () => {
    const tools = createWebMcpTools(createHarness());

    expect(tools.map((tool) => tool.name)).toEqual([
      'join_heist',
      'get_mission_briefing',
      'wait_for_mission_event',
      'set_partner_tactic',
      'resolve_partner_decision',
      'prioritize_pursuer',
      'send_radio_message',
      'read_partner_memory',
      'record_partner_lesson',
      'get_run_debrief',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.description.length).toBeGreaterThan(24);
    }
    expect(
      tools
        .filter((tool) => tool.annotations?.readOnlyHint)
        .map((tool) => tool.name),
    ).toEqual(['get_mission_briefing', 'wait_for_mission_event', 'read_partner_memory', 'get_run_debrief']);

    const schemas = new Map(
      tools.map((tool) => [
        tool.name,
        tool.inputSchema.properties as Record<string, unknown>,
      ]),
    );
    expect(schemas.get('set_partner_tactic')).not.toHaveProperty('targetId');
    expect(schemas.get('resolve_partner_decision')).not.toHaveProperty('targetId');
    expect(schemas.get('record_partner_lesson')).not.toHaveProperty('priorLessonId');
  });

  it('registers each imperative definition when document.modelContext is available', async () => {
    const registered: WebMcpToolDefinition[] = [];
    const modelContext = {
      registerTool: vi.fn(async (tool: WebMcpToolDefinition) => {
        registered.push(tool);
      }),
    };

    await expect(registerWebMcpTools(modelContext, createHarness())).resolves.toBe(true);
    expect(modelContext.registerTool).toHaveBeenCalledTimes(10);
    expect(registered[0]?.name).toBe('join_heist');
  });

  it('executes the real join, tactic, and abortable wait handlers', async () => {
    const { store, memory, coordinator } = createHarness();
    const tools = createWebMcpTools({ store, memory, coordinator });
    const byName = new Map(tools.map((tool) => [tool.name, tool]));
    const signal = new AbortController().signal;

    const joined = await byName.get('join_heist')!.execute({ agentName: 'Codex' }, { signal });
    expect(joined).toMatchObject({ status: 'PARTNER_ONLINE', sessionId: 'session-webmcp' });

    store.startMission();
    store.enterFacility();
    const tactic = await byName.get('set_partner_tactic')!.execute(
      {
        sessionId: 'session-webmcp',
        tactic: 'PROTECT',
        radioLine: 'Stay low. I will hold the lane.',
        usedLessonIds: [],
      },
      { signal },
    );
    expect(tactic).toEqual({ ok: true, tactic: 'PROTECT' });
    expect(store.getSnapshot().partnerTactic).toBe('PROTECT');

    const controller = new AbortController();
    const waiting = byName.get('wait_for_mission_event')!.execute(
      { sessionId: 'session-webmcp', lastSequence: 99, maxWaitMs: 5_000 },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('makes a chase target-priority tool call observable to the game controller', async () => {
    const { store, memory, coordinator } = createHarness();
    const byName = new Map(
      createWebMcpTools({ store, memory, coordinator }).map((tool) => [tool.name, tool]),
    );
    const signal = new AbortController().signal;
    await byName.get('join_heist')!.execute({ agentName: 'Codex' }, { signal });
    store.startMission();
    store.enterFacility();
    store.activateRoomOneCheckpoint();
    store.enterBombGate();
    store.startChargePlant();
    store.armCharge();
    store.detonateCharge(true);
    store.activateChaseCheckpoint();

    await expect(
      byName.get('prioritize_pursuer')!.execute(
        {
          sessionId: 'session-webmcp',
          targetId: 'CLOSEST',
          radioLine: 'Taking the closest shooter first.',
          usedLessonIds: [],
        },
        { signal },
      ),
    ).resolves.toEqual({ ok: true, targetId: 'CLOSEST' });
    expect(coordinator.getTargetPriority()).toBe('CLOSEST');
  });
});
