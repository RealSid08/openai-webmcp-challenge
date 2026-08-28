# Hackathon Build Notes

## 2026-08-28 — Guided Ideate started

- The participant chose the optional guided build path after reviewing the official rules and resources.
- Initial direction: a human and Codex inhabit two characters, with perspective switching between them and Codex controlling the off-perspective character.
- Active shaping: the participant corrected the description “GTA with Codex.” GTA is an inspiration only for seamless character-perspective switching, not the intended genre or scope.
- The participant wants to compare this direction with other ideas that could win before committing.

### Round 1 answers

- The game concept is potentially first-person and implemented with Three.js or a better-fitting web stack. It would have stages that shift the human between the two character perspectives; Codex controls the character not currently controlled by the human.
- Other possibilities include tic-tac-toe, chess, Ludo, and other human-versus-Codex games, but the participant is deliberately keeping the idea search open.
- The participant has roughly 1.5–2 years of experience with Codex, Cursor, Claude Code, Gemini CLI, Antigravity, and other coding agents, and considers agent orchestration a particular strength.
- Technical strengths include TypeScript, Swift, React, React Native, Convex, Cloudflare, Vercel, and PostgreSQL.
- Explicit preference: judge ideas realistically and critically; do not soften weak evaluations.

### Round 2 answers so far

- “Asymmetric escape or heist” matches what the participant had in mind.
- The participant has built with a 3D or game-engine stack before.
- The desired emotional core is uneasy trust rather than straightforward cooperation or competition.
- The agent partner should learn the game by failing over time. At the same time, the human should learn the partner's weaknesses and adapt plans around them.
- Design constraint: implement learning as explicit, inspectable, persistent game memory and changed strategy. Do not misrepresent it as model training.
- Partner learning should persist across the entire game history using localStorage.
- Mistakes should produce recoverable complications rather than immediate mission failure.
- The two-character relationship combines two physical infiltrators during the facility escape with thief/getaway-driver roles during the chase.
- Switching should support both human-initiated free switching and designed story moments.
- New sequence concept: escape a facility, reach a getaway car, then split responsibilities between driving and shooting at pursuing police.
- Implementation preference: Codex remains the primary builder alongside the participant. Cursor CLI with Opus 5 or Grok 4.6 High non-fast can assist with visual, UI, or game-specific work.
- Tentative technical recommendation to discuss: React/Vite shell with Babylon.js for the 3D game. Babylon.js is favored over raw Three.js or React Three Fiber because the concept needs integrated game-engine facilities, while the surrounding HUD and WebMCP surfaces can remain ordinary React.
- Scope warning: full stealth, free driving, gunplay, companion AI, two-character switching, persistent learning, and WebMCP would be several games' worth of systems. A credible hackathon slice must simplify the chase and restrict the facility to one compact scenario.

### Round 3 answers and active shaping

- The participant proposed making the partner's persistent history feel like a literal game-memory Markdown file rather than an invisible database. Implementation boundary: keep canonical structured lessons in local browser storage and deterministically render them as an inspectable/exportable `partner-memory.md`; a browser cannot silently write an arbitrary local file without a permission flow.
- Failure handling is mixed rather than endlessly recoverable: minor errors create complications, while two or three critical failures in different mission beats lead to a checkpoint restart. Partner memory persists through those restarts so the next attempt can visibly change.
- The compact facility sequence is now concrete: move through two rooms with enemies, then reach an end gate where one infiltrator plants a bomb and the other must detonate it. Both perspectives need opportunities to cause, notice, and recover from failures.
- The desired checkpoint candidates are facility start, after the first major room, and the transition into the getaway-car chase. The exact number will be finalized during scope.
- Babylon.js with a React/Vite shell is now the agreed technical direction.
- Character switching is freely available during ordinary play. At designed moments the game forces a perspective and locks both roles for 15–30 seconds, creating a temporary period where the human must live with what the agent does in the other role.
- The atmosphere reference is GTA V's prologue: tense, cold industrial crime-thriller energy. The switching reference is GTA V's character transition. These are directional references only; the project will use original assets, branding, characters, audio, and visual execution.
- Agent communication should be diegetic: short radio callouts appear as subtitles in the game HUD, with speaker identity and a communications treatment. Subtitles are always present. ChatGPT Voice can optionally speak during a voice task, but official OpenAI documentation does not establish a page-level API for detecting or controlling ChatGPT Voice, so voice cannot be a gameplay dependency.
- The WebMCP design should include an explicit radio-message tool or a `radioLine` argument on partner-action tools so the same agent-authored line can be shown inside the game, rather than hoping the page can capture ChatGPT's later natural-language response.
- The participant asked what “which moment should open the demo” meant. It refers to the first 10–20 seconds of the under-three-minute judging video: the cold open that communicates the project's thesis before setup or explanation. Current recommendation is to show a forced switch immediately after the agent creates a recoverable problem, then cut to the next attempt where its visible memory changes the behavior.

### Candid scope assessment after ideation

- The facility slice is realistic for the hackathon if enemy combat is intentionally simple and the partner chooses from high-level actions rather than controlling movement frame by frame.
- The getaway chase is still the largest execution risk. It should be an arcade or on-rails set piece with lane or steering choices, not an open driving simulation.
- The differentiator is not the amount of combat. It is the inspectable loop: agent action, consequence, recorded lesson, changed later behavior, and human adaptation. Every mission beat should serve that loop.

## 2026-08-28 — Scope interview started

- Active shaping: the participant rejected the proposed failure-first demo opening. The game should instead open cinematically with `RealSid Games Presents`, then a large centered `HS` with `Heist` beneath it, fade to black, and begin at a coherent in-world starting point.
- Both infiltrators require visible health bars throughout play. Either character being eliminated can fail the mission.
- The getaway vehicle has its own damage state and can be destroyed by pursuing enemies shooting from behind.
- Active shaping: the participant clarified that the chase should resemble the tightly authored structure of GTA V's opening mission: one path with approximately two directional turns, not an open or general-purpose driving system.
- Difficulty target: moderate and fair for both the human and agent. Neither participant should receive a trivial role. The game needs enough pressure and uncertainty for either to fail, while keeping success learnable rather than punishing or absurd.
- Adaptation remains the purpose of failure: agent mistakes update persistent memory and later behavior, while the human learns the agent's limitations and changes how they coordinate.
- Title timing clarified: `RealSid Games Presents` appears alone on black, then slightly and quickly fades into the centered `HS` / `Heist` lockup before the final fade to the game.
- The participant approved opening inside the locked-down facility with both infiltrators behind cover and the escape already underway.
- The participant does not want the schedule to constrain ideation and expects an aggressive sprint. Scope response: do not block on an hourly estimate, but still prioritize a complete vertical slice before any stretch features because the external deadline remains fixed.
- `HS: Heist` remains a working title and visual lockup, not a frozen final name.
- Inspiration judgment delegated to Codex. Recommendation: *The Last Guardian* should dominate the non-GTA relationship design because its emotional engine is learning how to cooperate with a capable but imperfect partner. *Keep Talking and Nobody Explodes* should influence only the bomb gate's asymmetric information and timing pressure.
- The hybrid partner-control boundary is approved: Babylon owns locomotion, pathfinding, aiming, animation, and continuous execution; Codex owns tactical intent and meaningful decisions.
- During the chase, Codex also receives explicit left/right steering actions. These are discrete lane, obstacle, and authored-turn decisions; the engine interpolates the vehicle movement rather than requiring the agent to output analog steering every frame.
- Human-to-agent coordination uses both channels: rich natural-language direction through ChatGPT voice/text and immediate in-game tactical callouts such as `cover me`, `wait`, and `move`.
- Runtime target approved: approximately 8–10 minutes for a successful full run, with checkpoint retries lasting roughly 2–4 minutes.

### Approved scope cut

- Build one replayable mission only: title sequence, facility lockdown, two combat spaces, cooperative bomb gate, exterior transition, and authored chase.
- Keep one basic weapon behavior, a small enemy roster, two infiltrator health bars, vehicle health, checkpoints, character switching, forced role locks, radio subtitles, quick callouts, WebMCP tactical tools, and persistent inspectable partner memory.
- Cut open-world exploration, general-purpose driving, procedural levels, online multiplayer, accounts or cloud saves, inventory or loot systems, multiple missions, elaborate stealth simulation, weapon progression, character customization, and long cinematics.
- Target user recommendation: a player who enjoys short action games and is curious whether an imperfect AI teammate can become understandable and useful over repeated attempts. The product should feel like a game first and an agent demonstration second.

### Scope document completed

- The participant approved the proposed cut with: “just write it this sounds good.”
- Optional scope deepening rounds taken: 0.
- Created `docs/hackathon-build/scope.md` from the approved decisions.
- The working title remains `HS: Heist`; it is intentionally not persisted as the final project name yet.
- The next guided-build stage is the PRD, which will translate this scope into explicit user-facing requirements and acceptance criteria.

## 2026-08-28 — PRD interview started

- The approved scope is now fixed. PRD questions will define player-visible behavior and testable outcomes without adding new systems or choosing implementation details.
- First-run pairing is approved: a minimal black screen shows `WAITING FOR PARTNER`, tells the player to ask ChatGPT/Codex to join, changes to `PARTNER ONLINE` after the agent joins, and only then enables `START HEIST`.
- The agent is required. There is no solo-practice mode in the submission scope.
- Controls use both layers: a compact first-run overview plus one-time contextual prompts when an action first becomes relevant.
- HUD placement is approved: both portraits and health bars at upper-left; objective and switch-lock timer at upper-right; weapon state at lower-right; radio subtitles and quick callouts at lower-centre.
- Failure presentation is approved: show a two-second cause card (`PARTNER DOWN`, `PLAYER DOWN`, `VEHICLE DESTROYED`, or `MISSION COMPROMISED`) and then automatically restore the latest checkpoint.
- Character names approved: **Owen “Aye” Mercer** and **Cody “X” Vance**. Spoken together, the names hide the OpenAI/Codex joke while `OWEN` and `CODY` remain credible HUD and dialogue labels.
- Character switching behavior approved: a 1.5–2 second cinematic transition, heavy world slowdown, temporary protection from damage, a short normal-switch cooldown, and a visible countdown during forced locks.
- Memory experience approved: the read-only partner memory is available from pairing, pause, and debrief screens; opening it pauses gameplay; it can be exported; and new lessons produce a small `MEMORY UPDATED` notification rather than an interrupting modal.
- Completion experience approved: escape fades to black, displays `HEIST COMPLETE`, then shows character survival, vehicle integrity, checkpoint failures, lessons added, changed tactics, and `REPLAY HEIST`.
- Active shaping: the participant rejected pausing for an overdue required agent decision. If the agent misses a required decision deadline, that is a mission failure, shown as `MISSION COMPROMISED`, followed by automatic restoration of the latest checkpoint.

### PRD document completed

- The participant approved the mandatory PRD decisions and instructed: “write the prd and then after approval go ahead with building it fully.”
- Optional PRD deepening rounds taken: 0.
- Created `docs/hackathon-build/prd.md` with player-facing epics, user stories, acceptance criteria, edge cases, non-goals, persistence behavior, and submission proof points.
- Product assumptions made explicit for approval: Cody is the bomb planter, Owen is cover/detonator; normal firearm friendly fire is disabled while bomb damage affects either character; critical incidents are shown as a count out of three; local memory can be exported or deliberately reset; a page reload requires agent re-pairing before checkpoint continuation.
- No game code has been created yet. After PRD approval, continue through the technical spec and build checklist before full implementation.

## 2026-08-28 — Technical specification completed

- The participant approved the PRD and the full guided sequence with: “yep go ahead, implement thoroughly.” This is treated as authorization to complete the technical spec, checklist, implementation, and proportionate verification without repeated routine approval pauses.
- Optional spec deepening rounds taken: 0. Existing interviews already resolved the user-facing and architectural choices, and the participant explicitly delegated remaining technical judgment.
- Researched the current primary WebMCP sources before freezing the design: OpenAI Site tools, the WebMCP draft specification, and Chrome's developer guide.
- Key host constraint recorded: the top-level page can expose asynchronous tools, but the page cannot summon or autonomously continue Codex. The runtime therefore uses a visible, agent-driven long-poll event/action loop with bounded heartbeats and genuine missed-decision failure.
- Key compatibility constraint recorded: ChatGPT's built-in browser supports top-level imperative JavaScript registration, not declarative form tools or iframe tool discovery.
- Chose Babylon.js 9 with authored waypoint movement rather than runtime navmesh generation. The complete mission is compact and fixed; authored nodes are more deterministic, lighter, and easier to tune for fair failure.
- Chose a static client-only architecture with no API keys or backend. Checkpoints and structured Markdown-rendered partner memory persist locally.
- Active shaping preserved: no scripted production partner fallback, no frame-by-frame agent control, no claim of model training, and no dependency on detecting ChatGPT Voice.
- Created `docs/hackathon-build/spec.md` with stack, boundaries, tool contracts, data flow, file structure, risks, verification, and demo flow.

## 2026-08-28 — Autonomous build checklist completed

- The participant handed off planning and implementation, requested a thorough build, and authorized necessary research. Build mode is autonomous with a straight run to the complete MVP and no routine visual approval pauses.
- Optional checklist deepening rounds taken: 0 on the handoff path.
- Existing answers resolve the checklist-only participant questions: the wow moment is the visible failure → Markdown lesson → lesson-cited changed tactic loop, and the participant prefers an aggressive uninterrupted sprint.
- The checklist keeps risky foundations early: deterministic mission rules, persistence/memory integrity, and the real WebMCP event loop precede expensive scene polish.
- Twelve implementation items cover the scaffold, domain, persistence, WebMCP, UI, facility, combat/switching, bomb gate, chase, adaptation/debrief, release verification, and Devpost handoff.
- Created `docs/hackathon-build/checklist.md`. The checklist is the execution contract for the build.

### Build adaptation — supported TypeScript line

- Initial dependency resolution rejected TypeScript 7 because the current TypeScript-ESLint release declares support below TypeScript 6.1.
- Pinned TypeScript 6.0.3 instead of bypassing peer validation. This preserves the strict typed architecture and keeps the lint toolchain within its supported contract.

### Participant correction — Oxlint and TypeScript 7

- The participant explicitly preferred Oxlint with TypeScript 7 over lowering TypeScript for TypeScript-ESLint compatibility.
- Replaced ESLint/TypeScript-ESLint with Oxlint 1.80.0 and restored TypeScript 7.0.2. This removes the peer conflict rather than bypassing it.
- The participant also explicitly required Cursor CLI rather than Cursor's MCP tools. Future Cursor visual work will run through the local CLI with a non-fast Opus 5 model; Codex keeps integration and verification ownership.

### Verified scaffold and partner foundation

- Used the raw Cursor CLI with `claude-opus-5-high` for a bounded visual-only pass over the application shell, pairing screen, and CSS. Codex reviewed and integrated the result; no Cursor MCP was used for that work.
- Implemented the deterministic mission store, three authored checkpoint baselines, separated checkpoint persistence and structured partner memory, the sequenced partner coordinator, and ten top-level imperative WebMCP tool definitions.
- The initial pairing design was browser-checked across wide, 1280×720, short, narrow, keyboard-focus, and reduced-motion states.
- Verification at this checkpoint: `npm run lint`, `npm run typecheck`, all 28 Vitest tests, and `npm run build` pass.
- Checklist item 1 is complete. Items 2–5 remain open until their remaining runtime and screen integration is complete.

## 2026-08-28 — Autonomous build completed

### Product and game implementation

- Completed the deterministic mission domain with partner-required pairing, title/mission/failure/complete phases, both-character health/ammunition, three critical-incident failure, vehicle destruction, pause-aware decision deadlines, free/forced switching, three authored checkpoint baselines, replay, and isolated new-run history.
- Completed evidence-backed persistence: versioned checkpoint metadata, structured local lessons, consequential-event validation, deduplication, later-use linkage, deterministic Markdown rendering/export, and confirmed reset that does not erase checkpoints.
- Completed ten top-level imperative WebMCP tools and the real agent loop. Event waits are sequenced, bounded, abortable, and session-aware. Stale/expired decisions cannot mutate state, and no production fallback partner exists.
- Completed the cinematic React shell: waiting/online pairing, approved title sequence, contextual/complete controls, both-character HUD, timers, ammo, vehicle integrity, subtitles, quick callouts, pause/memory dialogs, two-second failure cards, cinematic switch treatment, and evidence-driven debrief.
- Completed the Babylon.js vertical slice: original procedural industrial facility, two combat encounters, bomb gate, human/agent tactics, firearm/reload/ray hits, collisions, first-person input, free switching, forced lock, night getaway route, two authored turns, pursuers, driver/shooter roles, car/character damage, and completion.
- Integrated original Web Audio cues for shots, impacts, alarm, explosion, radio, switching, and engine texture. Audio unlocks only after a user gesture.
- Implemented the requested controls rather than merely listing them: sprint, crouch, right-mouse aim, pointer lock, movement/look, fire/reload, interaction, callouts, pause, memory, and character switching.

### Cursor CLI usage and review

- Used the raw Cursor CLI only, never Cursor MCP, per the participant's explicit correction.
- A bounded Claude Opus 5 High CLI pass shaped the shell/pairing treatment. A later Opus runtime pass spent significant time researching but produced no edits and was terminated rather than trusted indefinitely.
- A raw `cursor-grok-4.6-high` CLI pass refined only the Babylon runtime and canvas styling: industrial architecture, lighting, procedural humanoids, cover, blast gate, road, getaway car, and pursuer cars.
- Codex did not accept the rewrite at face value. It found and fixed same-section checkpoint scenes not rebuilding, pre-tick stale snapshots, unfair agent turn evaluation, ignored target priority, unimplemented advertised controls, duplicated crosshair/shot paths, missing audio integration, immediate scene-entry damage, partner camera height, and the missing Babylon ray side-effect import.

### Strict maintainability pass

- The visual CLI pass pushed `BabylonGameRuntime.ts` above 1,000 lines. A thermo-nuclear maintainability review treated that as a blocker.
- Extracted procedural mesh/material construction into `RuntimeVisualFactory.ts`, reducing the runtime to 877 lines while keeping the visual implementation focused in a 256-line factory.
- Split the 1,801-line shared mission stylesheet into ordered HUD, overlay, debrief, and effects files, each below 800 lines, and centralized their imports in `App.tsx`.
- Kept chase fairness and targeting selection in small pure functions with dedicated tests rather than adding more one-off runtime branches.

### Verification and evidence

- Added pure tests proving agent-driver chase progress holds for an unresolved required turn and pursuer targeting honors exact ids, `CLOSEST`, `HIGHEST_THREAT`, live-target filtering, and safe fallback.
- Added a mission-store regression test proving a new run clears prior run history without discarding the existing partner session.
- Expanded the browser proof to cover actual pointer-lock request/event wiring, a fired shot and ammunition decrement, sprint/crouch/right-aim input, and a visible free perspective transition.
- A final repeated browser run exposed two timing-sensitive integration faults: mission deadlines depended on Babylon render frames, and collision setup relied on an implicit side effect. The app now ticks authoritative deadlines from its UI clock as well, and explicitly imports Babylon's collision coordinator. A dedicated render-loop-outage regression test protects the timing fix.
- A test-only pointer-lock host shim is necessary because headless Chromium cannot capture the operating-system pointer. Physical input feel remains a truthful final human-host check.
- The full end-to-end journey calls the real WebMCP tool handlers for pairing, bomb decisions, failure evidence, lesson recording, lesson-linked pursuer prioritization, checkpoint restore, completion, and debrief.
- Browser screenshots were visually inspected for the facility, rear-gunner chase, and debrief. Submission-ready compressed evidence copies are stored under `docs/hackathon-build/evidence/`.
- Final live Devpost data was refreshed through the Devpost Hackathons plugin: four judging criteria, complete submission fields, the working URL/public repo/text/video requirements, deadline, and zero current announcements. Nothing was created or submitted.

### Build outcome and remaining external proof

- All twelve checklist items are complete for the local proof of concept. The release remains deliberately unsubmitted.
- Created `docs/hackathon-build/submission-handoff.md` with the project story, WebMCP explanation, honest AI usage, judging alignment, screenshot shortlist, under-three-minute demo plan, and exact external blockers.
- A public repository, HTTPS deployment, real ChatGPT/Chrome WebMCP session, physical keyboard/mouse play-through, YouTube video, thumbnail, and explicit submission approval remain outside the local build and must happen before submission.
