# Product Requirements Document

## Product Summary

**Working title:** HS: Heist

HS: Heist is a desktop browser action game about uneasy cooperation between a human and a WebMCP-controlled partner. Owen “Aye” Mercer and Cody “X” Vance are two infiltrators trapped inside a locked-down facility. The human controls one character in first person while the agent controls the other. Whenever the human switches perspective, the agent inherits the abandoned character and its current danger.

The pair must survive two compact combat spaces, coordinate a planter-and-detonator bomb sequence, reach a getaway car, and survive a short authored chase. Either participant can make consequential mistakes. Minor mistakes produce recoverable pressure; repeated critical mistakes, an eliminated character, a destroyed vehicle, or a missed required agent decision causes checkpoint failure.

The product’s defining loop is:

1. The human and agent share live mission state.
2. The agent selects a tactic or critical action through WebMCP.
3. The game executes that intent through the off-screen character.
4. The choice produces a visible consequence.
5. A consequential failure or mission result produces an inspectable lesson.
6. The lesson persists across checkpoint resets, page sessions, and later attempts.
7. The agent changes a future tactic based on that lesson.
8. The human also changes how they communicate with and compensate for the agent.

This must be presented as explicit memory-guided adaptation, not model training, fine-tuning, or weight updates.

## Product Principles

### Game first

A first-time player must understand that they are escaping a facility with a vulnerable partner before they need to understand how WebMCP works. Objectives, danger, health, switching, communication, and failure must be legible through the game itself.

### Shared risk

Owen, Cody, and the getaway vehicle are all vulnerable. The human cannot treat the agent as a disposable helper, and the agent cannot succeed while ignoring the human’s position or health.

### Real but bounded agency

The agent must make meaningful tactical, timing, targeting, and driving decisions. The game handles continuous motor execution so the experience remains responsive and coherent. The agent is neither a decorative chatbox nor a frame-by-frame remote-control script.

### Fair imperfection

The game should be moderately difficult for both participants. Failure must follow understandable choices, missed timing, accumulated pressure, or depleted health. It must not depend on invisible random punishment.

### Inspectable adaptation

When the agent changes, the player must be able to see the lesson that caused the change and the later action that used it. The game must not claim learning that it cannot demonstrate.

### Original identity

The atmosphere may evoke the cold, urgent structure of a cinematic crime prologue, but all names, characters, environments, assets, audio, dialogue, interface, and branding must be original.

## Target User

### Primary user

A desktop player who enjoys short first-person action experiences and is curious whether an imperfect AI teammate can become understandable, useful, and trustworthy through repeated shared attempts.

### Secondary user

A WebMCP developer, hackathon judge, or agent enthusiast who wants to see a non-trivial example of a human and an agent using the same live webpage to accomplish something neither controls alone.

### User constraints

- The submission targets a desktop browser with keyboard and mouse.
- The player must have access to a WebMCP-capable agent in a supported browser environment.
- The player should not need an account, cloud profile, installation, or separate multiplayer partner.
- The player may use ChatGPT voice or text for rich communication, but game-critical dialogue must also appear as subtitles.
- Mobile and touch-first play are outside the submission scope.

## Core User Journey

### 1. Pair with the agent

The player opens the game and sees a minimal black pairing screen. It displays `WAITING FOR PARTNER` and a short instruction telling them to ask ChatGPT/Codex to join the heist. `START HEIST` is visible but disabled.

When the WebMCP agent joins successfully, the screen changes to `PARTNER ONLINE`, identifies the two infiltrators as Owen and Cody, and enables `START HEIST`. There is no solo-practice path.

### 2. Enter the mission

Selecting `START HEIST` begins the cinematic identity sequence:

1. `RealSid Games Presents` appears alone on black.
2. It slightly and quickly fades into a large centered `HS` with `Heist` below it.
3. The lockup holds briefly.
4. The screen fades to black.
5. The game fades into the locked-down facility.

Owen and Cody are already behind cover, enemies are approaching, and escape is the immediate objective.

### 3. Learn the controls without leaving the action

A compact controls overview appears while the characters remain protected behind cover. It introduces movement, aim/fire, character switching, quick callouts, pause, and memory access. Combat pressure begins when the player dismisses the overlay or makes a gameplay input.

Later mechanics—planting, detonating, forced locks, driving, shooting from the vehicle, and agent decision windows—receive a single contextual prompt the first time each becomes relevant. Completed prompts do not repeatedly interrupt later attempts, but the full control reference remains available from the pause menu.

### 4. Escape the facility together

The player moves and fights in first person while the agent controls the other infiltrator through tactics such as advancing, covering, flanking, retreating, protecting, or prioritizing a marked threat.

The player can issue quick callouts or communicate more richly through ChatGPT voice/text. The agent responds through short diegetic radio lines. Every spoken or generated radio line appears as a subtitle.

The player can switch between Owen and Cody during ordinary play. The camera performs a short cinematic transition, then the human assumes the destination character while the agent immediately inherits the character the human left.

### 5. Survive the bomb gate

At the end gate, the game enters a designed dependency sequence. Cody becomes the planter and Owen becomes the cover/detonator. If the human is controlling Cody, the game forces a cinematic switch to Owen. The player is temporarily locked to Owen while the agent controls Cody.

The agent must decide when to move, plant, and retreat. The human must cover the planter, judge whether Cody is clear, and detonate the charge at the right time. Premature detonation can injure or eliminate Cody; delayed detonation can allow enemies to overwhelm the pair. Missing a required agent decision fails the mission.

### 6. Reach and use the getaway car

After the gate opens, both characters transition outside and enter the getaway car. One occupies the driver role and the other occupies the rear-facing shooter role.

The route is one authored path with approximately two significant directional turns. The car moves forward along that route. The driver must choose left, right, or hold course at turns, lane changes, and obstacles. The shooter must prioritize and damage pursuing enemies before their fire destroys the car or eliminates either infiltrator.

Character switching remains available except during designed locks or cooldowns. Switching exchanges human and agent control between driver and shooter without changing the characters’ physical seats or accumulated health.

### 7. Fail fairly or escape

Minor mistakes cause damage, reinforcement pressure, poor positioning, lost time, or a more dangerous chase. Critical incidents are surfaced clearly. A third critical incident within the current section, an eliminated infiltrator, a destroyed car, or a missed required agent decision produces a mission-failure card.

The card remains visible for approximately two seconds and identifies the cause. The game then restores the latest checkpoint automatically. World state and the section’s authored health/ammunition baseline reset; long-term agent memory remains.

If the car reaches the escape point with both characters alive, the game fades to black and displays `HEIST COMPLETE`.

### 8. Inspect the result and replay

The debrief shows:

- Owen’s survival and remaining health.
- Cody’s survival and remaining health.
- Vehicle integrity.
- Checkpoints reached.
- Checkpoint failures and their causes.
- Critical incidents.
- Partner lessons added during the run.
- Tactics changed because of existing memory.
- Total run time.
- `REPLAY HEIST`.

Replaying resets mission progress but preserves partner memory, allowing the player and agent to demonstrate adaptation across attempts.

## Epics And User Stories

### Epic 1: Required human-agent pairing

#### Story 1.1 — Wait for the partner

As a player, I want the game to clearly wait for a WebMCP partner so that I understand this is a human-agent experience rather than a solo game.

Acceptance criteria:

- Opening the live URL displays a black pairing screen before any title sequence or mission content.
- The screen visibly displays `WAITING FOR PARTNER`.
- The screen gives one concise instruction telling the player to ask ChatGPT/Codex to join the heist.
- `START HEIST` is visible but disabled while no agent has joined.
- The game does not offer a solo, guest-bot, or skip option.
- The player can inspect existing partner memory from this screen without starting the mission.

#### Story 1.2 — Confirm the partner joined

As a player, I want an unmistakable connection confirmation so that I know the agent can act before I enter the mission.

Acceptance criteria:

- A successful agent join changes `WAITING FOR PARTNER` to `PARTNER ONLINE` without requiring a page reload.
- The pairing screen identifies Owen and Cody.
- `START HEIST` becomes enabled only after the join succeeds.
- Repeated join attempts do not create duplicate partners or duplicate mission sessions.
- Reloading the page requires the agent to join the new page session again, while existing long-term memory remains available.

#### Story 1.3 — Handle unsupported or incomplete pairing

As a player, I want the waiting state to remain understandable when pairing has not happened so that I know what action is still required.

Acceptance criteria:

- The waiting screen never falsely displays `PARTNER ONLINE` before a successful join.
- If the player selects the disabled start control, the interface reinforces the partner-join instruction rather than starting a fallback game.
- If the page is opened on an unsupported small-screen/touch-only device, it displays a desktop keyboard-and-mouse requirement instead of beginning the mission.

### Epic 2: Cinematic start and learnable controls

#### Story 2.1 — Experience the game identity

As a player, I want a short original title sequence so that the mission feels like a coherent game rather than a technical demo.

Acceptance criteria:

- Selecting `START HEIST` hides the pairing interface and begins on black.
- `RealSid Games Presents` appears alone and remains readable.
- It transitions with a slight, quick fade into the centered `HS` / `Heist` lockup.
- The lockup fades to black before the facility appears.
- No failure montage, WebMCP explanation wall, copied game branding, or unrelated menu interrupts the sequence.
- The sequence can be skipped only after it has been seen once in the current browser history.

#### Story 2.2 — Begin in a coherent situation

As a player, I want to enter an immediately understandable danger state so that I know why Owen and Cody are moving and fighting.

Acceptance criteria:

- The facility fades in with both infiltrators already behind cover.
- The first objective communicates that the facility is locked down and the pair must escape.
- Enemies are visibly approaching or preparing to engage.
- Combat damage does not begin while the first-run controls overview is blocking the player’s view.
- The player begins with a viable amount of health and ammunition.

#### Story 2.3 — Learn controls progressively

As a first-time player, I want one compact overview plus contextual reminders so that I can begin quickly without forgetting mechanics introduced later.

Acceptance criteria:

- The initial overlay includes movement, aim/fire, switching, quick callouts, pause, and memory access.
- Dismissing the overlay or making a gameplay input begins the encounter.
- Planting, detonating, forced locks, driving, and vehicle shooting each produce a contextual prompt when first encountered.
- A contextual prompt never prevents the player from seeing immediate danger.
- Each contextual prompt stops appearing after the player successfully performs that action.
- The pause menu contains a complete controls reference on every attempt.

### Epic 3: Legible first-person action

#### Story 3.1 — Read both characters’ state

As a player, I want to see both infiltrators’ condition at all times so that I can protect the character I am not currently controlling.

Acceptance criteria:

- Owen and Cody each have a portrait, name, and health bar in the upper-left HUD.
- The currently human-controlled character is visually distinguished.
- Health changes are visible immediately for either character.
- A low-health state produces a readable visual warning without hiding the crosshair or subtitles.
- A character reaching zero health immediately ends the current section.

#### Story 3.2 — Understand the current objective

As a player, I want the active objective and exceptional constraints to remain visible so that I understand what progress requires.

Acceptance criteria:

- The active objective appears in the upper-right HUD.
- Objective text updates when the pair clears a space, reaches the gate, plants the charge, exits the facility, or enters the chase.
- A forced-switch lock adds a visible countdown beside the objective.
- A critical incident briefly displays `CRITICAL ERROR` and the current section count.
- The persistent objective cluster does not overlap pairing messages, subtitles, or failure cards.

#### Story 3.3 — Use one consistent weapon model

As a player, I want a simple reliable firearm interaction so that combat tests coordination rather than inventory knowledge.

Acceptance criteria:

- The human can aim, fire, and reload one firearm type.
- The lower-right HUD displays current magazine and reserve ammunition.
- Empty-magazine feedback is obvious.
- There is no weapon wheel, loot pickup, weapon class choice, or progression system.
- Ordinary gunfire from Owen or Cody does not damage the other infiltrator.
- Enemy gunfire damages either infiltrator according to visible hits.
- Explosion damage from the bomb can damage either infiltrator and therefore requires timing and safe distance.

#### Story 3.4 — Experience moderate fair difficulty

As a player, I want pressure that can defeat either partner without feeling arbitrary so that adaptation has a meaningful purpose.

Acceptance criteria:

- Enemies can target both Owen and Cody.
- Ignoring the partner’s position or health can lead to that partner’s elimination.
- A clean first-attempt completion is possible but should not be guaranteed for an unfamiliar pair.
- A typical successful experience can include one or two checkpoint retries.
- Damage and failure follow visible attacks, missed decisions, unsafe timing, or accumulated critical incidents.
- The game does not cause unavoidable off-screen instant deaths.

### Epic 4: Character switching and shared embodiment

#### Story 4.1 — Switch freely during ordinary play

As a player, I want to exchange perspectives between Owen and Cody so that I can respond to whichever role needs direct human control.

Acceptance criteria:

- A switch input begins a 1.5–2 second cinematic transition when switching is available.
- The transition visually travels from the current character to the destination character in an original treatment inspired by distant character switching, not copied presentation.
- The world is heavily slowed during the transition.
- Owen and Cody are protected from damage only for the transition itself.
- Health, ammunition, position, and current danger remain attached to each physical character.
- The agent immediately assumes the character the human leaves.
- The HUD highlights the new human-controlled character at transition completion.

#### Story 4.2 — Prevent switch abuse and ambiguity

As a player, I want clear switch availability so that I know whether a failed input is a cooldown or a story lock.

Acceptance criteria:

- Completing a normal switch begins a short visible cooldown.
- Attempting to switch during cooldown provides brief non-blocking feedback.
- Attempting to switch during a forced lock displays the remaining lock time.
- The switch input never silently fails.
- Repeated switch inputs cannot keep the characters permanently protected from damage.

#### Story 4.3 — Survive a forced perspective

As a player, I want designed moments where switching is temporarily forbidden so that the agent’s choices have consequences I cannot instantly erase.

Acceptance criteria:

- The game uses no more than two forced-switch moments in the mission.
- Each forced lock lasts between 15 and 30 seconds.
- The lock begins with an understandable mission reason and a visible countdown.
- The agent remains responsible for the other character for the full lock.
- Normal switching becomes available automatically when the countdown ends.

### Epic 5: Human-agent coordination

#### Story 5.1 — Issue immediate tactical callouts

As a player under pressure, I want short in-game commands so that I can influence my partner without leaving first-person play.

Acceptance criteria:

- The player can access four core callouts: `COVER ME`, `HOLD`, `MOVE`, and `FOCUS TARGET`.
- Choosing a callout produces an immediate visible acknowledgement in the lower-centre HUD.
- The callout becomes part of the live state available to the agent.
- The agent responds with a radio subtitle acknowledging, questioning, or rejecting the instruction.
- `FOCUS TARGET` refers to a visibly marked enemy or threat.
- If a command is impossible in the current state, the partner communicates that fact and uses a safe current tactic rather than pretending it complied.

#### Story 5.2 — Coordinate through natural language

As a player, I want to talk or type to ChatGPT/Codex so that I can give plans and context beyond four quick commands.

Acceptance criteria:

- The experience supports natural-language instructions through the host conversation while the page is open.
- Rich instructions can influence subsequent agent tactics or required decisions.
- The game does not require ChatGPT Voice to be enabled.
- When voice is active, all agent-authored in-game communication still appears as subtitles.
- When voice is unavailable, text interaction and subtitles preserve all required information.

#### Story 5.3 — Hear the partner inside the game

As a player, I want agent communication to appear as radio traffic so that it belongs to the mission rather than feeling like an external debug log.

Acceptance criteria:

- Each agent-authored radio line identifies the speaking character.
- Radio text appears in the lower-centre HUD and remains long enough to read.
- A new line does not permanently erase an unread critical warning; important lines queue or replace only lower-priority chatter.
- Subtitles never cover the crosshair, interaction prompt, or failure cause.
- The page does not claim to control or detect ChatGPT Voice state.

### Epic 6: Agent-controlled tactical decisions

#### Story 6.1 — Observe meaningful state

As the agent partner, I want structured information about the mission so that my decisions use actual positions, threats, health, objectives, callouts, and memory.

Acceptance criteria:

- The agent can obtain the active section, controlled character, objective, both health states, nearby threats, available actions, current callout, switch state, critical-incident count, and relevant memory lessons.
- The information distinguishes facts from recommended actions.
- The agent is not required to infer critical mission state from raw screenshots.
- The visible game and the structured observation agree about health, objective, and failure state.

#### Story 6.2 — Choose a tactic that changes play

As the agent partner, I want to choose tactical intent so that my presence materially changes what the unplayed character does.

Acceptance criteria:

- Available facility intents include advance, cover, flank, retreat, protect, hold, plant, wait, and detonate when contextually valid.
- Choosing an intent changes the off-character’s visible behavior.
- Invalid actions are rejected with a clear reason and do not corrupt mission state.
- The latest valid tactic continues to guide ordinary movement between required decisions.
- The action history identifies which meaningful choices came from the agent.

#### Story 6.3 — Make required decisions before the deadline

As a player, I want critical agent decisions to have visible deadlines so that success and failure are fair to both participants.

Acceptance criteria:

- A required decision window is clearly distinguished from ordinary autonomous execution.
- The player can see that the partner is deciding and can see the remaining window.
- A valid agent action before expiry resolves the window and continues play.
- If the required decision expires without a valid action, the game immediately ends the section with `MISSION COMPROMISED`.
- The game does not pause indefinitely, silently choose for the agent, or substitute a fallback bot after expiry.
- The resulting checkpoint failure is included in the run history and can become evidence for a later memory lesson.

### Epic 7: Cooperative bomb gate

#### Story 7.1 — Establish asymmetric roles

As a player, I want the bomb gate to give Owen and Cody different responsibilities so that the mission requires actual interdependence.

Acceptance criteria:

- Reaching the gate updates the objective to the bomb sequence.
- Cody is identified as the planter.
- Owen is identified as cover and detonator.
- If the human is controlling Cody, the game forces a cinematic switch to Owen.
- A visible forced-lock timer begins while the agent assumes Cody.
- The first encounter with the sequence displays contextual prompts for covering and detonating.

#### Story 7.2 — Let the agent succeed or fail at planting

As a player, I want the agent-controlled planter’s timing and movement to matter so that the WebMCP partner carries real risk.

Acceptance criteria:

- Cody must reach the charge location, begin planting, complete the plant, and retreat toward safety.
- Enemy pressure can interrupt or punish an unsafe plant.
- The agent can choose to wait, request cover, start planting, abort, or retreat when contextually valid.
- Missing the required plant decision deadline causes `MISSION COMPROMISED`.
- The HUD communicates whether the charge is unplaced, being planted, armed, or detonated.

#### Story 7.3 — Let the human judge detonation

As a player controlling Owen, I want to choose when to detonate so that I share responsibility for Cody’s survival.

Acceptance criteria:

- Detonation is unavailable until the charge is armed.
- Once armed, Owen receives a clear detonation prompt.
- The HUD and world make Cody’s distance from the gate readable.
- Premature detonation can damage or eliminate Cody.
- Delaying can allow additional enemy pressure or consume critical incidents.
- A safe successful detonation opens the escape route and advances the objective.

### Epic 8: Authored getaway chase

#### Story 8.1 — Understand driver and shooter roles

As a player, I want the chase roles to be immediately clear so that I can decide whether to drive, shoot, or switch.

Acceptance criteria:

- Entering the car identifies the driver and rear-facing shooter.
- The HUD adds vehicle integrity without removing Owen and Cody’s health bars.
- The objective changes to escaping the pursuit.
- The chase begins on one authored route with no route-selection menu or open-world map.
- A first-time contextual prompt explains the current human role.

#### Story 8.2 — Drive the authored route

As the driver, I want meaningful left, right, and hold decisions so that the chase can be failed without becoming an open driving simulator.

Acceptance criteria:

- The vehicle advances along the authored route.
- The route contains approximately two significant directional turns plus readable lane or obstacle decisions.
- A human driver can steer through the relevant decisions.
- An agent driver can choose `LEFT`, `RIGHT`, or `HOLD` during structured driving windows.
- A missed required agent-driving decision causes `MISSION COMPROMISED`.
- Wrong or late driving choices damage the vehicle or increase pursuit pressure rather than teleporting the vehicle back onto the route.
- The vehicle cannot freely reverse, leave the authored area, or explore alternate streets.

#### Story 8.3 — Defend the getaway car

As the shooter, I want to prioritize pursuing threats so that protecting the car and both characters requires active judgment.

Acceptance criteria:

- Pursuing enemies are visible behind or beside the getaway vehicle.
- Enemy fire can reduce vehicle integrity and either character’s health.
- A human shooter can aim and fire at pursuers.
- An agent shooter can prioritize a pursuer or threat class, producing visible target selection and fire.
- Destroying or disabling pursuers reduces incoming pressure.
- Reaching zero vehicle integrity produces `VEHICLE DESTROYED`.
- Owen or Cody reaching zero health produces the corresponding downed failure even if the car remains functional.

#### Story 8.4 — Switch roles during the chase

As a player, I want to exchange driver and shooter perspectives so that I can respond to whichever role is failing.

Acceptance criteria:

- Switching during an available chase moment uses the same protected cinematic transition and cooldown principles as facility switching.
- The physical driver and shooter seats remain assigned to their characters.
- Human control moves to the destination character; agent control moves to the abandoned character.
- Vehicle motion and pursuit state remain coherent through the transition.
- Switching is unavailable during an active forced lock or unresolved required driving decision.

### Epic 9: Failure, checkpoints, and recovery

#### Story 9.1 — Understand recoverable complications

As a player, I want mistakes to create pressure before they end the mission so that I have opportunities to compensate for myself or my partner.

Acceptance criteria:

- Minor mistakes can cause health loss, more enemies, poor position, lost time, or stronger pursuit.
- The game communicates the consequence through world changes, HUD state, or radio feedback.
- A recoverable complication does not immediately reset the checkpoint.
- The player can still succeed through improved tactics if neither character nor the vehicle reaches zero and the critical limit is not reached.

#### Story 9.2 — Understand critical incidents

As a player, I want serious mistakes counted visibly so that a section failure never feels unexplained.

Acceptance criteria:

- A critical incident produces a transient `CRITICAL ERROR` notification.
- The upper-right objective cluster shows the current count out of three for the section.
- The incident cause is included in the run history.
- The first and second incidents leave play running with worsened pressure or state.
- The third incident immediately produces `MISSION COMPROMISED`.
- Starting a new checkpoint section resets the visible section count but does not erase long-term memory or run history.

#### Story 9.3 — Fail with a precise cause

As a player, I want the failure card to identify what ended the attempt so that I can change my next plan.

Acceptance criteria:

- Owen reaching zero displays `PLAYER DOWN` when Owen is human-controlled and `PARTNER DOWN` when Owen is agent-controlled.
- Cody reaching zero uses the same role-aware rule.
- Vehicle destruction displays `VEHICLE DESTROYED`.
- A third critical incident or missed required agent decision displays `MISSION COMPROMISED`.
- The failure card remains visible for approximately two seconds.
- The card does not blame the agent unless the recorded cause actually came from an agent action or missed decision.

#### Story 9.4 — Restore a fair checkpoint

As a player, I want automatic checkpoint recovery so that I can retry the relevant challenge without replaying the entire mission.

Acceptance criteria:

- Checkpoints activate at mission start, after the first major combat space, and at chase start.
- After the failure card, the latest checkpoint restores automatically.
- The section restores an authored survivable baseline for health, ammunition, enemies, objective, and vehicle state.
- The player never respawns into immediate unavoidable damage.
- Mission-local critical count resets for the restored section.
- Long-term partner memory and overall run history persist.
- Closing and returning to the page can offer continuation from the latest saved checkpoint after the agent rejoins.

### Epic 10: Persistent inspectable partner memory

#### Story 10.1 — See the memory as a real artifact

As a player, I want to inspect the partner’s history so that adaptation is understandable rather than magical.

Acceptance criteria:

- `PARTNER MEMORY` is accessible from the pairing screen, pause menu, and mission debrief.
- Opening it during play pauses the mission.
- The view presents readable Markdown-style content rather than raw internal data.
- Entries identify the attempt or section, observed event, consequence, lesson, and affected tactic.
- The human can read and export the memory but cannot directly edit it in the submission build.
- The memory survives checkpoint resets, mission replay, and page reloads on the same browser.

#### Story 10.2 — Record evidence-backed lessons

As a player, I want lessons to follow actual events so that the claimed adaptation is credible.

Acceptance criteria:

- Consequential failures and mission completion can produce memory updates.
- Every lesson cites a real event from the run history.
- The game does not add a lesson for ordinary harmless movement.
- Duplicate evidence does not create an unlimited list of identical lessons.
- A new lesson produces a small non-modal `MEMORY UPDATED` notification.
- The notification does not interrupt combat, switching, or a required decision window.

#### Story 10.3 — Observe changed behavior

As a player, I want a later tactic to reference prior memory so that I can verify adaptation across attempts.

Acceptance criteria:

- The agent can consult relevant lessons before selecting a tactic.
- When a lesson changes a choice, the action history and debrief identify the lesson used.
- At least one repeatable mission situation can visibly produce a different tactic after a relevant failure lesson exists.
- Changed behavior remains context-sensitive; a lesson does not force an invalid action in a different situation.
- The game uses language such as `remembered`, `recorded`, or `adapted tactic`, never `retrained` or `fine-tuned`.

#### Story 10.4 — Let the player manage local history safely

As a returning player, I want to export or deliberately reset local memory so that I can preserve history or start a clean demonstration.

Acceptance criteria:

- The memory view offers `EXPORT MEMORY`.
- Export produces a readable Markdown file.
- The pairing-screen memory view offers `RESET MEMORY` behind a confirmation step.
- Resetting memory does not occur through an accidental single click.
- Reset clears long-term lessons and historical adaptation but does not break the game or delete unrelated settings.

### Epic 11: Mission completion and replay

#### Story 11.1 — Complete the heist

As a player, I want a decisive successful ending so that the mission feels complete.

Acceptance criteria:

- Reaching the escape endpoint with both characters alive and vehicle integrity above zero ends active play.
- The scene fades to black and displays `HEIST COMPLETE`.
- No further enemy damage can occur after completion triggers.
- The completion state is distinct from a checkpoint or failure transition.

#### Story 11.2 — Review shared performance

As a player, I want a debrief that separates survival, mistakes, and learning so that I understand how the pair performed.

Acceptance criteria:

- The debrief shows Owen, Cody, and vehicle final states.
- It shows run time, checkpoints reached, failure count, failure causes, and critical incidents.
- It lists lessons added during the run.
- It lists tactics changed because of existing lessons.
- It distinguishes human actions, agent actions, and environmental consequences without inventing blame.
- `REPLAY HEIST` is visible and enabled.

#### Story 11.3 — Replay with memory intact

As a player, I want another attempt to retain agent lessons so that the relationship can evolve across the entire game history.

Acceptance criteria:

- Selecting `REPLAY HEIST` resets mission position, health, ammunition, vehicle state, objective, and section incidents.
- The same joined agent can enter the new attempt without a page reload.
- Existing partner memory remains available.
- The next attempt receives a new run identifier in the memory and debrief history.
- The title sequence may be skipped after it has been seen once, but the player can choose to replay it.

### Epic 12: Pause, readability, and recovery

#### Story 12.1 — Pause without losing the mission

As a player, I want a pause menu so that I can review controls and memory without being attacked.

Acceptance criteria:

- The player can pause during ordinary facility or chase play.
- Pausing freezes danger, vehicle movement, required decision deadlines, and character-switch cooldowns.
- The pause menu offers resume, controls, partner memory, restart checkpoint, and return to pairing.
- Pausing is unavailable during the short title sequence, failure card, or completion transition.

#### Story 12.2 — Keep critical text readable

As a player, I want subtitles and warnings to remain legible during action so that voice availability and visual chaos do not hide required information.

Acceptance criteria:

- All agent radio dialogue has subtitles.
- Subtitle text has sufficient contrast against bright and dark scenes.
- Failure cards, required decision timers, contextual prompts, and objectives use consistent priority.
- Lower-priority chatter yields to required decision or failure information.
- The HUD remains usable at common desktop browser window sizes.

#### Story 12.3 — Resume after a page interruption

As a returning player, I want local progress to be recoverable so that an accidental refresh does not erase the entire demonstration.

Acceptance criteria:

- Reloading returns to the pairing screen rather than pretending the previous agent remains joined.
- After the agent rejoins, `CONTINUE FROM CHECKPOINT` appears when a valid checkpoint exists.
- Continuing restores the latest saved checkpoint and run history.
- Long-term partner memory is available before and after continuation.
- If no valid checkpoint exists, only `START HEIST` is offered.

## Edge Cases

### Agent and decision edges

- **Agent never joins:** remain on `WAITING FOR PARTNER`; do not offer solo play.
- **Agent joins twice:** keep one partner session and ignore or safely reject the duplicate join.
- **Agent sends an invalid action:** reject it with a reason; preserve the last valid tactic; keep the required decision window active if time remains.
- **Agent responds after a required deadline:** the mission failure stands; the late action cannot mutate the restored checkpoint.
- **Agent is quiet during ordinary execution:** continue the latest valid tactic until a required decision occurs.
- **Agent misses a required decision:** show `MISSION COMPROMISED` and restore the checkpoint.
- **Natural-language instruction conflicts with a quick callout:** the most recent explicit instruction becomes visible as the active request; the partner may acknowledge a conflict rather than silently guessing.

### Switching edges

- **Switch requested during cooldown:** show cooldown feedback; do not switch.
- **Switch requested during forced lock:** show remaining lock time; do not switch.
- **Switch requested during unresolved required driving decision:** finish or fail that decision first.
- **Destination character is in a hazardous position:** allow the switch during ordinary availability because inheriting the partner’s danger is part of the design; protect only during the transition.
- **Character would die during transition:** transition protection prevents damage until control is established, then normal vulnerability resumes.

### Combat and bomb edges

- **Player runs out of ammunition:** require reload when reserve exists; if reserve is exhausted, the partner and movement remain relevant, but no extra weapon system appears.
- **Agent tries to plant before the gate:** action is unavailable and rejected.
- **Human tries to detonate before arming:** detonation control remains unavailable.
- **Human detonates while Cody is unsafe:** explosion damage applies and can fail the section.
- **Cody is interrupted while planting:** planting stops or loses progress; the pair must recover while the decision window remains valid.
- **Both characters reach zero in the same event:** show the failure cause associated with the current human perspective and record both eliminations in history.

### Chase edges

- **Wrong turn decision:** damage or pursuit pressure increases; the car remains on the authored route unless destroyed.
- **Late agent driving decision:** required-decision failure applies.
- **Car reaches zero as a character reaches zero:** show `VEHICLE DESTROYED` as the primary card and record all simultaneous causes in the debrief.
- **Player switches during a dangerous chase moment:** world slowdown and transition protection apply, but pursuit resumes immediately afterward.
- **All pursuers are disabled early:** the authored escape continues with reduced incoming pressure rather than ending abruptly.

### Persistence edges

- **Page reload during mission:** require pairing again, then offer checkpoint continuation.
- **Memory is empty:** display an explicit first-run message explaining that lessons will appear after consequential events.
- **Memory contains many entries:** group by run and show the newest relevant lessons first without deleting history.
- **Memory reset requested:** require confirmation and clearly state that mission checkpoints remain separate.
- **Export requested with empty memory:** export a valid Markdown file explaining that no lessons exist yet.

## What We Are Building

- Required WebMCP agent pairing with a clear waiting and online state.
- One complete 8–10 minute replayable mission.
- Original title sequence and coherent facility opening.
- Owen “Aye” Mercer and Cody “X” Vance as vulnerable switchable infiltrators.
- Compact first-person combat across two facility spaces.
- One firearm model, health, ammunition, objectives, and a focused HUD.
- Free character switching, cooldowns, protected transitions, and no more than two forced locks.
- Quick tactical callouts plus natural-language coordination.
- Agent-authored radio subtitles.
- Structured agent observations, tactics, required decisions, and action history.
- Cooperative Cody-planter/Owen-detonator gate sequence.
- One-path getaway chase with approximately two significant turns.
- Human or agent driving and shooting roles.
- Character and vehicle damage.
- Recoverable complications, visible critical incidents, precise failure cards, and three checkpoints.
- Mission failure when a required agent decision is missed.
- Persistent, read-only, exportable, resettable partner memory.
- Evidence-backed lessons and at least one visibly changed later tactic.
- Completion debrief and memory-preserving replay.
- Local checkpoint continuation after page reload and agent re-pairing.
- Desktop keyboard-and-mouse presentation with always-on dialogue subtitles.

## What We Would Add With More Time

- Additional missions that test different partner weaknesses.
- More authored character conversations and relationship-specific dialogue.
- Alternate bomb-role assignments and mission routes.
- More weapons, enemy archetypes, and encounter behaviors.
- Advanced cover interactions and stealth options.
- A larger chase with branching choices and more vehicle behavior.
- Optional difficulty levels and accessibility assists.
- Fully synchronized in-game speech generated independently of host ChatGPT Voice.
- Richer reduced-motion and camera-comfort settings.
- Cloud-synced partner memory across browsers and devices.
- Shareable memory/debrief cards.
- Multiple agent personalities or imported memory profiles.
- Online human-human-agent variants.
- Character customization, progression, and campaign structure.

These are explicitly deferred because the hackathon submission is stronger with one reliable agent-native mission than several incomplete systems.

## Submission Proof Points

### Proof that WebMCP is essential

- The pairing screen remains blocked until the agent joins through the page’s structured capability.
- The action history shows the agent observing mission state and selecting tactics, critical actions, target priorities, or driving directions.
- Removing WebMCP removes the second player’s decision-maker rather than merely disabling a convenience feature.

### Proof of a complete product experience

- A new player can pair, start, learn controls, fight, switch, communicate, use the bomb gate, enter the chase, fail or escape, inspect memory, and replay.
- Every mission phase has visible objectives, success conditions, failure conditions, and recovery behavior.
- The title, HUD, subtitles, failure cards, memory viewer, and debrief form one coherent original visual identity.

### Proof of mutual adaptation

- The demo captures one consequential partner failure or missed tactic.
- The exact event appears in partner memory as evidence for a lesson.
- A later attempt shows a different relevant agent tactic.
- The debrief links the changed tactic to the lesson.
- The human also changes a callout, switch choice, cover position, or detonation timing based on understanding the partner.

### Proof of fair shared risk

- Both Owen and Cody have visible health and can be eliminated.
- The agent can miss a required decision and fail the mission.
- The human can detonate prematurely, abandon cover, drive poorly, or neglect a threat.
- Checkpoints make failure recoverable without making it meaningless.

### Proof for the judging criteria

- **WebMCP Leverage:** multiple non-trivial tools expose observation, tactics, critical actions, driving, communication, and memory.
- **Execution:** one deployed and replayable end-to-end mission works without developer intervention.
- **Potential Impact:** the project demonstrates agent-native entertainment built around understanding and depending on imperfect collaborators.
- **Creativity And Ambition:** the human and agent exchange bodies, responsibilities, risk, and learned context inside a shared live action game.

## PRD Approval Conditions

The PRD is ready for technical specification when the participant confirms that:

- Required pairing and no solo mode are correct.
- Owen and Cody’s names and roles are correct.
- The HUD, controls, switching, forced locks, communication, and memory behavior match the intended experience.
- The facility, bomb gate, and chase form the complete submission mission.
- Agent decision timeouts correctly fail the mission.
- Failure, checkpoints, completion, and replay behave as intended.
- The explicit non-goals remain cut.

No implementation begins from this document until that approval is given. After approval, the next guided stages are the technical specification, sequenced build checklist, and full implementation.
