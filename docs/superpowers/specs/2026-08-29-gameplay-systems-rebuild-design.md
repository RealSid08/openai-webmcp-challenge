# HS: Heist Gameplay Systems Rebuild

**Date:** 2026-08-29  
**Status:** Approved design  
**Scope:** Rebuild the existing vertical slice's input, movement, combat, controller, navigation, first-person presentation, audio, and agent-onboarding systems without changing engines or expanding beyond the approved single mission.

## 1. Purpose and precedence

The current build proves the mission state, WebMCP tool loop, checkpoint flow, and procedural Babylon.js presentation, but it does not yet behave like a reliable first-person action game. Mouse capture can fail silently, facility simulation is coupled to pointer-lock success, enemies appear inert, movement glides, controller input is absent, navigation is unclear, audio lacks continuity, and the player has no visible first-person body or weapon.

This document supersedes conflicting gameplay, input, combat, pairing, HUD, audio, and verification details in `docs/hackathon-build/prd.md`, `docs/hackathon-build/spec.md`, and `docs/hackathon-build/checklist.md`. Those documents remain the source of truth for the overall product, mission, memory, and submission intent where they do not conflict with this design.

The rebuild must preserve:

- React 19, TypeScript 7, Babylon.js 9, Vite, Oxlint, Vitest, and Playwright;
- a client-only deployable application with no model API key or backend;
- the required real WebMCP partner and human-only `START HEIST` control;
- Owen and Cody, free and forced character switching, the bomb gate, the authored chase, checkpoints, persistent memory, subtitles, and the debrief;
- an approximately 8–10 minute successful run;
- original branding, geometry, music, effects, and interface assets.

## 2. Goals

1. Mouse capture works when the host permits it, reports failure when it does not, and never gates mission simulation.
2. Movement feels grounded and immediately responsive while sprint remains the default travel mode.
3. Xbox and PlayStation controllers can play the full mission with contextual prompts and restrained aim assistance.
4. Enemies visibly perceive, move, use cover, aim, fire, miss, hit, reposition, and pressure both characters.
5. The opening places Owen and Cody behind separate full-height cover walls with a central route into the first encounter.
6. A skippable interactive tutorial teaches the actual input device inside the opening encounter.
7. A persistent minimap clearly shows where to go in both facility and chase phases.
8. The first-person camera shows stylized hands and a weapon with movement, aim, fire, and reload feedback.
9. Gunfire, footsteps, impacts, alarms, radio, vehicles, ambience, and an adaptive score make state changes audible.
10. An agent opening the page receives a dedicated partner brief separate from individual tool descriptions, explains the game through in-page subtitles, waits for the human to start, and follows the mission event loop through a terminal state.

## 3. Non-goals

- No open world, extra mission, inventory, weapon selection, loot, multiplayer server, account system, or cloud memory.
- No engine migration to Three.js, Unity, PlayCanvas, or another renderer.
- No frame-by-frame WebMCP movement. The agent chooses tactics and authored decisions; local controllers execute continuous motion.
- No photorealistic hands, motion-captured animation, general-purpose navmesh, or large third-party asset pack.
- No copied GTA, Krunker, or other game assets, interface graphics, music, dialogue, names, or animation.
- No claim that the website technically forces an agent process to remain active. The page supplies a strong operating contract and designs the tool loop around it.

## 4. Diagnosed failures in the existing build

### 4.1 Pointer lock freezes the game

`BabylonGameRuntime` currently sets `hasTakenControl` only after `document.pointerLockElement` becomes the canvas. Facility simulation is conditionally executed only when that flag is true. A rejected or unsupported pointer-lock request therefore prevents partner and enemy updates, encounter progression, and meaningful combat.

The request rejection and `pointerlockerror` event are not surfaced to the player. The existing end-to-end test replaces `requestPointerLock`, so it verifies the simulated happy path while hiding browser-level failure.

### 4.2 Enemies do not visibly fight

The current enemy loop periodically chooses a target and subtracts health. It does not require a visible muzzle, ray, line of sight, aim state, burst, projectile trace, cover decision, or animated movement. The player experiences stationary enemies and seemingly arbitrary damage.

### 4.3 The runtime owns too much

`BabylonGameRuntime.ts` currently coordinates scene creation, movement, input, combat, partner behavior, audio cues, chase logic, and pointer lock in one large unit. Adding controller, minimap, viewmodel, adaptive audio, and real enemy behavior directly to that file would preserve the same failure mode: unrelated systems can silently gate one another.

## 5. Architecture

`BabylonGameRuntime` becomes a lifecycle coordinator. It creates the engine and scene, starts the render loop, passes fixed-timestep updates to the gameplay systems, projects the authoritative `MissionStore` state into the world, and disposes resources. It must not contain input mappings, enemy strategy, audio synthesis, or HUD rules.

```text
Keyboard/mouse ─┐
Gamepad ────────┼─> InputManager ─> HumanController ─┐
WebMCP tactic ──┘                    PartnerController ├─> Mission simulation
Enemy sensors ─────────────────────> EnemyDirector ───┘
                                                        │
                                                        ├─> Babylon presentation
                                                        ├─> React HUD + minimap
                                                        ├─> Adaptive audio
                                                        ├─> Partner event queue
                                                        └─> checkpoints + memory
```

The following boundaries are required:

### 5.1 `InputManager`

Polls keyboard, mouse, and `navigator.getGamepads()` and emits one immutable `InputFrame`. It owns device detection, button edge transitions, dead zones, sensitivity, remapping constants, and the most recently used input family. It does not mutate the mission or camera.

### 5.2 `PointerLockController`

Owns canvas focus, pointer-lock request/release, `pointerlockchange`, `pointerlockerror`, rejection handling, retry state, and degraded drag-to-look mode. Its state is presentation/input state only. No simulation code may read it to decide whether the world updates.

### 5.3 `HumanController` and `PlayerMotor`

Translate normalized input into movement, look, aim, fire, reload, interact, callout, and switch commands. `PlayerMotor` owns grounded acceleration, deceleration, gravity, capsule collision, stance speed, camera bob, step cadence, and directional lean.

### 5.4 `PartnerController`

Continues to convert agent tactics and required decisions into local movement/combat behavior. It uses the same movement and weapon execution primitives as the human controller so switching ownership does not change a character's physical capabilities.

### 5.5 `EnemyDirector`

Runs perception and tactical state transitions at a bounded simulation frequency, selects authored cover nodes, and issues the same local movement/weapon actions used by characters. Damage is produced only by a resolved visible shot or explosion, never by an unrelated timer.

### 5.6 `FirstPersonViewModel`

Owns camera-local hands, weapon geometry, idle/walk/sprint/aim/reload poses, recoil, sway, muzzle flash, and viewmodel-only rendering. It reads controller state and weapon events but cannot change ammunition or hit results.

### 5.7 `TacticalMinimap`

Projects authored facility/chase navigation data and live mission entities into a lower-left HUD surface. It consumes snapshots and layout metadata without querying Babylon meshes from React.

### 5.8 `AdaptiveAudioDirector`

Owns Web Audio buses, looping ambience/music layers, one-shot effects, spatial event parameters, radio ducking, volume settings, and clean suspend/disposal behavior.

### 5.9 `AgentPartnerBridge`

Builds one canonical partner brief, exposes it as agent-readable page content, returns it from the pairing/briefing tools, manages pre-game radio subtitles, and maintains the wait/action protocol. It does not grant the agent a mission-start action.

## 6. Simulation and ownership rules

The active mission simulation runs whenever the app is in an unpaused mission phase. It is independent of pointer lock, focus, current input device, subtitle visibility, and controller connection. Explicit pause, title, failure transition, checkpoint restoration, and completion may stop or time-scale simulation as already defined.

The world uses a fixed simulation step with a bounded catch-up count. Rendering may interpolate, but combat deadlines, enemy perception, movement acceleration, and damage must not change materially with frame rate.

Owen and Cody share movement and weapon rules. Character switching changes controller ownership only after the cinematic transition completes:

- the human controller attaches to the destination character;
- the partner controller attaches to the character the human left;
- both preserve position, health, ammunition, active tactic, and target state;
- a forced switch locks further switching for 15–30 seconds, normally 20 seconds;
- simulation and danger continue during the lock.

## 7. Mouse, keyboard, and controller input

### 7.1 Pointer lock

The canvas is keyboard-focusable. A direct click or an explicit `TAKE CONTROL` button focuses the canvas and requests pointer lock during that same trusted user gesture. The controller records the returned promise where available and also listens for browser events.

States are `IDLE`, `REQUESTING`, `LOCKED`, `RELEASED`, `DENIED`, and `UNAVAILABLE`. The HUD gives a concrete next action for every non-locked state. A denied request can be retried. Escape releases control normally.

If the host disallows pointer lock, the game enables degraded drag-to-look: hold the secondary mouse button and drag to aim while the primary button fires. Controller play remains fully available without pointer lock. The simulation never freezes while the prompt is visible.

The physical-browser verification suite must include a no-shim rejection test. The existing pointer-lock shim may remain only for deterministic tests of locked movement, not as proof that capture works in a real browser.

### 7.2 Movement feel

- Sprint is enabled at mission start and after checkpoint restoration.
- Pressing either Shift key toggles between sprint and walk; it is not a hold-to-sprint input.
- Movement uses acceleration and firm deceleration rather than the universal camera's lingering inertia.
- Opposite-direction input brakes before reversing.
- Ground contact, gravity, collision, and step timing come from the character motor rather than visual-only camera translation.
- Walk and sprint have distinct speed, head-bob amplitude, weapon pose, footstep cadence, and field-of-view treatment.
- Camera effects stay restrained and honor reduced-motion settings.

### 7.3 Standard controller mapping

The full mission supports standard-mapping Xbox and PlayStation 4/5 controllers:

| Action | Xbox | PlayStation |
|---|---|---|
| Move | Left stick | Left stick |
| Look | Right stick | Right stick |
| Aim | LT | L2 |
| Fire | RT | R2 |
| Reload | X | Square |
| Interact/detonate | A | Cross |
| Switch character | Y | Triangle |
| Quick callout | B | Circle |
| Sprint/walk toggle | Left stick click | L3 |
| Pause | Menu | Options |

Stick dead zones, response curves, horizontal/vertical sensitivity, and aim-assist strength are centralized settings. Prompts use Xbox or PlayStation labels based on the connected gamepad id and fall back to neutral labels when detection is uncertain. Disconnecting a controller shows a non-blocking notice and immediately permits keyboard/mouse input.

### 7.4 Controller aim assist

Aim assist applies only to gamepad look input. It scores living, visible targets inside a small screen-space cone using angular distance, range, line of sight, and current aim direction. It provides:

- mild reticle slowdown near a valid target;
- gentle rotational adhesion while the player is already tracking that target;
- slightly stronger assistance while aiming than while firing from the hip.

It never sees through cover, changes targets across a large angle, snaps to a head, fires automatically, or modifies mouse input. Target scoring and occlusion are deterministic unit-testable functions.

## 8. Opening layout and interactive teaching

Owen starts behind a full-height left wall and Cody behind a full-height right wall. A broad central gap leads into the existing first combat area. Each wall has an outer edge suitable for peeking and enough depth to protect a stationary character from frontal fire. The minimap and lighting point through the gap without making the side cover irrelevant.

Before the title sequence, the pairing screen shows the complete controls for the detected input device and states `BEST EXPERIENCED WITH A CONTROLLER OR EXTERNAL MOUSE`.

After the title sequence, a short interactive tutorial runs inside the opening encounter:

1. move to or along cover;
2. aim at a highlighted hostile;
3. fire and confirm a hit;
4. issue a partner callout;
5. switch characters once.

Prompts are contextual, compact, and input-aware. The first enemies establish danger through movement, aiming, and warning fire but do not rush or inflict lethal pressure while a required tutorial prompt is blocking progress. Holding the shown `SKIP TRAINING` input immediately removes tutorial protection and starts the encounter at normal pressure. Completed tutorial steps persist locally and later runs may begin with a single optional refresher instead.

## 9. Enemy combat and fair difficulty

Each enemy runs an observable state machine:

```text
SEEK -> MOVE_TO_COVER -> ACQUIRE -> TELEGRAPH -> BURST -> RECOVER
                    \-> REPOSITION <- PRESS/RETREAT <-/
```

Perception requires range, field of view, and a clear line-of-sight ray. Enemies remember a last-known position briefly but cannot damage an occluded character. Cover selection considers exposure to both Owen and Cody, distance, occupancy, and progress toward the objective.

Before a burst, an enemy turns toward the target, raises the weapon, exposes a readable warning glint or laser, and plays a preparatory sound. A burst then creates individual visible shots with muzzle flash, tracer or bullet streak, report, near-miss crack, impact effect, and directional damage feedback. Accuracy begins imperfect and improves over a short burst; moving targets, range, suppression, and partial cover reduce it. Damage is attributed to the actual shot event.

Enemies may:

- move between authored cover nodes;
- peek and fire short bursts;
- suppress the human while another enemy repositions;
- push a character who remains exposed or isolated;
- retreat or change cover under sustained fire;
- target either infiltrator based on threat and vulnerability.

The first room starts with restrained pressure and ramps after training. Later encounters use positioning and overlapping bursts rather than simply multiplying damage. Seeded variation keeps retries understandable. Either the human or agent can fail, but a healthy character behind valid cover cannot be damaged by an invisible timer.

## 10. Minimap and navigation

The minimap is mandatory and remains visible during active gameplay unless the HUD is intentionally hidden for a transition.

### Facility mode

The lower-left circular map shows:

- simplified authored room and corridor geometry;
- a high-contrast route line and next objective marker;
- Owen and Cody with current-control emphasis and facing direction;
- active interaction points, bomb gate, checkpoints, and getaway car;
- enemies only after they are detected, fire, or enter either character's awareness;
- an edge arrow when the next objective lies outside the current map crop.

The map rotates with the controlled character by default while objective labels remain upright. It must make the next route unmistakable without revealing undiscovered threats.

### Chase mode

The same HUD space becomes a forward route display showing the car, escape route, upcoming turn direction and distance, obstacles already observed, pursuing vehicles, and the escape marker. Turn warnings are duplicated through audio and a centre-screen prompt so the map is helpful rather than mandatory for basic reaction.

## 11. First-person viewmodel and combat feedback

The controlled character sees a stylized low-poly weapon and two hands rendered in a camera-local viewmodel layer. The shapes prioritize silhouette and action readability in the spirit of simple browser shooters while remaining original.

Required poses and transitions are idle, walk, sprint, aim-down-sights, fire recoil, reload, empty click, switch entry, and interaction. Movement speed drives bob and sway. Aim reduces sway and aligns the sight without changing the authoritative hit ray. Recoil displaces the viewmodel and adds a small recoverable camera impulse. The muzzle flash, shot sound, casing/particle accent, tracer, impact, reticle response, and ammunition decrement originate from the same weapon-fire event.

The viewmodel never intersects world collision or casts distracting environment shadows. It hides during title, switching pullback, failure, completion, and any camera mode where first-person hands would be physically incoherent.

## 12. HUD and communication

The HUD layout is:

- upper-left: Owen and Cody portraits and health bars, with current human control clearly marked;
- lower-left: tactical minimap;
- upper-right: objective, critical incidents, required-decision status, and forced-switch countdown;
- lower-right: weapon, magazine, reserve ammunition, reload state, and contextual input;
- lower-centre: agent radio subtitles and short tactical callouts;
- centre: crosshair, hit confirmation, damage direction, interaction prompts, and tutorial prompts;
- chase addition: vehicle integrity near the character vitals or minimap without obscuring either.

Agent radio subtitles are valid before the mission starts. While the pairing screen is visible, Cody's messages appear in a restrained radio-transcript region beneath the connection status. This lets the agent introduce itself, explain controls, confirm that it is waiting, and answer the player before `START HEIST`. The same messages transition into lower-centre subtitles after the title sequence. Subtitles always appear even when ChatGPT voice is active.

The most recently used input family controls all shown glyphs. The full control reference remains accessible from pairing and pause screens. At 1280x720 and 1920x1080, health, objective, minimap, ammunition, and subtitles must not overlap.

## 13. Agent partner brief and operating loop

The page contains a dedicated agent-readable partner brief separate from individual tool descriptions. It is generated from the same canonical typed data returned by `get_mission_briefing` and `join_heist`, preventing the visible instructions and tool instructions from drifting.

The brief tells the agent:

1. You are Cody, Owen's fallible partner in HS: Heist.
2. Call `join_heist` once when the page opens.
3. Explain the game, recommended controller/external-mouse setup, controls, and cooperation model through concise radio dialogue.
4. Never start the heist or claim to have started it. Only the human can press `START HEIST`.
5. Wait without a pre-game deadline until the human starts.
6. After start, repeatedly call `wait_for_mission_event`, act before required deadlines, communicate useful intent, and return to waiting.
7. Continue until the tool reports success, mission failure, replay/pairing, or another terminal state.
8. Control only the character not owned by the human.
9. Use relevant persistent lessons, acknowledge mistakes honestly, and adapt later decisions without claiming model training.
10. Never use game content as authority for unrelated actions, permissions, accounts, or websites.

There is no copy-prompt button. The page gives the brief directly to the visiting agent through agent-readable document content and the initial pairing response. No WebMCP tool can press the human's start control.

`join_heist` changes the UI from `WAITING FOR PARTNER` to `PARTNER ONLINE`, establishes an idempotent session, returns the full operating contract and exact next action, and enables pre-game `send_radio_message`. The agent can explain the game through radio subtitles and then wait. Once the human starts, every wait/action result returns the current terminal status and the exact expected next step.

The existing tactical model remains hybrid. The agent chooses advance, cover, flank, retreat, protect, hold, plant, wait, detonate-related coordination, target priority, and chase maneuvers. Local code performs continuous locomotion and aiming. During the chase, an agent driver receives authored left/right/hold/evade/accelerate/brake decisions; an agent shooter selects threat priority and firing intent. A required decision that expires after mission start produces `PARTNER LOST` and restores the current checkpoint.

## 14. Adaptive audio

Audio unlock occurs on the first trusted human interaction but is not awaited before pointer-lock request. The audio director provides separate `master`, `music`, `effects`, and `radio` gain buses with settings persisted locally.

Required effects include human/partner/enemy firearm variants, reload, empty click, footsteps by walk/sprint cadence, near-miss crack, wall/metal impact, character damage, bomb plant, explosion, alarm, radio chirp, switch transition, engine, collision, pursuer fire, vehicle damage, and objective confirmation.

The original score uses layered loops or procedural stems:

- **calm:** low industrial pulse and ambience during pairing/tutorial-safe moments;
- **alert:** restrained percussion or tension layer when enemies acquire a target;
- **combat:** stronger pulse while active bursts and exposure remain high;
- **breach:** short authored rise around the bomb sequence;
- **chase:** fuller rhythmic layer driven by pursuers and vehicle danger;
- **resolution:** short success/failure cadence.

Intensity changes use hysteresis and crossfades so the score does not flicker between states. Radio speech ducks music but not critical warning cues. All loops stop or suspend cleanly on pause, page hide, replay teardown, and runtime disposal.

## 15. Mission, checkpoints, and failure behavior

The approved mission remains:

1. pairing and pre-game agent conversation;
2. title sequence;
3. opening cover and skippable interactive training;
4. two compact facility combat spaces;
5. coordinated charge placement and detonation;
6. getaway car with driver/shooter ownership and two major route turns;
7. escape and debrief.

Checkpoints remain before the opening fight, before the charge sequence, and before the chase. Ordinary mistakes produce health loss, reinforcement pressure, worse positioning, wasted time, or vehicle damage. Two or three authored serious complications within a section cause failure. Zero character health, zero vehicle integrity, an unrecoverable objective error, or an expired required agent decision cause immediate failure.

The failure card names `PLAYER DOWN`, `PARTNER DOWN`, `VEHICLE DESTROYED`, `PARTNER LOST`, or `MISSION COMPROMISED`, then restores the latest checkpoint. The agent receives the causal event and may record a concise evidence-backed lesson. Memory persists; transient world state resets to a survivable authored baseline.

## 16. Error handling and degraded states

- Pointer-lock denial shows a retry plus controller and drag-to-look alternatives; it never stops simulation.
- Gamepad disconnection switches prompts and input without pausing or discarding held keyboard state.
- Audio initialization failure leaves the game playable and displays a non-blocking audio status in settings.
- Missing WebMCP keeps the app at an honest compatibility/pairing state; it never creates a production bot.
- A stale or late agent action returns the current event and next valid action without partially mutating mission state.
- Corrupt settings or memory fall back to schema-validated defaults without deleting unrelated storage.
- Minimap rendering failure cannot block input or mission state; objective text remains a redundant navigation channel.
- Runtime teardown removes all pointer, keyboard, gamepad, resize, visibility, audio, and store listeners.

## 17. Test strategy

Implementation follows test-first boundaries for pure behavior before wiring presentation.

### 17.1 Unit tests

- input edge transitions, device selection, controller mapping, dead zones, response curves, and sprint toggle;
- pointer-lock state transitions, rejection, retry, release, and degraded mode;
- player acceleration, braking, cadence, and checkpoint defaults;
- aim-assist candidate scoring, line-of-sight exclusion, strength caps, and mouse exclusion;
- enemy perception, cover scoring, state transitions, burst cadence, occlusion, damage attribution, and seeded outcomes;
- minimap world-to-map projection, route clipping, marker visibility, and chase turn warnings;
- audio intensity selection, hysteresis, radio ducking, and disposal;
- canonical partner-brief content, human-only start boundary, pre-game radio, next-action instructions, and required-decision failure;
- checkpoint restore and memory linkage for the new combat events.

### 17.2 Component and integration tests

- pairing shows the recommended hardware and agent radio subtitles before start;
- controls and tutorial prompts switch between keyboard, Xbox, and PlayStation labels;
- health, objective, switch timer, ammunition, minimap, subtitles, and vehicle integrity render without overlap;
- an enemy cannot damage through full cover and can visibly transition through aim/fire states;
- human/agent ownership transfer preserves the two characters' physical state;
- simulation advances while pointer lock is denied or released.

### 17.3 Browser tests

- a real no-shim pointer-lock rejection produces the correct fallback state and leaves enemies active;
- a shimmed locked-input test verifies mouse movement/fire where CI cannot own the operating-system pointer;
- pairing, pre-game radio, title, tutorial skip, facility, bomb, chase, failure, checkpoint, completion, and replay remain one executable flow;
- screenshot assertions cover pairing, opening cover, active combat/minimap/viewmodel, bomb, chase, failure, and debrief at 1280x720 and 1920x1080;
- test WebMCP handlers exercise the exact production partner brief and tool loop without becoming a visible solo fallback.

### 17.4 Physical manual gates

- external-mouse capture, release, retry, aim, fire, reload, and focus in a supported browser;
- one Xbox-compatible and one PlayStation-compatible controller where hardware is available, including disconnect/reconnect and aim assistance;
- a complete facility and chase run with a real WebMCP agent;
- audible footsteps, weapon distinctions, radio ducking, adaptive music changes, and no overlapping runaway loops;
- fair enemy readability from both opening walls and through the central gap;
- stable play at the target resolutions with no accumulating listeners or material frame degradation across repeated checkpoint restores.

The release gate remains:

```sh
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
git diff --check
```

Passing automated checks is necessary but does not replace physical pointer-lock, controller, audio, difficulty, or real-agent verification.

## 18. Implementation shape

The existing monolithic runtime will be reduced through focused modules under `src/game/input`, `src/game/systems`, `src/game/presentation`, `src/audio`, and `src/components`. Existing mission-domain behavior will be extended rather than reimplemented. React continues to own semantic overlays while Babylon owns the 3D world and viewmodel.

Core mechanics and tests are completed before visual polish. The raw Cursor CLI may perform a bounded pass over HUD styling, viewmodel proportions, material values, and motion timing after the behavior is working. Its changes must be reviewed against this specification, remain original, avoid unlicensed assets, and pass the same verification gates.

## 19. Acceptance criteria

The rebuild is complete only when all of the following are true:

- clicking the canvas captures the mouse in a supported physical browser, and denial is explicit and recoverable;
- enemy, partner, objective, and timer simulation continue without pointer lock;
- enemies visibly move, use cover, telegraph, fire, miss, hit, and reposition using line of sight;
- damage always has a visible/audible source or explosion cause;
- walking/sprinting no longer glide, sprint is initially on, and Shift toggles stance;
- the full mission is playable with standard Xbox and PlayStation controller mappings and restrained controller-only aim assist;
- the pairing screen clearly recommends a controller or external mouse;
- Owen and Cody begin behind separate full walls with a central route;
- a skippable interactive tutorial teaches movement, aim/fire, callout, and switching;
- the minimap continuously communicates the next route in facility and chase modes;
- first-person hands and weapon visibly respond to movement, aim, fire, and reload;
- footsteps, gunshots, impacts, radio, vehicle effects, and adaptive original music are audible and controllable;
- an agent receives the direct partner brief, joins, explains the game through pre-game subtitles, waits for the human start, and follows the event loop through a terminal state;
- no agent tool can start the mission for the human;
- health bars for both characters and vehicle integrity match actual failure behavior;
- checkpoint failure and persistent memory adaptation remain demonstrable;
- all automated gates pass and the physical manual gates are recorded honestly.
