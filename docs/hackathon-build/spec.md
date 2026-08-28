# Technical Spec

## Overview

`HS: Heist` is a client-side desktop browser game built as one deployable Vite application. React owns the human-facing shell and HUD. Babylon.js owns the 3D world, camera, authored movement, collision, combat presentation, and chase. A framework-independent mission domain owns the authoritative rules so that gameplay, WebMCP tools, persistence, and tests all read and mutate the same state.

The WebMCP partner is real rather than simulated. The top-level page registers imperative JavaScript tools through `document.modelContext.registerTool`. A compatible ChatGPT Work or Codex agent joins the page, repeatedly waits for meaningful mission events, observes structured state, and submits tactics or required decisions. The game engine converts those high-level choices into continuous character and vehicle behavior.

The application has no backend, account system, API key, or hidden model call. Long-term partner memory and the latest checkpoint are stored in the current browser. This keeps the live demo easy to open and makes the agent/page relationship inspectable.

Implements: `prd.md > Product Summary`, `Product Principles`, and all twelve epics.

## Stack

### Runtime

- **TypeScript 7** with strict compiler settings for shared game, WebMCP, and UI types.
- **React 19** for screens, overlays, HUD, dialogs, subtitles, and debrief.
- **Vite 8** for local development, optimized static builds, and deployment.
- **Babylon.js 9** (`@babylonjs/core`, `@babylonjs/loaders`) for WebGL/WebGPU rendering, scene graph, meshes, cameras, picking, effects, and animation.
- **CSS modules/global CSS tokens** for a purpose-built cinematic UI without a component-library visual dependency.
- **Web Audio API** for original procedural weapon, impact, alert, explosion, vehicle, and radio sounds. The game begins audio only after the player's start interaction.
- **localStorage** for settings, prompts-seen flags, checkpoint metadata, run summaries, and structured partner memory.

### Verification

- **Vitest** for mission rules, validation, memory deduplication, persistence, and WebMCP handler tests.
- **Testing Library** for important React states and accessibility behavior.
- **Playwright** for the pairing-to-debrief browser journey using a test-only WebMCP driver.
- **Oxlint** and **TypeScript** for fast static verification without a compiler peer-version constraint.
- **Vite production build** as the deployability gate.

### Why Babylon.js

Babylon.js is the full browser game engine chosen during scope. Its official feature set includes a complete scene graph, cameras, collisions, picking, animations, audio, GUI, post-processing, and navigation/crowd support. This project deliberately uses authored waypoint navigation rather than a runtime-generated navmesh because the level and chase are small, fixed, and easier to verify deterministically.

Primary references:

- [OpenAI Site tools documentation](https://learn.chatgpt.com/docs/webmcp)
- [WebMCP draft specification](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP developer guide](https://developer.chrome.com/docs/ai/webmcp)
- [Babylon.js documentation](https://doc.babylonjs.com/)
- [Babylon.js engine specifications](https://www.babylonjs.com/specifications/)

## Architecture

### 1. React application shell

React renders exactly one full-window game canvas plus DOM overlays. It chooses among these presentation modes:

1. compatibility notice,
2. pairing,
3. title sequence,
4. active mission,
5. pause or memory dialog,
6. failure transition,
7. completion/debrief.

React never keeps a second copy of mission truth. It subscribes to snapshots from the mission store and dispatches typed commands back into it.

Implements: `prd.md > Epics 1, 2, 3, 5, 9, 10, 11, 12`.

### 2. Mission domain and store

The domain is a deterministic state machine independent of React and Babylon. It owns:

- session pairing and run identifiers;
- phase, section, checkpoint, objective, and completion state;
- Owen, Cody, enemy, and vehicle state;
- human/agent ownership and seat assignment;
- switch transitions, cooldowns, locks, and protection;
- ammunition and reload state;
- bomb state;
- required decisions and absolute deadlines;
- section critical incidents;
- action and failure history;
- pause-aware mission time.

All mutations are commands validated against the current state. Invalid commands return a structured rejection and do not partially mutate the mission.

Implements: `prd.md > Epics 3–9, 11, 12`.

### 3. Babylon world adapter

The Babylon adapter projects the current domain state into a cinematic 3D scene and reports physical events back as domain commands. It contains two authored world modes:

- **Facility:** two connected industrial combat spaces, gate corridor, cover nodes, spawn nodes, safe zones, and bomb gate.
- **Chase:** a forward-moving authored road spline with lane offsets, two major turns, obstacles, pursuing vehicles, and an escape trigger.

The scene is built from original procedural geometry and materials. This avoids asset licensing risk and allows every collision surface, cover point, light, prop, and sightline to be tuned in code.

Implements: `prd.md > Epics 2, 3, 4, 7, 8, 11`.

### 4. Hybrid partner controller

The off-character controller converts the latest valid agent tactic into continuous behavior:

- `ADVANCE`: follow the next authored combat node and engage visible threats;
- `COVER`: remain near cover and suppress the highest-risk visible enemy;
- `FLANK`: use the alternate authored node chain;
- `RETREAT`: move toward the nearest safe node while firing defensively;
- `PROTECT`: stay near the human character and prioritize threats targeting them;
- `HOLD`: preserve position and engage only clear threats;
- bomb actions: move, plant, abort, wait, and retreat;
- chase actions: interpolate `LEFT`, `RIGHT`, or `HOLD` into lane/turn targets;
- shooter priority: focus the requested pursuer, closest attacker, or highest-damage threat.

The controller does not invent strategic choices during a required decision. If the agent misses that deadline, the state machine fails the section as specified.

Implements: `prd.md > Epics 5, 6, 7, 8`.

### 5. WebMCP bridge and event loop

The top-level page registers narrow tools using the imperative WebMCP API. Registration is feature-detected so ordinary browsers can render the waiting screen without crashing. There is intentionally no production solo fallback.

The agent workflow is:

1. call `join_heist` once;
2. call `wait_for_mission_event` repeatedly;
3. inspect the returned observation, relevant memory, available actions, and any deadline;
4. call the appropriate tactic, decision, target, steering, or radio tool;
5. return to `wait_for_mission_event` until the run completes or the player returns to pairing.

`wait_for_mission_event` is an asynchronous long-polling tool. It resolves immediately when a meaningful event already exists, otherwise waits for an event or a bounded heartbeat. It observes the execution `AbortSignal` so a cancelled tool invocation cannot leak a pending listener. Each event has a monotonically increasing sequence number; this prevents duplicate processing and lets the agent resume after heartbeats.

Agent-mutating calls include the session id, event/decision id where relevant, and narrow enum inputs. Late actions, stale sessions, invalid targets, and unavailable tactics are rejected with the current observation so the agent can recover if the deadline remains open.

Implements: `prd.md > Epics 1, 5, 6, 7, 8, 10`.

### 6. Persistence and memory

Two storage documents remain separate:

- **Checkpoint save:** latest checkpoint id, current run summary, prompts seen, and enough authored baseline metadata to continue after re-pairing. Checkpoint restore is reconstructed from trusted checkpoint definitions rather than deserializing arbitrary world objects.
- **Partner memory:** versioned structured lessons containing id, run, section, evidence event, consequence, lesson, affected tactic, occurrence count, created/last-seen times, and optional later usage records.

The Markdown view/export is generated deterministically from structured memory. Lessons are deduplicated by a stable semantic key. The page may record evidence, but it never fabricates a lesson on the agent's behalf: the WebMCP agent calls `record_partner_lesson` with an evidence event id, and the handler validates that the event exists and is consequential. A small set of safe automatic lessons can be added only for unambiguous system facts such as a missed required decision; those are labeled as mission-system observations.

The agent receives relevant lessons in mission observations. When it submits an action influenced by memory, it supplies `usedLessonIds`; the handler validates them and records the linkage for the debrief.

Implements: `prd.md > Epics 9, 10, 11, 12`.

## File Structure

```text
.
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── public/
│   ├── favicon.svg
│   └── social-card.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── styles/
│   │   ├── tokens.css
│   │   ├── global.css
│   │   └── motion.css
│   ├── app/
│   │   ├── GameCanvas.tsx
│   │   ├── useMissionSnapshot.ts
│   │   └── keyboard.ts
│   ├── components/
│   │   ├── PairingScreen.tsx
│   │   ├── TitleSequence.tsx
│   │   ├── Hud.tsx
│   │   ├── CharacterVitals.tsx
│   │   ├── ObjectivePanel.tsx
│   │   ├── RadioSubtitles.tsx
│   │   ├── QuickCallouts.tsx
│   │   ├── ControlsOverlay.tsx
│   │   ├── PauseMenu.tsx
│   │   ├── MemoryPanel.tsx
│   │   ├── FailureCard.tsx
│   │   └── DebriefScreen.tsx
│   ├── game/
│   │   ├── domain/
│   │   │   ├── types.ts
│   │   │   ├── constants.ts
│   │   │   ├── initialState.ts
│   │   │   ├── commands.ts
│   │   │   ├── reducer.ts
│   │   │   ├── selectors.ts
│   │   │   └── validation.ts
│   │   ├── MissionStore.ts
│   │   ├── GameRuntime.ts
│   │   ├── scenes/
│   │   │   ├── createFacilityScene.ts
│   │   │   ├── createChaseScene.ts
│   │   │   ├── environment.ts
│   │   │   └── effects.ts
│   │   ├── systems/
│   │   │   ├── HumanController.ts
│   │   │   ├── PartnerController.ts
│   │   │   ├── CombatSystem.ts
│   │   │   ├── EncounterDirector.ts
│   │   │   ├── BombSystem.ts
│   │   │   ├── ChaseSystem.ts
│   │   │   ├── SwitchDirector.ts
│   │   │   └── AudioDirector.ts
│   │   └── presentation/
│   │       ├── characters.ts
│   │       ├── enemies.ts
│   │       ├── props.ts
│   │       └── materials.ts
│   ├── partner/
│   │   ├── PartnerCoordinator.ts
│   │   ├── eventQueue.ts
│   │   ├── observations.ts
│   │   ├── toolDefinitions.ts
│   │   ├── registerWebMcpTools.ts
│   │   └── webmcp.d.ts
│   ├── memory/
│   │   ├── MemoryRepository.ts
│   │   ├── lessonValidation.ts
│   │   └── markdown.ts
│   ├── persistence/
│   │   ├── storage.ts
│   │   ├── checkpoint.ts
│   │   └── migrations.ts
│   ├── audio/
│   │   └── synth.ts
│   └── test/
│       ├── fixtures.ts
│       └── installTestWebMcp.ts
├── tests/
│   ├── unit/
│   ├── component/
│   └── e2e/
├── docs/hackathon-build/
│   ├── learner-profile.md
│   ├── scope.md
│   ├── prd.md
│   ├── spec.md
│   ├── checklist.md
│   └── build-notes.md
├── LICENSE
└── README.md
```

The exact file count can contract during implementation when two very small modules are clearer together. The dependency boundaries may not: domain logic must not depend on React or Babylon, and WebMCP handlers must reuse domain commands rather than mutate display state directly.

## Data Flow

### Pairing and agent loop

```text
Agent calls join_heist
  -> WebMCP bridge validates browser session
  -> MissionStore marks partner online
  -> PairingScreen enables START HEIST
  -> Agent calls wait_for_mission_event
  -> PartnerCoordinator resolves next queued event or heartbeat
  -> Agent calls a narrow action tool
  -> handler validates session + context + deadline
  -> MissionStore applies command
  -> Babylon/React subscribers render the same result
```

### Human input

```text
Keyboard / mouse / HUD callout
  -> HumanController or React command
  -> MissionStore validates command
  -> state snapshot changes
  -> Babylon updates physical behavior
  -> PartnerCoordinator publishes meaningful event
  -> pending wait_for_mission_event resolves
```

### World simulation

```text
Babylon render tick
  -> authored movement and collision
  -> Combat/Bomb/Chase systems detect outcomes
  -> typed domain command
  -> MissionStore records state + event history
  -> checkpoint/failure/memory effects run after committed state
```

### Failure and checkpoint restore

```text
Terminal condition or third critical incident
  -> freeze world and record exact causes
  -> publish failure event for memory evidence
  -> show two-second failure card
  -> reconstruct latest authored checkpoint baseline
  -> retain run history and partner memory
  -> publish checkpoint-restored event
```

## Components And Responsibilities

### `MissionStore`

Provides immutable snapshots, a typed dispatch boundary, timers based on mission time, and subscriptions for React, Babylon, and WebMCP. It is the only owner of live mission truth.

Implements: `prd.md > Epics 1–12`.

### `GameRuntime`

Creates/disposes the Babylon engine and active scene, owns the render loop, forwards resize/pointer-lock input, and ensures pause/title/failure states stop simulation without stopping UI.

Implements: `prd.md > Epics 2–4, 7–9, 11–12`.

### `EncounterDirector` and `CombatSystem`

Spawn the two small encounter waves, manage enemy target selection and readable attack telegraphs, resolve ray hits/ammunition/damage, and advance objectives when rooms are secure. Randomness uses a run-seeded generator so failures can be reproduced while still feeling alive.

Implements: `prd.md > Epic 3`, `Epic 9`.

### `SwitchDirector`

Owns free switching, cooldown, forced switches, transition camera path, heavy time scaling, and temporary character protection. It transfers human/agent ownership only after the transition completes.

Implements: `prd.md > Epic 4`, `Epic 7.1`, `Epic 8.4`.

### `BombSystem`

Owns the gate state machine, Cody's plant progress, interruption, safe-distance calculation, Owen's detonation action, explosion effects/damage, reinforcement pressure, and gate opening.

Implements: `prd.md > Epic 7`.

### `ChaseSystem`

Advances the car along a fixed route, applies discrete driver choices to lane/turn targets, spawns and updates pursuers, resolves shooter damage and incoming fire, and triggers escape or vehicle failure.

Implements: `prd.md > Epic 8`.

### `PartnerCoordinator`

Builds privacy-bounded observations, queues meaningful events, manages WebMCP session identity, owns required decision ids/deadlines, rejects stale inputs, and records the causal link between agent choices and world outcomes.

Implements: `prd.md > Epics 1, 5, 6, 7, 8, 10`.

### `MemoryRepository`

Loads/migrates versioned local memory, validates lesson evidence, deduplicates lessons, records uses, generates Markdown, exports a file, and performs confirmed reset without touching checkpoints or settings.

Implements: `prd.md > Epic 10`, `Epic 11.2–11.3`, persistence edge cases.

### React presentation components

Keep pairing, HUD, subtitles, menus, prompts, failure, and debrief readable independent of scene brightness. DOM overlays are chosen over in-canvas GUI so semantic controls, keyboard focus, accessibility, testing, and responsive placement remain reliable.

Implements: `prd.md > Epics 1–5, 9–12`.

## WebMCP Tool Contract

All tools are registered on the top-level document. Names use snake case, descriptions state side effects, input schemas set `additionalProperties: false`, and read-only tools use `annotations.readOnlyHint: true`.

### `join_heist`

- Input: optional agent display name.
- Effect: pairs one agent session to this page and returns a session id plus operating instructions.
- Idempotency: a repeated call in the same page returns the existing session.

### `get_mission_briefing`

- Read-only.
- Returns controls, characters, partnership rules, current pairing state, and how to run the event loop.

### `wait_for_mission_event`

- Read-only with respect to game state.
- Input: session id, last event sequence, bounded wait duration.
- Returns: event type, sequence, observation, available actions, required decision and deadline, relevant lessons, and terminal status.
- Responds to `AbortSignal` and removes its listener on resolve/cancel.

### `set_partner_tactic`

- Input: session id, tactic enum, concise radio line, optional used lesson ids.
- Effect: changes the off-character's ordinary tactical controller when contextually valid.

### `resolve_partner_decision`

- Input: session id, decision id, action enum, radio line, optional used lesson ids.
- Effect: resolves one active bomb, turn, obstacle, or authored role decision. A stale or expired id never changes state.

### `prioritize_pursuer`

- Input: session id, target id or priority enum, radio line, optional used lesson ids.
- Effect: changes the agent shooter's visible target priority.

### `send_radio_message`

- Input: session id, concise line and intent (`ACK`, `WARN`, `REQUEST`, `PLAN`).
- Effect: queues a diegetic subtitle. Length is bounded and output is treated as untrusted text.

### `read_partner_memory`

- Read-only.
- Input: optional section/tactic filter and result limit.
- Returns structured lessons plus Markdown excerpt.

### `record_partner_lesson`

- Input: session id, evidence event id, concise lesson, and affected tactic.
- Effect: validates real evidence, adds/deduplicates a lesson, and triggers `MEMORY UPDATED`.

### `get_run_debrief`

- Read-only.
- Returns the latest or active run summary, action attribution, failures, lessons added, and lessons used.

## External APIs And Dependencies

### WebMCP

The browser API is experimental and host-controlled. The implementation follows the current draft's imperative `document.modelContext.registerTool` API. The ChatGPT built-in browser currently discovers imperative tools only in the top-level page, so the game is not embedded in an iframe and does not rely on declarative form tools.

The page cannot call ChatGPT or force the agent to continue. The visible pairing instructions ask the user to tell Codex to join and play; the returned tool instructions ask the agent to keep using the wait/action loop. Missed required calls are genuine mission failures rather than hidden automation.

### Babylon.js

Only ESM package imports are used. The first implementation uses WebGL through Babylon's `Engine` for broad compatibility; WebGPU is a later optimization, not a requirement. The procedural scene avoids runtime asset-host failures. Babylon is lazy-loaded only after the game starts so the pairing screen becomes interactive quickly.

### Browser storage

Storage parsing is schema-validated and versioned. Corrupt or unknown data falls back to an empty safe document while leaving unrelated browser keys untouched. Storage writes are bounded; old run detail is summarized while lessons remain available.

### Deployment headers

The deployed top-level page must use HTTPS and must not opt out of origin-keyed agent clustering. Static hosting should leave the `tools` permissions policy at its default `self`. If explicit headers are configured, use `Permissions-Policy: tools=(self)` and never `Origin-Agent-Cluster: ?0`.

## AI Usage

### Runtime AI

The user's ChatGPT Work or Codex agent is the sole runtime decision-maker for the partner. The website does not ship an OpenAI API key, call a model endpoint, or silently substitute scripted strategy.

The WebMCP tools reduce the decision surface to meaningful game choices while preserving agent reasoning:

- observation rather than screenshots;
- tactics rather than WASD;
- decisions rather than analog steering;
- explicit radio text rather than scraping chat output;
- inspectable lessons rather than claims of hidden learning.

### Build-time AI

Codex is the primary implementation, integration, research, test, and verification collaborator. Any optional Cursor/Claude/Grok pass must be reviewed against this spec and may not independently expand scope or introduce unlicensed assets.

### Trust boundaries

- Agent-supplied radio and lesson text is rendered as text, never HTML.
- Tool input is validated again at runtime even though the browser validates JSON Schema.
- Observations expose game state only; they do not request or ingest unrelated conversation, identity, browsing, or personal data.
- Tool descriptions contain no cross-site instructions.
- Memory stores mission events and agent-authored lessons only.

## Visual And Interaction Direction

The art direction is an original cold industrial crime thriller: near-black graphite, oxidized steel, cold cyan practical lights, dirty amber warnings, and restrained emergency red. The typography pairs a condensed display face from the local/system stack with a neutral sans-serif HUD face. No external font is required for first paint.

The procedural facility uses strong silhouettes and navigational lighting rather than generic gray boxes: ribbed wall bays, overhead conduits, numbered blast doors, painted floor lanes, concrete/steel cover, warning strobes, fog volume, dust/sparks, and a bright exterior escape aperture. Owen and Cody use distinct color accents and readable tactical silhouettes.

The switch transition is original: audio ducks, time compresses, the view pulls upward through a brief signal-ghost treatment, travels along an authored curve, then dives into the destination character. It evokes distant perspective exchange without copying another game's map zoom, colors, audio, or graphics.

The HUD is sparse while calm and becomes more explicit under pressure. Motion honors `prefers-reduced-motion` by replacing long camera travel with a shorter fade while preserving timing and ownership semantics.

## Risks And Verification

### Risk: the host does not sustain the partner loop

Mitigation:

- joining returns explicit loop instructions;
- the wait tool returns bounded heartbeats instead of holding forever;
- meaningful events carry sequence numbers;
- ordinary tactics persist between calls;
- required decisions use enough time for a real agent call but still fail visibly;
- an in-repo test driver exercises the exact same tool handlers without becoming a production fallback.

Verification:

- inspect registered tools in ChatGPT's built-in browser;
- join with Codex and run from pairing through at least one checkpoint;
- verify repeated `wait_for_mission_event` calls and cancellation;
- deliberately miss one required decision and confirm `MISSION COMPROMISED`.

### Risk: 3D scope overwhelms product completeness

Mitigation:

- procedural assets;
- authored nodes instead of general navigation;
- one firearm and enemy archetype with visual variants;
- one facility route and one chase route;
- deterministic state machine built before visual polish.

Verification:

- a no-agent production page cannot start;
- the test driver completes every phase;
- each checkpoint can independently load and complete;
- a full successful run and each terminal failure path work in a production build.

### Risk: failures feel random or unfair

Mitigation:

- attack wind-up/telegraph before damage;
- line-of-sight and distance rules;
- seeded randomness;
- no damage during overlays, pause, switches, failure, or completion;
- authored survivable checkpoint baselines;
- exact event attribution.

Verification:

- unit tests for protection and terminal precedence;
- replay the same seed and compare critical event sequence;
- human browser QA for readable threats and recoverability.

### Risk: memory is decorative

Mitigation:

- evidence ids are mandatory;
- relevant lessons are returned with decisions;
- action calls can cite lesson ids;
- debrief links lessons to later tactics;
- at least one authored repeated situation has two visibly different valid strategies.

Verification:

- force a known first-attempt failure;
- record/export the resulting lesson;
- replay and submit the alternate tactic with that lesson id;
- verify changed world behavior and debrief linkage.

### Risk: experimental browser support

Mitigation:

- feature detection and an honest waiting/compatibility message;
- no iframe;
- secure HTTPS deploy;
- local Chrome flag/inspector route for development;
- normal UI remains intact when WebMCP is absent.

Verification:

- ordinary Chrome shows the game without a JavaScript error;
- WebMCP-enabled Chrome lists and manually invokes all tools;
- ChatGPT built-in browser discovers the same tools on the deployed origin.

### Required automated gates

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`
- `git diff --check` after repository initialization

### Required manual gates

- Pairing cannot be bypassed in the production URL.
- Mouse capture, aim, fire, reload, pause, and keyboard focus behave correctly.
- Both HUD health bars and car integrity match actual failure behavior.
- Switch transition is legible and does not grant indefinite protection.
- Subtitles remain readable at 1280×720 and 1920×1080.
- Bomb and chase required decisions work with a real Codex partner.
- Memory survives a reload, exports valid Markdown, and resets only after confirmation.
- A fresh browser profile can complete the demo without developer intervention.

## Demo And Submission Flow

The implementation will preserve the approved under-three-minute demo path:

1. Show the required pairing and a real `join_heist` WebMCP call.
2. Start the original title sequence and enter the facility.
3. Show one tactical event, one radio subtitle, and one character switch.
4. Show a recoverable mistake, checkpoint failure, and evidence-backed memory update.
5. Replay the moment with a changed tactic citing that lesson.
6. Show the forced bomb roles and successful detonation.
7. Show the chase, vehicle health, and an agent left/right/hold decision.
8. End on `HEIST COMPLETE`, debrief, live URL, and public repository.

The README will include exact WebMCP test instructions for ChatGPT's built-in browser and Chrome's testing flag, controls, architecture, privacy/persistence notes, known experimental-host limitations, license, and deployment steps.

## Technical Definition Of Done

The build is technically complete only when:

- the top-level deployed page registers all documented imperative WebMCP tools;
- a real compatible agent can join and remain the partner through the tool loop;
- no production control can start the mission without that join;
- the complete facility, bomb gate, chase, failure/checkpoint, completion, memory, and replay flow runs from a production build;
- ordinary continuous partner behavior comes from the latest agent tactic;
- every required agent decision either resolves through a valid WebMCP action or fails the mission;
- partner lessons cite actual events and later actions can cite those lessons;
- persistence and export work across reloads;
- automated and manual gates above are recorded in `build-notes.md`;
- the public repository contains all source, instructions, and an open-source license.
