import { expect, test, type Page } from '@playwright/test';

interface RegisteredTool {
  name: string;
  execute: (
    input: Record<string, unknown>,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
}

interface HeistTestDriver {
  completeEncounter: () => unknown;
  finishChargePlant: () => unknown;
  detonateCharge: () => unknown;
  startChase: () => unknown;
  takeShooterSeat: () => unknown;
  destroyVehicle: () => unknown;
  completeMission: () => unknown;
  snapshot: () => {
    partner: { sessionId: string | null };
    requiredDecision: { id: string } | null;
    history: Array<{ id: string; type: string }>;
    characters: Record<'OWEN' | 'CODY', { health: number }>;
    section: 'FACILITY_ONE' | 'FACILITY_TWO' | 'BOMB_GATE' | 'CHASE' | null;
  };
}

async function installWebMcpHarness(
  page: Page,
  options: { pointerLock?: 'ACCEPT' | 'DENY' } = {},
) {
  await page.addInitScript(({ pointerLock }) => {
    const tools: RegisteredTool[] = [];
    let pointerLocked = false;
    Object.defineProperty(window, '__HS_WEBMCP_TOOLS__', { value: tools });
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      get: () => (pointerLocked ? document.querySelector('canvas') : null),
    });
    HTMLCanvasElement.prototype.requestPointerLock = function requestPointerLock() {
      if (pointerLock === 'DENY') {
        return Promise.reject(new DOMException('Pointer capture denied by test browser.', 'NotAllowedError'));
      }
      pointerLocked = true;
      document.dispatchEvent(new Event('pointerlockchange'));
      return Promise.resolve();
    };
    document.exitPointerLock = () => {
      pointerLocked = false;
      document.dispatchEvent(new Event('pointerlockchange'));
    };
    Object.defineProperty(document, 'modelContext', {
      value: {
        registerTool: async (tool: RegisteredTool) => {
          tools.push(tool);
        },
      },
      configurable: true,
    });
  }, { pointerLock: options.pointerLock ?? 'ACCEPT' });
}

async function executeTool(
  page: Page,
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return page.evaluate(
    async ({ toolName, toolInput }) => {
      const tool = (window as unknown as { __HS_WEBMCP_TOOLS__: RegisteredTool[] })
        .__HS_WEBMCP_TOOLS__.find((candidate) => candidate.name === toolName);
      if (!tool) throw new Error(`${toolName} did not register`);
      return (await tool.execute(toolInput, {
        signal: new AbortController().signal,
      })) as Record<string, unknown>;
    },
    { toolName: name, toolInput: input },
  );
}

async function captureEvidence(page: Page, state: string) {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
  ]) {
    await page.setViewportSize(viewport);
    await page.screenshot({
      path: `/tmp/hs-heist-${state}-${viewport.width}x${viewport.height}.png`,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test('pairs through the registered WebMCP tool and enters the live Babylon mission', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await installWebMcpHarness(page);

  await page.goto('/');
  await expect(page.getByText('WAITING FOR PARTNER')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start heist' })).toBeDisabled();
  await page.waitForTimeout(900);
  await captureEvidence(page, 'pairing');

  const names = await page.evaluate(() =>
    (window as unknown as { __HS_WEBMCP_TOOLS__: RegisteredTool[] }).__HS_WEBMCP_TOOLS__.map(
      (tool) => tool.name,
    ),
  );
  expect(names).toEqual([
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

  await page.evaluate(async () => {
    const tools = (window as unknown as { __HS_WEBMCP_TOOLS__: RegisteredTool[] })
      .__HS_WEBMCP_TOOLS__;
    const join = tools.find((tool) => tool.name === 'join_heist');
    if (!join) throw new Error('join_heist did not register');
    await join.execute({ agentName: 'Codex' }, { signal: new AbortController().signal });
  });

  await expect(page.getByText('PARTNER ONLINE')).toBeVisible();
  await page.getByRole('button', { name: 'Start heist' }).click();
  await expect(page.getByText('RealSid Games Presents')).toBeVisible();

  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible({ timeout: 6_000 });
  await page.getByRole('button', { name: 'Start the fight' }).click({ timeout: 10_000 });
  await expect(page.getByLabel('HS: Heist first-person game')).toBeVisible();
  await expect(page.getByLabel('Objective', { exact: true }).getByText('ESCAPE THE LOCKDOWN')).toBeVisible();
  await expect(page.getByText('Owen “Aye” Mercer')).toBeVisible();
  await expect(page.getByText('Cody “X” Vance')).toBeVisible();
  await expect(page.getByRole('button', { name: /TAKE CONTROL/ })).toBeVisible();

  await captureEvidence(page, 'facility');
  const canvas = page.getByLabel('HS: Heist first-person game');
  await canvas.click({ position: { x: 700, y: 450 } });
  await expect(page.getByRole('button', { name: /TAKE CONTROL/ })).toBeHidden();
  await canvas.click({ position: { x: 700, y: 450 } });
  await expect(page.getByLabel('Loadout and vehicle')).toContainText('17/72');
  await page.keyboard.down('Shift');
  await page.keyboard.press('w');
  await page.keyboard.up('Shift');
  await page.keyboard.down('Control');
  await page.keyboard.press('d');
  await page.keyboard.up('Control');
  await canvas.click({ button: 'right', position: { x: 700, y: 450 } });
  await page.keyboard.press('q');
  await expect(page.getByRole('status', { name: 'Perspective switching' })).toBeVisible();
  await expect(page.getByText('Taking control of Cody “X” Vance')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Perspective switching' })).toBeHidden({
    timeout: 3_000,
  });
  expect(errors).toEqual([]);
});

test('keeps the live encounter running when the browser denies mouse capture', async ({ page }) => {
  await installWebMcpHarness(page, { pointerLock: 'DENY' });
  await page.goto('/');
  await executeTool(page, 'join_heist', { agentName: 'Codex' });
  await page.getByRole('button', { name: 'Start heist' }).click();
  await page.getByRole('button', { name: 'Start the fight' }).click({ timeout: 10_000 });

  await page.getByRole('button', { name: /TAKE CONTROL/ }).click();
  await expect(page.getByText('MOUSE CAPTURE DENIED')).toBeVisible();

  await page.keyboard.down('t');
  await page.waitForTimeout(1_000);
  await page.keyboard.up('t');
  await page.keyboard.down('d');
  await page.waitForTimeout(900);
  await page.keyboard.up('d');
  await page.keyboard.down('w');
  await page.waitForTimeout(1_200);
  await page.keyboard.up('w');

  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const snapshot = (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver })
            .__HS_TEST_DRIVER__.snapshot();
          return snapshot.section === 'FACILITY_TWO' ||
            snapshot.history.some((event) => event.type === 'CHECKPOINT_REACHED');
        }),
      { timeout: 8_000, message: 'the live encounter should clear without pointer lock' },
    )
    .toBe(true);
});

test('keeps pause, controls, and memory usable over the live scene', async ({ page }) => {
  await installWebMcpHarness(page);
  await page.goto('/');
  await page.evaluate(async () => {
    const join = (window as unknown as { __HS_WEBMCP_TOOLS__: RegisteredTool[] })
      .__HS_WEBMCP_TOOLS__.find((tool) => tool.name === 'join_heist');
    if (!join) throw new Error('join_heist did not register');
    await join.execute({ agentName: 'Codex' }, { signal: new AbortController().signal });
  });
  await page.getByRole('button', { name: 'Start heist' }).click();
  await page.getByRole('button', { name: 'Start the fight' }).click({ timeout: 10_000 });

  await page.keyboard.press('m');
  const memory = page.getByRole('dialog', { name: 'Partner memory' });
  await expect(memory).toBeVisible();
  await expect(memory.getByText(/not model training or fine-tuning/i)).toBeVisible();
  await memory.getByRole('button', { name: 'Close' }).click();

  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Paused' });
  await expect(pause).toBeVisible();
  await pause.getByRole('button', { name: 'Controls' }).click();
  await expect(page.getByRole('dialog', { name: 'Controls' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await pause.getByRole('button', { name: 'Resume' }).click();
  await expect(pause).toBeHidden();
});

test('proves the bomb, chase, failure, memory, adaptation, and debrief loop', async ({ page }) => {
  await installWebMcpHarness(page);
  await page.goto('/');
  const joined = await executeTool(page, 'join_heist', { agentName: 'Codex' });
  const sessionId = joined.sessionId as string;
  await page.getByRole('button', { name: 'Start heist' }).click();
  await page.getByRole('button', { name: 'Start the fight' }).click({ timeout: 10_000 });

  await page.evaluate(() => {
    const driver = (window as unknown as { __HS_TEST_DRIVER__?: HeistTestDriver })
      .__HS_TEST_DRIVER__;
    if (!driver) throw new Error('test driver unavailable');
    driver.completeEncounter();
    driver.completeEncounter();
  });
  await expect(page.getByLabel('Objective', { exact: true }).getByText('PLANT THE CHARGE')).toBeVisible();
  await captureEvidence(page, 'bomb-gate');

  let snapshot = await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.snapshot(),
  );
  await executeTool(page, 'resolve_partner_decision', {
    sessionId,
    decisionId: snapshot.requiredDecision?.id,
    action: 'PLANT',
    radioLine: 'Moving to the gate. Keep the stairwell off me.',
    usedLessonIds: [],
  });
  await expect(page.getByText(/Moving to the gate/i)).toBeVisible();

  await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.finishChargePlant(),
  );
  snapshot = await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.snapshot(),
  );
  await executeTool(page, 'resolve_partner_decision', {
    sessionId,
    decisionId: snapshot.requiredDecision?.id,
    action: 'RETREAT',
    radioLine: 'Charge armed. Falling back to the safe mark.',
    usedLessonIds: [],
  });
  await page.evaluate(() => {
    const driver = (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver })
      .__HS_TEST_DRIVER__;
    driver.detonateCharge();
    driver.startChase();
  });
  await expect(page.getByLabel('Objective', { exact: true }).getByText('ESCAPE THE PURSUIT')).toBeVisible();
  await expect(page.getByText('Getaway car')).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.takeShooterSeat(),
  );
  await expect(page.getByLabel('Infiltrator status')).toContainText('Cody “X” VanceYou');
  await captureEvidence(page, 'chase');

  await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.destroyVehicle(),
  );
  await expect(page.getByText('Vehicle destroyed')).toBeVisible();
  await captureEvidence(page, 'failure');
  snapshot = await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.snapshot(),
  );
  const failureEvent = snapshot.history.findLast((event) => event.type === 'VEHICLE_DESTROYED');
  expect(failureEvent).toBeTruthy();
  const lessonResult = await executeTool(page, 'record_partner_lesson', {
    sessionId,
    evidenceEventId: failureEvent?.id,
    lesson: 'Prioritize the closest pursuer before it can sustain fire on the car.',
    affectedTactic: 'CHASE_TARGETING',
  });
  expect(lessonResult.ok).toBe(true);
  const lessonId = lessonResult.lessonId as string;

  await expect(page.getByText('Vehicle destroyed')).toBeHidden({ timeout: 4_000 });
  await expect(page.getByLabel('Objective', { exact: true }).getByText('ESCAPE THE PURSUIT')).toBeVisible();
  await executeTool(page, 'prioritize_pursuer', {
    sessionId,
    targetId: 'CLOSEST',
    radioLine: 'Remembered the last car loss. Taking the closest shooter first.',
    usedLessonIds: [lessonId],
  });
  await expect(page.getByText(/Remembered the last car loss/i)).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { __HS_TEST_DRIVER__: HeistTestDriver }).__HS_TEST_DRIVER__.completeMission(),
  );

  await expect(page.getByText('HEIST COMPLETE')).toBeVisible();
  await expect(
    page.getByText('Prioritize the closest pursuer before it can sustain fire on the car.', {
      exact: true,
    }).first(),
  ).toBeVisible();
  await expect(page.getByText('CHASE_TARGETING').first()).toBeVisible();
  await captureEvidence(page, 'debrief');
});
