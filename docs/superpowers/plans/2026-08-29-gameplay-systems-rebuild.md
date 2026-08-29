# HS: Heist Gameplay Systems Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing HS: Heist vertical slice into a reliable first-person co-op mission with real enemy combat, grounded keyboard/controller input, navigation, first-person weapon presentation, adaptive audio, and a direct agent operating brief.

**Architecture:** Keep `MissionStore` authoritative and reduce `BabylonGameRuntime` to lifecycle/orchestration. New input, pointer lock, movement, enemy, viewmodel, minimap, audio, and partner-brief modules expose small typed interfaces and are covered with pure tests before Babylon/React integration.

**Tech Stack:** React 19, TypeScript 7, Babylon.js 9.23, Vite 8, WebMCP imperative tools, Web Audio API, localStorage, Vitest 4, Testing Library, Playwright 1.62, Oxlint.

**Spec:** `docs/superpowers/specs/2026-08-29-gameplay-systems-rebuild-design.md`

## Global Constraints

- Keep the existing single facility/bomb/chase mission and approximately 8–10 minute successful run.
- Keep the production requirement for a real WebMCP partner; do not add a solo bot or an agent-accessible start action.
- Keep TypeScript 7 and Oxlint; do not add TypeScript-ESLint.
- Keep Babylon.js; do not migrate engines.
- Sprint starts enabled and Shift/L3 toggles walk versus sprint.
- The minimap, both-character health, vehicle health, subtitles, first-person hands/weapon, controller support, and adaptive audio are required.
- Gamepad aim assist never applies to mouse input, sees through cover, snaps across large angles, or fires automatically.
- Simulation must never depend on pointer-lock success.
- All art, music, sound, names, UI, and motion remain original.
- Use raw Cursor CLI only for the bounded visual-polish pass after behavior works.
- Automated tests do not replace physical pointer-lock, controller, audio, difficulty, and real-WebMCP verification.

## File map

### Create

- `src/game/input/InputManager.ts` — normalized keyboard, mouse, and gamepad frame state.
- `src/game/input/inputBindings.ts` — Xbox/PlayStation/keyboard bindings and prompt labels.
- `src/game/input/PointerLockController.ts` — pointer-lock lifecycle and drag-to-look fallback.
- `src/game/input/aimAssist.ts` — pure controller target scoring and correction.
- `src/game/systems/PlayerMotor.ts` — grounded acceleration, stance, bob, and footstep cadence.
- `src/game/systems/EnemyDirector.ts` — pure enemy perception/tactical state transitions.
- `src/game/systems/EnemyCombatRuntime.ts` — Babylon movement, cover, line-of-sight, and shot presentation.
- `src/game/presentation/FirstPersonViewModel.ts` — hands, gun, animation, recoil, and muzzle presentation.
- `src/game/presentation/minimapModel.ts` — pure facility/chase minimap projection.
- `src/components/TacticalMinimap.tsx` — semantic lower-left minimap surface.
- `src/audio/AdaptiveAudioDirector.ts` — effects buses, music layers, ducking, and disposal.
- `src/partner/partnerBrief.ts` — canonical agent operating contract shared by DOM and tools.
- `src/components/AgentPartnerBrief.tsx` — agent-readable page content.
- `src/tutorial/TutorialDirector.ts` — input-aware skippable opening teaching state.
- focused unit tests mirroring each pure module.

### Modify

- `src/game/BabylonGameRuntime.ts` — remove system internals and compose the new modules.
- `src/game/RuntimeVisualFactory.ts` — weapon anchors, enemy weapon/muzzle nodes, and cover metadata.
- `src/game/worldLayout.ts` — starting barricades, cover nodes, navigation route, and minimap geometry.
- `src/game/MissionStore.ts` — typed combat source metadata and tutorial/checkpoint reset rules.
- `src/game/GameplayDirector.ts` — expose required chase/bomb decisions to new runtime controllers.
- `src/audio/ProceduralAudio.ts` — preserve cue-plan compatibility while delegating runtime playback.
- `src/partner/PartnerCoordinator.ts` and `src/partner/webMcpTools.ts` — partner brief, pre-game radio, and exact next-action output.
- `src/app/GameCanvas.tsx` — focusable canvas and pointer-lock status/action surface.
- `src/components/PairingScreen.tsx`, `ControlsOverlay.tsx`, and `Hud.tsx` — hardware guidance, input-aware controls, pre-game subtitles, tutorial, minimap, damage direction, and vehicle placement.
- `src/App.tsx` — new status model, tutorial orchestration, pairing radio, minimap snapshot, and audio settings.
- `src/styles/*.css` — required layouts and state feedback.
- existing unit/component/E2E tests, `README.md`, and `docs/hackathon-build/build-notes.md`.

---

### Task 1: Decouple simulation from pointer lock and expose honest capture state

**Files:**
- Create: `src/game/input/PointerLockController.ts`
- Test: `tests/unit/PointerLockController.test.ts`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/app/GameCanvas.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/game-canvas.css`
- Test: `tests/e2e/heist.spec.ts`

**Interfaces:**
- Produces: `PointerLockState`, `PointerLockSnapshot`, and `PointerLockController` with `request()`, `release()`, `setDragActive()`, `consumeDragDelta()`, `subscribe()`, and `dispose()`.
- Produces: `GameRuntimeStatus.pointerLock: PointerLockSnapshot` while retaining `pointerLocked` temporarily only if an existing test requires the compatibility field during migration.
- Consumes: an `HTMLCanvasElement`, `Document`, and injected clock-free browser events.

- [ ] **Step 1: Write failing pointer-lock lifecycle tests**

```ts
it('reports denial and keeps drag fallback available', async () => {
  const canvas = createCanvasThatRejects(new DOMException('denied', 'NotAllowedError'));
  const lock = new PointerLockController(canvas, document);
  await lock.request();
  expect(lock.getSnapshot()).toMatchObject({ state: 'DENIED', canRetry: true, dragFallback: true });
});

it('accumulates drag movement only while fallback is active', () => {
  const lock = new PointerLockController(document.createElement('canvas'), document);
  lock.setDragActive(true);
  lock.handlePointerMove({ movementX: 8, movementY: -3 } as PointerEvent);
  expect(lock.consumeDragDelta()).toEqual({ x: 8, y: -3 });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/PointerLockController.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pointer-lock state machine**

```ts
export type PointerLockState = 'IDLE' | 'REQUESTING' | 'LOCKED' | 'RELEASED' | 'DENIED' | 'UNAVAILABLE';

export interface PointerLockSnapshot {
  state: PointerLockState;
  canRetry: boolean;
  dragFallback: boolean;
  message: string | null;
}

export class PointerLockController {
  constructor(private readonly canvas: HTMLCanvasElement, private readonly owner: Document) {}
  getSnapshot(): PointerLockSnapshot;
  request(): Promise<PointerLockSnapshot>;
  release(): void;
  setDragActive(active: boolean): void;
  handlePointerMove(event: Pick<PointerEvent, 'movementX' | 'movementY'>): void;
  consumeDragDelta(): { x: number; y: number };
  subscribe(listener: (snapshot: PointerLockSnapshot) => void): () => void;
  dispose(): void;
}
```

The request catches returned promise rejection and also handles `pointerlockerror`. The canvas is focused before the request. `dispose()` removes every document/canvas listener.

- [ ] **Step 4: Remove simulation gating from `BabylonGameRuntime.frame()`**

Always call facility/chase simulation while `phase === 'MISSION' && !paused`; only choose look deltas based on locked/fallback/controller state. Delete `hasTakenControl` and every conditional that uses it to advance gameplay.

- [ ] **Step 5: Add a focusable canvas and actionable control overlay**

Set `tabIndex={0}` on the canvas. Render `CLICK TO TAKE CONTROL`, `MOUSE CAPTURE DENIED — TRY AGAIN`, or `CONTROLLER ACTIVE` from runtime status. The retry button must invoke `request()` directly from its click handler.

- [ ] **Step 6: Prove denial no longer freezes simulation**

Add an E2E case that leaves the native request unshimmed, expects a denial/fallback state where the browser rejects it, waits for an enemy status change, and confirms the encounter remains active. Keep the existing shim only in the locked-input scenario.

- [ ] **Step 7: Run verification and commit**

Run: `npm test -- tests/unit/PointerLockController.test.ts && npm run typecheck && npm run test:e2e -- --grep "pointer"`
Expected: PASS.

Commit: `git commit -am "Fix pointer lock without freezing gameplay"` after adding the new files.

### Task 2: Normalize keyboard, mouse, and Xbox/PlayStation input

**Files:**
- Create: `src/game/input/inputBindings.ts`
- Create: `src/game/input/InputManager.ts`
- Test: `tests/unit/InputManager.test.ts`
- Modify: `src/components/ControlsOverlay.tsx`
- Modify: `src/components/PairingScreen.tsx`
- Modify: `src/styles/pairing.css`
- Modify: `src/styles/mission-overlays.css`

**Interfaces:**
- Produces: `InputDevice = 'KEYBOARD_MOUSE' | 'XBOX' | 'PLAYSTATION' | 'GENERIC_GAMEPAD'`.
- Produces: `InputFrame` with movement/look vectors, analog aim/fire, button edges, sprint state, and active device.
- Produces: `getControlGroups(device: InputDevice): readonly ControlGroup[]` for pairing, tutorial, HUD, and pause.
- Consumes: `PointerLockController.consumeDragDelta()` from Task 1.

- [ ] **Step 1: Write failing mapping and sprint-toggle tests**

```ts
it('starts sprinting and toggles to walk on one Shift edge', () => {
  const input = createInputHarness();
  expect(input.poll().sprinting).toBe(true);
  input.keyDown('ShiftLeft');
  expect(input.poll().sprinting).toBe(false);
  expect(input.poll().sprinting).toBe(false);
  input.keyUp('ShiftLeft');
  input.keyDown('ShiftLeft');
  expect(input.poll().sprinting).toBe(true);
});

it('maps a standard PlayStation-like pad to FPS actions', () => {
  const frame = sampleGamepad(playStationPad({ axes: [0.4, -1, 0.5, -0.25], l2: 1, r2: 1 }));
  expect(frame.device).toBe('PLAYSTATION');
  expect(frame.aim).toBe(1);
  expect(frame.fire).toBe(1);
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- tests/unit/InputManager.test.ts`
Expected: FAIL because the input modules do not exist.

- [ ] **Step 3: Implement normalized input types and device detection**

```ts
export interface InputFrame {
  device: InputDevice;
  move: { x: number; y: number };
  look: { x: number; y: number };
  aim: number;
  fire: number;
  reloadPressed: boolean;
  interactPressed: boolean;
  switchPressed: boolean;
  calloutPressed: boolean;
  pausePressed: boolean;
  sprinting: boolean;
}
```

Apply radial stick dead zones and response curves. Detect PlayStation from gamepad ids containing `playstation`, `dualsense`, `dualshock`, or Sony vendor ids; detect Xbox from `xbox`, `xinput`, or Microsoft vendor ids; otherwise use neutral gamepad labels.

- [ ] **Step 4: Implement edge-triggered actions and hot device switching**

Polling must not repeat reload/switch/callout/pause while held. Any meaningful gamepad stick/button input makes it active; keyboard/mouse movement immediately takes it back. A disconnected pad emits a one-shot status and falls back without pausing.

- [ ] **Step 5: Replace static control copy with device-aware groups**

Generate the exact keyboard, Xbox, and PlayStation labels from `getControlGroups`. Pairing/footer copy becomes `BEST EXPERIENCED WITH A CONTROLLER OR EXTERNAL MOUSE`; trackpad remains supported but is not called ideal.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/InputManager.test.ts tests/component/App.test.tsx && npm run typecheck`
Expected: PASS with controller glyph text queryable by accessible labels.

Commit: `git commit -am "Add keyboard and controller input routing"` after adding the new files.

### Task 3: Add grounded movement and controller-only aim assistance

**Files:**
- Create: `src/game/systems/PlayerMotor.ts`
- Create: `src/game/input/aimAssist.ts`
- Test: `tests/unit/PlayerMotor.test.ts`
- Test: `tests/unit/aimAssist.test.ts`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/game/runtimeLogic.ts`

**Interfaces:**
- Produces: `PlayerMotor.update(input, state, dt): PlayerMotorResult` with velocity, position delta, camera offsets, and step events.
- Produces: `chooseAimAssistTarget(candidates, context)` and `computeAimAssistCorrection(target, context)`.
- Consumes: `InputFrame` from Task 2 and Babylon collision resolution in the runtime adapter.

- [ ] **Step 1: Write failing motion tests**

```ts
it('accelerates, brakes firmly, and uses sprint as the initial stance', () => {
  let state = createMotorState();
  state = updateMotor(state, { move: { x: 0, y: 1 }, sprinting: true }, 0.1).state;
  expect(state.speed).toBeGreaterThan(0);
  expect(state.speed).toBeLessThanOrEqual(6.2);
  const braking = updateMotor(state, { move: { x: 0, y: 0 }, sprinting: true }, 0.1).state;
  expect(braking.speed).toBeLessThan(state.speed);
});

it('emits footsteps from distance cadence rather than render frames', () => {
  const result = runMotorForDistance(8, { sprinting: true, frameRate: 47 });
  expect(result.steps).toBeGreaterThanOrEqual(6);
  expect(result.steps).toBeLessThanOrEqual(10);
});
```

- [ ] **Step 2: Write failing aim-assist tests**

```ts
it('rejects occluded and out-of-cone targets', () => {
  const target = chooseAimAssistTarget(candidates, { inputDevice: 'XBOX', coneRadians: 0.09 });
  expect(target?.id).toBe('visible-near-reticle');
});

it('returns zero correction for mouse input', () => {
  expect(computeAimAssistCorrection(target, { inputDevice: 'KEYBOARD_MOUSE', aiming: true })).toEqual({ yaw: 0, pitch: 0 });
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/PlayerMotor.test.ts tests/unit/aimAssist.test.ts`
Expected: FAIL because both modules are missing.

- [ ] **Step 4: Implement motor constants and update function**

Use explicit walk/sprint top speeds, acceleration, ground braking, reverse braking, gravity, bob phase, restrained lean, and step spacing. Keep the pure motor independent of Babylon vectors.

- [ ] **Step 5: Implement deterministic aim-assist scoring**

Candidate inputs include id, angular error, distance, alive, visible, and world direction. Score only visible living targets inside the configured cone. Clamp slowdown and rotational correction per second and make ADS slightly stronger than hip fire.

- [ ] **Step 6: Wire movement to Babylon without `UniversalCamera.speed` or inertia**

Use the motor's requested world delta with collision-aware camera/character movement. Drive view bob and FOV from motor output. Apply aim correction only when `InputFrame.device !== 'KEYBOARD_MOUSE'`.

- [ ] **Step 7: Run verification and commit**

Run: `npm test -- tests/unit/PlayerMotor.test.ts tests/unit/aimAssist.test.ts tests/unit/runtimeLogic.test.ts && npm run typecheck`
Expected: PASS.

Commit: `git commit -am "Rebuild player movement and controller aim assist"` after adding the new files.

### Task 4: Build the opening cover layout and skippable interactive tutorial

**Files:**
- Modify: `src/game/worldLayout.ts`
- Modify: `src/game/RuntimeVisualFactory.ts`
- Create: `src/tutorial/TutorialDirector.ts`
- Test: `tests/unit/TutorialDirector.test.ts`
- Test: `tests/unit/worldLayout.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Hud.tsx`

**Interfaces:**
- Produces: `FACILITY_LAYOUT.startingCover`, `navigationPath`, and cover metadata used by enemies and minimap.
- Produces: `TutorialDirector.record(event)`, `skip()`, and `getSnapshot()`.
- Consumes: normalized action events `MOVED`, `AIMED`, `HIT_ENEMY`, `CALLOUT_SENT`, and `CHARACTER_SWITCHED`.

- [ ] **Step 1: Write failing layout tests**

```ts
it('starts both characters behind separate full walls with a central opening', () => {
  expect(FACILITY_LAYOUT.startingCover.left.maxX).toBeLessThan(-2);
  expect(FACILITY_LAYOUT.startingCover.right.minX).toBeGreaterThan(2);
  expect(FACILITY_LAYOUT.startingCover.gapWidth).toBeGreaterThanOrEqual(4);
  expect(pointIsProtected(FACILITY_LAYOUT.encounters[0].playerStart)).toBe(true);
  expect(pointIsProtected(FACILITY_LAYOUT.encounters[0].partnerStart)).toBe(true);
});
```

- [ ] **Step 2: Write failing tutorial tests**

```ts
it('advances through real actions and can be skipped', () => {
  const tutorial = new TutorialDirector({ completedBefore: false });
  tutorial.record({ type: 'MOVED' });
  expect(tutorial.getSnapshot().step).toBe('AIM');
  tutorial.skip();
  expect(tutorial.getSnapshot()).toMatchObject({ active: false, skipped: true });
});
```

- [ ] **Step 3: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/worldLayout.test.ts tests/unit/TutorialDirector.test.ts`
Expected: FAIL on missing layout/tutorial contracts.

- [ ] **Step 4: Add two full-height starting walls and authored route metadata**

Keep a 4–5 metre central gap, usable outer peek edges, protected starts, and the existing route bounds. Add semantic cover ids and exposure directions rather than deriving tactics from mesh names.

- [ ] **Step 5: Implement and persist tutorial progress**

The sequence is `MOVE`, `AIM`, `FIRE`, `CALLOUT`, `SWITCH`, `COMPLETE`. The HUD displays one input-aware prompt at a time. Holding the device-specific skip input long enough calls `skip()`. First enemies may move/telegraph during training but lethal pressure is disabled until completion/skip.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/worldLayout.test.ts tests/unit/TutorialDirector.test.ts tests/component/App.test.tsx && npm run typecheck`
Expected: PASS.

Commit: `git commit -am "Add opening cover and interactive training"` after adding the new files.

### Task 5: Replace invisible timer damage with real enemy combat

**Files:**
- Create: `src/game/systems/EnemyDirector.ts`
- Create: `src/game/systems/EnemyCombatRuntime.ts`
- Test: `tests/unit/EnemyDirector.test.ts`
- Modify: `src/game/RuntimeVisualFactory.ts`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/game/MissionStore.ts`
- Modify: `tests/unit/MissionStore.test.ts`

**Interfaces:**
- Produces: `EnemyState = 'SEEK' | 'MOVE_TO_COVER' | 'ACQUIRE' | 'TELEGRAPH' | 'BURST' | 'RECOVER' | 'REPOSITION' | 'PRESS' | 'RETREAT' | 'DEAD'`.
- Produces: `EnemyDirector.update(world, dt): readonly EnemyCommand[]` where commands are move, face, begin telegraph, fire shot, and change cover.
- Produces: `EnemyShotEvent` with shooter, target, origin, direction, hit, damage, and impact.
- Consumes: authored cover nodes, deterministic RNG, line-of-sight callback, and current Owen/Cody state.

- [ ] **Step 1: Write failing perception and state-machine tests**

```ts
it('cannot shoot a character behind full cover', () => {
  const commands = director.update(world({ visible: false, state: 'ACQUIRE' }), 2);
  expect(commands.some((command) => command.type === 'FIRE_SHOT')).toBe(false);
});

it('telegraphs before firing a bounded burst', () => {
  const sequence = simulateEnemy({ visible: true, duration: 4, seed: 7 });
  expect(sequence.indexOf('BEGIN_TELEGRAPH')).toBeLessThan(sequence.indexOf('FIRE_SHOT'));
  expect(sequence.filter((event) => event === 'FIRE_SHOT').length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/EnemyDirector.test.ts`
Expected: FAIL because the director does not exist.

- [ ] **Step 3: Implement pure perception, cover scoring, and tactical transitions**

Perception requires field of view, range, and line of sight. Cover scoring accounts for exposure to both characters, occupancy, distance, and route pressure. Seeded accuracy starts imperfect and ramps within a burst; moving, range, suppression, and partial cover reduce hit probability.

- [ ] **Step 4: Add enemy weapon/muzzle anchors and runtime shot presentation**

Every shot rotates the enemy toward its target, flashes the muzzle, plays an enemy report, renders a tracer/near miss or impact, then applies domain damage only if the ray resolves as a hit. Delete the existing periodic `enemyCombat()` damage subtraction.

- [ ] **Step 5: Preserve exact failure attribution**

Extend mission history summaries with shooter/shot ids while keeping the public failure cause `ENEMY_FIRE`. Transition protection remains the only no-damage exception; pause/title/tutorial protection is enforced before shot resolution rather than after arbitrary damage.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/EnemyDirector.test.ts tests/unit/MissionStore.test.ts tests/unit/GameplayDirector.test.ts && npm run typecheck`
Expected: PASS; no facility timer directly calls `damageCharacter`.

Commit: `git commit -am "Implement visible enemy combat and cover tactics"` after adding the new files.

### Task 6: Add the first-person hands and weapon viewmodel

**Files:**
- Create: `src/game/presentation/FirstPersonViewModel.ts`
- Test: `tests/unit/FirstPersonViewModel.test.ts`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/game/RuntimeVisualFactory.ts`

**Interfaces:**
- Produces: `ViewModelPose` and pure `computeViewModelPose(input): ViewModelPose`.
- Produces: `FirstPersonViewModel.update(pose, dt)`, `playFire()`, `playReload()`, `setVisible()`, and `dispose()`.
- Consumes: motor stance/bob, aim fraction, reload state, weapon-fire events, and reduced-motion preference.

- [ ] **Step 1: Write failing pose tests**

```ts
it('lowers the weapon while sprinting and aligns it while aiming', () => {
  expect(computeViewModelPose({ sprint: 1, aim: 0, bob: 0 }).position.y).toBeLessThan(0);
  expect(computeViewModelPose({ sprint: 0, aim: 1, bob: 0 }).rotation.y).toBeCloseTo(0, 3);
});

it('decays recoil instead of accumulating forever', () => {
  const pose = integrateRecoil({ recoil: 1 }, 1);
  expect(pose.recoil).toBeGreaterThanOrEqual(0);
  expect(pose.recoil).toBeLessThan(1);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/FirstPersonViewModel.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement original low-poly hands and sidearm geometry**

Parent meshes to a camera-local root in a dedicated rendering group. Use Owen/Cody sleeve accents, readable front/rear sights, and a muzzle node. Do not load external weapon assets.

- [ ] **Step 4: Connect stance, aim, firing, reload, and switching visibility**

Movement drives bob/sway; ADS interpolates the sight to centre; fire triggers recoil and muzzle flash from the same domain event that consumes ammunition; reload visibly moves the weapon/hands. Hide the viewmodel during title, camera pullback, failure, and completion.

- [ ] **Step 5: Run verification and commit**

Run: `npm test -- tests/unit/FirstPersonViewModel.test.ts tests/unit/ProceduralAudio.test.ts && npm run typecheck && npm run build`
Expected: PASS.

Commit: `git commit -am "Add first-person hands and weapon presentation"` after adding the new files.

### Task 7: Add the mandatory facility/chase minimap and HUD routing

**Files:**
- Create: `src/game/presentation/minimapModel.ts`
- Create: `src/components/TacticalMinimap.tsx`
- Test: `tests/unit/minimapModel.test.ts`
- Test: `tests/component/TacticalMinimap.test.tsx`
- Modify: `src/components/Hud.tsx`
- Modify: `src/App.tsx`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/styles/mission-ui.css`

**Interfaces:**
- Produces: `MinimapSnapshot` containing mode, geometry, route, objective, characters, visible enemies, car, pursuers, and next turn.
- Produces: `projectFacilityMinimap(input)` and `projectChaseMinimap(input)` pure functions.
- Consumes: authored `worldLayout`, runtime entity positions, detection state, and mission objective.

- [ ] **Step 1: Write failing projection tests**

```ts
it('keeps the objective inside the circular map or emits an edge arrow', () => {
  const map = projectFacilityMinimap(farObjectiveFixture);
  expect(map.objective.visible || map.objective.edgeArrow).toBeTruthy();
});

it('does not reveal an undetected enemy', () => {
  const map = projectFacilityMinimap(enemyFixture({ detected: false }));
  expect(map.enemies).toHaveLength(0);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/minimapModel.test.ts tests/component/TacticalMinimap.test.tsx`
Expected: FAIL because the model/component do not exist.

- [ ] **Step 3: Implement facility and chase projections**

Facility mode rotates around the controlled character, clips the authored route, distinguishes Owen/Cody, shows detected hostiles and interactions, and creates an objective edge arrow. Chase mode shows forward route, next turn distance/direction, pursuers, obstacles, and escape.

- [ ] **Step 4: Render a lower-left SVG minimap with semantic fallback text**

Use SVG for deterministic geometry and screenshots. Include an accessible label describing the objective direction and next chase turn. Keep map labels upright while markers rotate.

- [ ] **Step 5: Integrate without HUD overlap**

Add `minimap` to `HudProps`; place it lower-left, retain subtitles lower-centre, move callouts when necessary, and place vehicle integrity adjacent without covering the route.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/minimapModel.test.ts tests/component/TacticalMinimap.test.tsx tests/component/App.test.tsx && npm run typecheck`
Expected: PASS at component viewport fixtures for 1280x720 and 1920x1080.

Commit: `git commit -am "Add tactical facility and chase minimap"` after adding the new files.

### Task 8: Deliver the direct agent brief and pre-game radio subtitles

**Files:**
- Create: `src/partner/partnerBrief.ts`
- Create: `src/components/AgentPartnerBrief.tsx`
- Test: `tests/unit/partnerBrief.test.ts`
- Modify: `src/partner/PartnerCoordinator.ts`
- Modify: `src/partner/webMcpTools.ts`
- Modify: `src/components/PairingScreen.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/pairing.css`
- Modify: `tests/unit/PartnerCoordinator.test.ts`
- Modify: `tests/unit/WebMcpTools.test.ts`

**Interfaces:**
- Produces: `PARTNER_BRIEF: PartnerBrief` and `renderPartnerBriefText(brief): string`.
- Produces: `AgentPartnerBrief` with agent-readable structured page content.
- Extends: `send_radio_message` to work in pairing after a valid join.
- Consumes: the same brief in page content, `join_heist`, and `get_mission_briefing`.

- [ ] **Step 1: Write failing contract tests**

```ts
it('makes the human-only start and continuous wait loop explicit', () => {
  const text = renderPartnerBriefText(PARTNER_BRIEF);
  expect(text).toContain('Only the human can press START HEIST');
  expect(text).toContain('wait_for_mission_event');
  expect(text).toContain('continue until');
});

it('allows joined Cody to speak before the mission starts', async () => {
  const joined = await execute('join_heist', { agentName: 'Codex' });
  const radio = await execute('send_radio_message', { sessionId: joined.sessionId, line: 'Controls ready.', intent: 'ACK' });
  expect(radio).toMatchObject({ ok: true, phase: 'PAIRING' });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/partnerBrief.test.ts tests/unit/WebMcpTools.test.ts`
Expected: FAIL on the missing canonical brief and pre-game radio behavior.

- [ ] **Step 3: Implement one canonical typed operating brief**

Include identity, immediate join, game/control explanation, recommended hardware, human-only start, no pre-game deadline, repeated wait/action loop, terminal states, ownership boundary, communication, memory use, and unrelated-action trust boundary.

- [ ] **Step 4: Expose the brief directly to the visiting agent**

Render structured text at top-level page scope with a clear `Agent partner operating brief` heading and machine-readable data attributes. Do not add a copy button. Return the same text plus `nextAction` from join/briefing tools.

- [ ] **Step 5: Render pairing radio and exact next actions**

`PairingScreen` receives recent radio lines and displays Cody's subtitle/transcript beneath partner status. Every tool response returns `terminal`, `phase`, and a concise exact next action. No tool invokes `startMission()`.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/partnerBrief.test.ts tests/unit/PartnerCoordinator.test.ts tests/unit/WebMcpTools.test.ts tests/component/App.test.tsx && npm run typecheck`
Expected: PASS.

Commit: `git commit -am "Add direct partner brief and pairing radio"` after adding the new files.

### Task 9: Replace one-shot audio with effects buses and adaptive score

**Files:**
- Create: `src/audio/AdaptiveAudioDirector.ts`
- Test: `tests/unit/AdaptiveAudioDirector.test.ts`
- Modify: `src/audio/ProceduralAudio.ts`
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/PauseMenu.tsx`
- Modify: `src/styles/mission-overlays.css`

**Interfaces:**
- Produces: `AudioIntensity = 'CALM' | 'ALERT' | 'COMBAT' | 'BREACH' | 'CHASE' | 'RESOLUTION'`.
- Produces: `chooseAudioIntensity(metrics, previous)` and `AdaptiveAudioDirector` with `unlock()`, `playEffect()`, `setIntensity()`, `setRadioActive()`, `setVolumes()`, `suspend()`, and `dispose()`.
- Consumes: weapon/footstep/enemy/radio/bomb/vehicle events and persisted volume settings.

- [ ] **Step 1: Write failing intensity and lifecycle tests**

```ts
it('uses hysteresis instead of flickering around combat threshold', () => {
  expect(chooseAudioIntensity({ threat: 0.49 }, 'COMBAT')).toBe('COMBAT');
  expect(chooseAudioIntensity({ threat: 0.1 }, 'COMBAT')).toBe('ALERT');
});

it('ducks music during radio and disconnects every node on dispose', () => {
  const audio = createAudioHarness();
  audio.setRadioActive(true);
  expect(audio.musicGain()).toBeLessThan(audio.normalMusicGain());
  audio.dispose();
  expect(audio.connectedNodeCount()).toBe(0);
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/AdaptiveAudioDirector.test.ts`
Expected: FAIL because the director does not exist.

- [ ] **Step 3: Implement buses, original layers, and complete effects**

Create master/music/effects/radio gains. Add distinct human/partner/enemy shots, reload, empty click, cadence-driven footsteps, near miss, metal/concrete impact, damage, plant, explosion, alarm, switch, radio, engine, collision, pursuer fire, and objective cues. Use original procedural loops/stems for calm, alert, combat, breach, chase, and resolution.

- [ ] **Step 4: Respect browser unlock and lifecycle constraints**

Start/resume context on trusted human interaction without awaiting it before pointer capture. Crossfade intensity, duck on radio, suspend on pause/page hide, and remove timers/nodes on runtime disposal.

- [ ] **Step 5: Add persisted music/effects controls**

Expose separate music/effects sliders and mute in pause/settings. Invalid stored values use bounded defaults without affecting mission storage.

- [ ] **Step 6: Run verification and commit**

Run: `npm test -- tests/unit/AdaptiveAudioDirector.test.ts tests/unit/ProceduralAudio.test.ts tests/component/App.test.tsx && npm run typecheck`
Expected: PASS.

Commit: `git commit -am "Add adaptive score and complete game audio"` after adding the new files.

### Task 10: Integrate systems, controller chase behavior, failures, and checkpoint resets

**Files:**
- Modify: `src/game/BabylonGameRuntime.ts`
- Modify: `src/game/GameplayDirector.ts`
- Modify: `src/game/MissionStore.ts`
- Modify: `src/App.tsx`
- Modify: `tests/unit/GameplayDirector.test.ts`
- Modify: `tests/unit/MissionStore.test.ts`
- Modify: `tests/e2e/heist.spec.ts`

**Interfaces:**
- Consumes: all modules from Tasks 1–9.
- Produces: a smaller `BabylonGameRuntime` that composes systems and emits a complete `GameRuntimeStatus` containing pointer lock, device, enemies, tutorial, minimap, audio, chase, prompt, and damage direction.

- [ ] **Step 1: Add failing integration tests for ownership and live simulation**

```ts
it('transfers the same two physical characters between human and partner controllers', () => {
  const before = harness.characterTransforms();
  harness.completeSwitch('CODY');
  expect(harness.humanControllerCharacter()).toBe('CODY');
  expect(harness.partnerControllerCharacter()).toBe('OWEN');
  expect(harness.characterTransforms()).toEqual(before);
});

it('restores sprint, enemies, tutorial policy, audio, and minimap from checkpoint baseline', () => {
  harness.failAndRestore();
  expect(harness.snapshot()).toMatchObject({ sprinting: true, simulationRunning: true });
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- tests/unit/GameplayDirector.test.ts tests/unit/MissionStore.test.ts`
Expected: FAIL on the new integration expectations.

- [ ] **Step 3: Compose a fixed-timestep runtime loop**

Poll input, update motor/controllers, update enemies and chase, resolve combat, update viewmodel/audio/minimap, sync mission state, then render. Bound catch-up steps. Title, pause, failure, restore, and completion are the only simulation stops.

- [ ] **Step 4: Complete agent/human chase control with controller support**

The human driver uses continuous stick/keyboard lane steering; the human shooter uses normal aim/fire. The agent driver executes authored left/right/hold/evade/accelerate/brake decisions; the agent shooter uses target priority. Switching exchanges control while retaining physical seats and health.

- [ ] **Step 5: Validate failure and checkpoint cleanup**

Character/vehicle zero, decision timeout, third serious incident, and objective compromise show exact cards and restore only the current checkpoint. Dispose old scene listeners, audio loops, enemies, minimap subscriptions, viewmodel, and input edges before rebuilding.

- [ ] **Step 6: Run the full automated suite and commit**

Run: `npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build && git diff --check`
Expected: all commands exit 0.

Commit: `git commit -am "Integrate rebuilt heist gameplay systems"` after adding any new integration fixtures.

### Task 11: Perform bounded raw Cursor CLI visual polish

**Files:**
- Modify only as justified: `src/styles/*.css`, `src/components/TacticalMinimap.tsx`, `src/components/Hud.tsx`, `src/components/PairingScreen.tsx`, `src/game/presentation/FirstPersonViewModel.ts`, `src/game/RuntimeVisualFactory.ts`
- Capture: `docs/hackathon-build/evidence/*.png`

**Interfaces:**
- Consumes: working behavior and screenshots from Tasks 1–10.
- Produces: reviewed visual changes only; no domain, tool, persistence, or test bypass changes.

- [ ] **Step 1: Capture baseline screenshots at required states and resolutions**

Run the production preview and capture pairing, opening cover/tutorial, active facility combat with viewmodel/minimap, bomb gate, chase, failure, and debrief at 1280x720 and 1920x1080.

- [ ] **Step 2: Run raw Cursor CLI with a bounded visual brief**

Tell Cursor CLI to inspect the screenshots and only refine HUD hierarchy, minimap clarity, viewmodel proportions, materials, lighting, and motion timing. Explicitly forbid behavior changes, tool changes, external/unlicensed assets, new scope, and test deletion. Use the user's requested capable Cursor model if locally available.

- [ ] **Step 3: Review every Cursor diff before accepting it**

Run `git diff -- src/styles src/components src/game/presentation src/game/RuntimeVisualFactory.ts`. Revert or edit any generic styling, unreadable contrast, copied game identity, behavior change, giant-file growth, unrelated refactor, or weakened test.

- [ ] **Step 4: Re-run visual and automated checks**

Capture the same screenshot matrix and compare HUD overlap, target readability, route clarity, subtitles, and control prompts. Run `npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build && git diff --check`.

- [ ] **Step 5: Commit reviewed polish**

Commit: `git commit -am "Polish heist HUD and first-person presentation"` after adding updated evidence files.

### Task 12: Physical QA, documentation, and honest release record

**Files:**
- Modify: `README.md`
- Modify: `docs/hackathon-build/build-notes.md`
- Modify: `docs/hackathon-build/submission-handoff.md`
- Modify tests only for defects discovered during QA.

**Interfaces:**
- Consumes: the complete production build.
- Produces: recorded evidence for automated, physical-browser, controller, audio, difficulty, and real-agent gates.

- [ ] **Step 1: Run the canonical release gate from a clean production build**

Run: `npm ci && npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build && git diff --check`
Expected: all commands exit 0.

- [ ] **Step 2: Verify mouse and pointer lock in a physical supported browser**

Confirm capture, release with Escape, retry after denial, fallback message, aim/fire/reload, no frozen enemies, keyboard focus, and checkpoint restore. Record browser/version and exact outcome.

- [ ] **Step 3: Verify standard controllers**

With available Xbox and PlayStation hardware, confirm detection, labels, move/look, aim/fire, reload, interaction, switch, callout, sprint toggle, pause, aim assistance, disconnect/reconnect, facility, and chase roles. If either physical device is unavailable, record that limitation rather than claiming it passed.

- [ ] **Step 4: Complete real-agent and audio/difficulty runs**

Open the production app through a WebMCP-capable agent. Confirm direct brief receipt, join, pre-game explanation/subtitles, human-only start, repeated wait/action loop, bomb/chase decisions, one timeout failure, one memory-informed retry, and a terminal state. Confirm adaptive music, ducking, shots, footsteps, impacts, vehicle effects, and cleanup across retries.

- [ ] **Step 5: Update documentation with exact controls and limitations**

README must explain recommended hardware, keyboard/Xbox/PlayStation controls, pointer fallback, direct agent brief, WebMCP loop, memory semantics, audio controls, local setup, tests, deployment, and current physical QA evidence. Build notes must distinguish automated, shimmed, headful, physical-device, and real-agent results.

- [ ] **Step 6: Run final diff and repository review**

Run: `git status --short && git diff --check && git diff --stat HEAD~1 && git log --oneline --decorate -12`.
Inspect for secrets, generated dependency folders, unlicensed assets, disabled tests, temporary debug globals beyond the intentional test harness, and inaccurate completion claims.

- [ ] **Step 7: Commit the verified release record**

Commit: `git commit -am "Document rebuilt heist verification"` after adding any final evidence. Do not push, deploy, publish, or submit without separate explicit user authorization.
