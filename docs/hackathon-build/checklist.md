# Build Checklist

## Build Preferences

- **Build mode:** Autonomous. Codex runs the complete checklist and makes bounded implementation decisions from the approved PRD/spec.
- **Comprehension checks:** N/A. Explain important tradeoffs simply in progress updates and final handoff.
- **Git:** Initialize a repository, keep changes reviewable, and use logical verified checkpoints rather than committing broken intermediate states.
- **Verification:** Straight run to the complete MVP with automated verification at each risky boundary; no routine look-at-it pauses. Final browser and real-WebMCP limitations must be reported honestly.
- **Check-in cadence:** Speed-run. Send concise progress updates during long work; interrupt only for a genuine permission, identity, or external-service blocker.
- **Scope lock:** The approved single-mission vertical slice is authoritative. Visual polish may deepen it; no open world, extra mission, cloud backend, or production fallback partner may be added.
- **Wow moment:** A partner failure becomes a concrete Markdown lesson, then a later agent decision cites that lesson and visibly changes the outcome while the human adapts too.

## Checklist

- [x] **1. Scaffold the production and test toolchain**
  Spec ref: `spec.md > Stack`, `spec.md > File Structure`
  What to build: Initialize the Vite/React/TypeScript project, strict lint/type/test/build scripts, Babylon dependencies, Playwright configuration, base HTML metadata, MIT license, and repository hygiene.
  Acceptance: The page renders from a clean install, the production build succeeds, and the public repository can contain all source and an open-source license.
  Verify: `npm install && npm run typecheck && npm run test && npm run build`.

- [x] **2. Implement the deterministic mission domain**
  Spec ref: `spec.md > Architecture > 2. Mission domain and store`
  What to build: Typed state, commands, validation, immutable snapshots, event/action history, mission clock, pairing, phases, health, ammo, objectives, switching, critical incidents, failure precedence, checkpoints, and replay rules without React or Babylon dependencies.
  Acceptance: PRD Epics 1, 3, 4, 9, 11, and 12 have testable domain transitions; invalid/stale commands cannot partially mutate state.
  Verify: Unit tests cover happy paths, protection, third-incident failure, zero-health/vehicle precedence, pause-aware deadlines, checkpoint baselines, and replay.

- [x] **3. Build persistence and evidence-backed partner memory**
  Spec ref: `spec.md > Architecture > 6. Persistence and memory`
  What to build: Versioned safe local storage, checkpoint save/continue, structured lessons, evidence validation, deduplication, usage linkage, Markdown rendering/export, and confirmed memory reset isolated from settings/checkpoints.
  Acceptance: PRD Epic 10 and persistence edge cases pass; a lesson cites a real consequential event, survives reload, and can later be linked to a changed tactic.
  Verify: Vitest storage/migration/memory tests plus a generated Markdown snapshot.

- [x] **4. Implement the WebMCP partner loop**
  Spec ref: `spec.md > Architecture > 5. WebMCP bridge and event loop`, `spec.md > WebMCP Tool Contract`
  What to build: Top-level imperative tool registration, session idempotency, structured observations, sequenced event queue, abortable bounded wait, tactic/decision/target/radio/memory/debrief handlers, narrow JSON schemas, stale/late rejection, and a test-only driver that calls the exact handlers.
  Acceptance: PRD Epics 1, 5, 6, 7, 8, and 10 are represented by real tools; production cannot join or start through a scripted fallback.
  Verify: Handler/schema/cancellation tests; inspect tool definitions; manually invoke them through the test driver.

- [x] **5. Create the cinematic React shell and HUD**
  Spec ref: `spec.md > Architecture > 1. React application shell`, `spec.md > Visual And Interaction Direction`
  What to build: Compatibility/pairing screen, disabled/online start state, memory access, title sequence, controls overview/prompts, both-character HUD, objectives, decision/lock timers, ammo, car integrity, radio subtitles, callouts, pause, failure, and debrief screens.
  Acceptance: PRD Epics 1, 2, 3, 5, 9, 10, 11, and 12 are legible at 1280×720 and 1920×1080; keyboard focus and reduced-motion behavior are safe.
  Verify: Component tests, accessibility queries, and Playwright screenshots of each major UI state.

- [x] **6. Build the procedural Babylon facility and first-person controls**
  Spec ref: `spec.md > Architecture > 3. Babylon world adapter`, `spec.md > Components And Responsibilities > GameRuntime`
  What to build: Lazy Babylon runtime, industrial two-room facility and gate corridor, original materials/lighting/fog/props, collision, first-person movement/look, pointer lock, character meshes, authored cover/waypoint nodes, camera, and resize/disposal behavior.
  Acceptance: The mission opens with both infiltrators behind cover, the world is visually coherent/original, movement cannot leave the route, and pause/overlay states stop danger.
  Verify: Production browser smoke test, pointer/movement manual check, scene disposal test, and captured screenshots.

- [x] **7. Add combat, partner execution, and character switching**
  Spec ref: `spec.md > Architecture > 4. Hybrid partner controller`, `spec.md > Components And Responsibilities > EncounterDirector and CombatSystem`, `spec.md > Components And Responsibilities > SwitchDirector`
  What to build: One firearm, ray hits, reload/ammo, telegraphed enemy attacks, two waves, seeded behavior, partner tactic movement/targeting, quick callouts, radio feedback, human/agent ownership transfer, cinematic free switches, cooldown, forced locks, time compression, and transition-only protection.
  Acceptance: PRD Epics 3–6 pass in visible play; both characters can fail, agent tactics materially change the off-character, and switches preserve physical state without protection abuse.
  Verify: Unit/system tests plus a facility run using the test partner driver and manual aim/fire/switch QA.

- [x] **8. Implement the asymmetric bomb gate**
  Spec ref: `spec.md > Components And Responsibilities > BombSystem`
  What to build: Cody planter/Owen detonator roles, forced switch when required, 15–30 second lock, required plant decision, planting/interruption/abort/retreat, cover pressure, arming, readable safe distance, human detonation, explosion damage/effects, and gate transition.
  Acceptance: PRD Epic 7 and bomb edge cases pass; safe coordination succeeds, premature detonation can kill Cody, and a missed agent decision produces `MISSION COMPROMISED`.
  Verify: Automated safe/unsafe/timeout scenarios and one visible checkpoint retry through the gate.

- [x] **9. Implement the authored getaway chase**
  Spec ref: `spec.md > Components And Responsibilities > ChaseSystem`
  What to build: Exterior transition, car and seat roles, fixed forward route, two significant turns, lane/obstacle windows, human and agent `LEFT`/`RIGHT`/`HOLD`, rear shooter view, pursuers, target priority, incoming fire, character/car damage, chase switching, and escape trigger.
  Acceptance: PRD Epic 8 passes; poor choices worsen but do not leave the route, missed agent decisions fail, and either character or vehicle can be destroyed.
  Verify: Automated turn/timeout/damage/completion scenarios and a full chase run in Playwright/manual browser QA.

- [x] **10. Complete recovery, adaptation, and debrief loops**
  Spec ref: `spec.md > Data Flow > Failure and checkpoint restore`, `spec.md > Demo And Submission Flow`
  What to build: Exact two-second cause cards, automatic fair restores at all three checkpoints, reload/re-pair continuation, memory notifications, real lesson creation, lesson-informed changed tactic, complete escape transition, run debrief, and memory-preserving replay.
  Acceptance: PRD Epics 9–12 and all proof points pass; one repeatable failure→lesson→changed-action path is demonstrable without fabricated training claims.
  Verify: End-to-end test from pairing to failure/retry/completion/replay; reload persistence and exported Markdown inspection.

- [x] **11. Polish, optimize, document, and validate the release**
  Spec ref: `spec.md > Risks And Verification`, `spec.md > Technical Definition Of Done`
  What to build: Original procedural audio/effects, final visual hierarchy and motion, performance budgets, desktop compatibility, CSP/hosting headers as needed, README architecture/controls/WebMCP/testing/deployment guide, contribution/license metadata, and deployment configuration.
  Acceptance: The game feels like a coherent product, has no copied GTA assets/identity, starts cleanly for a judge, and accurately explains experimental host behavior and local data.
  Verify: `npm run lint && npm run typecheck && npm run test && npm run test:e2e && npm run build`; run `git diff --check`; inspect bundle; test a clean production preview; test live WebMCP in a supported host when available.

- [x] **12. Prepare Devpost handoff**
  Spec ref: `prd.md > Submission Proof Points`, `spec.md > Demo And Submission Flow`
  What to build: Gather the project story, live URL, public repo readiness, exact setup instructions, verification record, screenshot shortlist, under-three-minute demo shot list, WebMCP explanation, learning/adaptation proof, limitations, and built-with list.
  Acceptance: The participant has enough accurate material to run `$prepare-submission` without reconstructing the build story.
  Verify: Review the handoff materials against the official submission requirements and confirm the next command is `$prepare-submission`.
