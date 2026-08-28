# Project Scope

## Project Name Candidates

- **HS: Heist** — current working title and title-card lockup. The final name remains intentionally open to iteration once the game's identity is visible in motion.

## One-Line Summary

A first-person browser heist where the player switches between two infiltrators while a WebMCP agent controls the other, remembers consequential failures, and adapts its tactics across repeated escape attempts.

## Target User

The primary user is a solo player who enjoys short action games and is curious whether an imperfect AI teammate can become understandable, useful, and trustworthy through shared experience. The secondary audience is developers and hackathon judges exploring what agent-native interactive entertainment can feel like.

The experience must feel like a game first and an AI demonstration second. A player should understand the immediate objective, controls, danger, and partner relationship without first reading about WebMCP.

## Problem

Most agent experiences place the agent outside the activity as a chat window, perfect assistant, or conventional opponent. The human rarely has to depend on the agent under pressure, experience its specific weaknesses, or change how they work together over time.

This project gives the human and agent two bodies inside the same live game. They share mission state, consequences, checkpoints, communication, and an inspectable history. The agent is deliberately capable but imperfect. It can make understandable mistakes, preserve lessons from those mistakes, and change later tactics. The human must also learn when to trust it, when to issue a quick command, and when to switch perspectives.

WebMCP is central because the open webpage can expose structured game state and meaningful actions directly to the agent. The agent does not merely give advice about the game; it occupies the currently unplayed infiltrator and changes the same mission the human is playing.

## Core Workflow

1. The game opens on black with `RealSid Games Presents`.
2. That text slightly and quickly fades into a large centered `HS` with `Heist` beneath it. The lockup holds briefly, fades to black, and then fades into the mission.
3. Owen “Aye” Mercer and Cody “X” Vance begin behind cover inside a locked-down facility. Enemies are approaching and the escape is already underway.
4. The human controls one infiltrator in first person. The WebMCP agent controls the other through high-level tactical intent while Babylon.js executes locomotion, pathfinding, aiming, shooting, and animation.
5. The player can switch freely between infiltrators. The agent immediately assumes the character the human leaves behind.
6. At designed story moments, the game forces a perspective and locks switching for 15–30 seconds. The human must live with the agent's decisions until the lock expires.
7. The pair fight through two compact facility spaces. Either can advance, cover, flank, retreat, protect, or prioritize a threat. The human can coordinate through ChatGPT voice/text or quick in-game callouts such as `cover me`, `wait`, and `move`.
8. At the end gate, one infiltrator must plant a charge while the other covers them and triggers the detonation at the correct time. Either perspective can cause a recoverable complication or critical failure.
9. The pair reach the getaway car. One drives while the other shoots pursuing enemies. The chase follows one authored path with approximately two directional turns.
10. When the agent drives, it receives discrete left, right, and hold decisions for turns, lanes, and obstacles. The game interpolates the actual steering. When the agent shoots, it chooses threat priority while the game executes aiming and weapon behavior.
11. A successful uninterrupted run lasts approximately 8–10 minutes. A checkpoint retry lasts approximately 2–4 minutes.
12. After consequential failures and at mission completion, the agent's persistent memory records evidence-backed lessons. Later decisions can consult those lessons, while the player can inspect how the relationship has changed.

## What We Are Building

### Complete vertical slice

- One replayable mission with an opening title sequence, compact facility escape, cooperative bomb gate, exterior transition, and authored vehicle chase.
- Two original infiltrators: Owen “Aye” Mercer and Cody “X” Vance, displayed as `OWEN` and `CODY` during gameplay.
- An original cold industrial crime-thriller atmosphere inspired by the energy—not the protected assets or identity—of GTA V's prologue.
- Two physical infiltrators with freely switchable first-person perspectives.
- One or two designed forced-switch moments with visible 15–30 second control locks.
- Two visible character health bars throughout the mission.
- Vehicle health during the chase.
- A small enemy roster and one consistent basic weapon behavior.
- Moderate, fair difficulty where either the human or agent can make consequential mistakes.

### Failure and checkpoints

- Minor mistakes create recoverable complications such as health loss, reinforcement pressure, poor positioning, lost time, or a more dangerous pursuit.
- A third critical incident within the current section restarts from the latest checkpoint.
- Reaching zero health for either infiltrator immediately restarts from the latest checkpoint.
- Destroying the getaway vehicle immediately restarts the chase checkpoint.
- Checkpoints exist at mission start, after the first major combat space, and at the start of the chase.
- The world and health state reset at a checkpoint; the partner's long-term memory does not.

### Agent control

- A hybrid controller: Babylon.js owns continuous motor behavior; the WebMCP agent owns tactics, timing, role choices, target priority, and authored driving decisions.
- Representative agent intents include advance, cover, flank, retreat, protect, plant, wait, detonate, drive left, drive right, hold course, evade, and prioritize a pursuer.
- The game exposes structured mission observations and actions through non-trivial WebMCP tools rather than asking the agent to interpret raw pixels or simulate keyboard input.
- The game must remain coherent between agent decisions by executing the latest agent-authored tactic through deterministic NPC behavior.

### Communication and memory

- Natural-language coordination through ChatGPT voice or text when available.
- Immediate in-game tactical callouts for the human.
- Short agent-authored radio lines presented diegetically with speaker identity and subtitles.
- Subtitles always remain available, regardless of voice availability.
- A persistent, inspectable Markdown-style partner memory stored locally across the entire game history.
- The memory records concrete observations, failures, lessons, and changed tactics. It must never claim model training or weight updates.
- The player can inspect and export the memory; gameplay systems and WebMCP tools can read and append structured lessons.

### Technical direction

- React and Vite for the application shell, menus, HUD, subtitles, memory viewer, and WebMCP surfaces.
- Babylon.js for the 3D scene, characters, cameras, collision, animation, navigation, combat execution, audio, and authored chase.
- Local browser persistence for checkpoints, settings, and partner memory.
- Codex remains the primary implementation and integration owner. Cursor CLI with Opus 5 or Grok 4.6 High non-fast may assist with visual, UI, or game-specific passes, followed by Codex review and integration.

## What We Are Not Building

- No open world or explorable city.
- No general-purpose vehicle simulation or branching road network.
- No multiple missions, campaign, mission selector, or procedural levels.
- No online multiplayer, matchmaking, shared servers, accounts, or cloud saves.
- No elaborate stealth simulation, suspicion system, disguises, or alternate infiltration routes.
- No inventory, loot, economy, weapon progression, multiple weapon classes, or character customization.
- No advanced cover-system controls or frame-by-frame agent input.
- No large enemy variety, boss fight, or complex police simulation.
- No long cutscenes or extensive dialogue tree.
- No dependency on ChatGPT Voice being active and no claim that the webpage can detect or control that host feature.
- No claim that the agent is fine-tuned, retrained, or changing model weights during play.
- No GTA names, characters, logos, music, dialogue, maps, screenshots, or other protected assets.

## Inspiration And References

- **GTA V prologue:** authored crime-action pacing, a constrained escape, role switching, cold industrial atmosphere, and a short chase with a clear route. The project borrows structural energy only and executes an original world and identity.
- **The Last Guardian:** the primary relationship reference. The companion is capable but imperfect, and the player becomes better by understanding its habits and limitations.
- **Keep Talking and Nobody Explodes:** a supporting reference for the bomb gate's asymmetric information, timing pressure, and dependence on communication.

## Demo Path

The public demo video remains under three minutes and follows the game's intended opening rather than beginning with a failure montage.

1. **0:00–0:10 — Identity:** show `RealSid Games Presents`, the `HS / Heist` lockup, and the fade into the facility.
2. **0:10–0:35 — Thesis:** state that the human controls one infiltrator while a WebMCP agent inhabits the other. Show both health bars and one clean tactical exchange.
3. **0:35–1:00 — Shared control:** demonstrate a GTA-inspired character transition, the agent assuming the abandoned character, and a quick human callout changing its tactic.
4. **1:00–1:25 — Consequence:** show a fair agent or human mistake creating a recoverable complication, followed by a checkpoint failure if the situation deteriorates.
5. **1:25–1:45 — Adaptation:** open the inspectable partner memory, show the concrete lesson recorded, and replay a short moment where the updated tactic changes behavior.
6. **1:45–2:15 — Bomb gate:** show the planter/detonator dependency and a forced perspective lock.
7. **2:15–2:45 — Chase:** show driver and shooter roles, enemy fire, both character health bars, vehicle health, and at least one explicit left/right agent-driving decision.
8. **2:45–2:58 — Close:** show successful escape or the mission result, persistent memory, live URL, and public repository.

## Submission Story

### WebMCP Leverage

The webpage exposes a shared live mission as structured observations, tactical actions, driving decisions, communication, and persistent memory. WebMCP is not a menu shortcut or decorative chat integration; it is how the second infiltrator perceives and changes the game.

### Execution

The submission delivers one complete, coherent mission with an opening, rising pressure, cooperative gate, chase, success/failure states, checkpoints, persistent adaptation, and a visible product-quality HUD. Scope is deliberately concentrated on a reliable vertical slice.

### Potential Impact

The project demonstrates a new form of agent-native entertainment where players build a practical mental model of an AI partner through shared consequences. The same interaction pattern could later inform simulations, training experiences, and collaborative creative systems where understanding an agent's limitations matters as much as commanding it.

### Creativity And Ambition

The distinctive idea is not simply playing against an AI. The human and agent repeatedly exchange bodies, responsibilities, information, and risk. Both can fail; only the agent carries an explicit inspectable memory, while the human carries their own learned understanding of the partner.

## Build Constraint And Definition Of Done

The participant expects an aggressive sprint rather than an hourly cap. That does not expand the approved scope. Work prioritizes the complete facility-to-chase vertical slice before visual stretch goals.

The scope is done when a new player can open the deployed game, connect with the WebMCP partner, understand the controls, finish or fairly fail the mission, restart from checkpoints, inspect persistent agent lessons, observe at least one changed partner behavior, and replay without developer intervention.
