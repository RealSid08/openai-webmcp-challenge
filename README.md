# HS: Heist

**Switch bodies. Share risk. Remember the failure.**

HS: Heist is a short first-person action game built for the WebMCP Challenge. A human controls one infiltrator while a WebMCP agent controls the other. Either can fail the mission, both have to adapt, and the agent's long-term lessons remain visible as an evidence-backed Markdown memory.

This is a complete client-side vertical slice: pair with an agent, escape two facility encounters, coordinate a bomb-gate breach, survive an authored getaway chase, recover from fair checkpoints, and inspect how earlier failures influenced later partner actions.

## Why WebMCP belongs in the game

A normal game companion is a hidden behavior tree. A normal chatbot sits outside the world. HS: Heist makes the agent a real participant:

- `join_heist` occupies the second character and unlocks the mission.
- `wait_for_mission_event` returns sequenced events, shared state, deadlines, and relevant lessons.
- Tactic and decision tools change the off-character's behavior in the live Babylon scene.
- Agent-authored radio lines are always rendered as in-game subtitles.
- Missed required decisions genuinely fail the checkpoint; there is no scripted production partner.
- Consequential events can become structured local lessons, and later actions cite the lesson IDs they used.

The page does not claim to retrain or fine-tune a model. “Learning” here means inspectable persistent memory plus a demonstrably changed later decision.

## Mission

1. **Pairing:** the start control stays locked until an agent calls `join_heist`.
2. **Facility:** Owen “Aye” Mercer and Cody “X” Vance fight through two compact rooms.
3. **Bomb gate:** Cody plants while Owen covers and detonates. The human is forced into Owen's perspective for the critical beat.
4. **Getaway:** Owen drives and Cody shoots during one forward route with two authored turns.
5. **Recovery:** either character, the car, three critical incidents, or a missed agent decision can end an attempt. A two-second cause card restores the latest authored checkpoint.
6. **Debrief:** the final state, failures, new lessons, and memory-linked tactic changes are shown without inventing evidence.

## Controls

| Input | Action |
| --- | --- |
| `W A S D` | Move on foot; steer while driving |
| Mouse | Look |
| Right mouse | Aim |
| Left click | Lock pointer / fire |
| `Shift` | Sprint on foot |
| `Ctrl` | Crouch behind cover |
| `R` | Reload |
| `Q` | Switch characters when switching is available |
| `E` | Detonate when the charge is armed |
| `1`–`4` | Cover me / hold / move / focus target |
| `M` | Inspect partner memory |
| `Esc` | Pause |

The game targets a desktop or laptop with keyboard, mouse, WebGL, and a window of roughly 1280×720 or larger.

## Run locally

Requirements: a current Node.js release and npm.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. In an ordinary browser the pairing screen remains usable, but the mission correctly stays locked because no agent has joined.

For Chrome WebMCP testing, enable the current WebMCP testing flag or extension described in Chrome's documentation. For the intended experience, open the deployed page in a compatible ChatGPT in-app browser and ask the agent to join the heist.

## Agent loop

The page registers ten imperative tools at top level through `document.modelContext.registerTool`:

```text
join_heist
get_mission_briefing
wait_for_mission_event
set_partner_tactic
resolve_partner_decision
prioritize_pursuer
send_radio_message
read_partner_memory
record_partner_lesson
get_run_debrief
```

The intended loop is:

```text
join_heist
  → wait_for_mission_event(lastSequence)
  → inspect observation, deadline, and relevant lessons
  → call a tactic or required-decision tool
  → wait_for_mission_event again
  → continue until completion or return to pairing
```

Event waits are bounded and abortable. Session IDs, decision IDs, allowed action enums, and deadlines are checked against the same mission store used by the human UI and Babylon runtime.

## Architecture

```text
ChatGPT / Codex agent
        │ WebMCP tools and bounded event waits
        ▼
PartnerCoordinator ─── MemoryRepository ─── localStorage / Markdown
        │
        ▼
MissionStore (authoritative typed rules and event history)
        │                         │
        ▼                         ▼
React shell + HUD          Babylon.js world runtime
```

- **React** owns pairing, title, HUD, subtitles, dialogs, failure cards, and debrief.
- **MissionStore** owns authoritative health, ammo, roles, switches, incidents, required decisions, checkpoints, and completion.
- **Babylon.js** projects those rules into first-person facility and chase scenes.
- **PartnerCoordinator** exposes the event/action loop and keeps agent output as untrusted text.
- **MemoryRepository** stores versioned structured lessons and produces deterministic Markdown.
- **CheckpointRepository** stores only trusted checkpoint metadata; restores rebuild authored baselines rather than deserializing arbitrary world state.

There is no backend, account, API key, hidden model request, cloud save, or production fallback agent.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
```

The Playwright journey installs a test-only WebMCP host during a test-mode production build. It calls the real registered tool handlers and covers pairing, title, Babylon startup, pause/memory accessibility, the bomb gate, chase, failure restore, lesson recording, lesson-linked adaptation, and debrief. The test driver is compiled only in Vite's `test` mode and is absent from a normal production build.

The browser suite also installs a test-only pointer-lock host shim because headless Chromium cannot capture the operating-system pointer. It verifies request/event wiring and keyboard/mouse actions; physical mouse feel remains a final human QA step.

## Local data and safety

- Partner memory and the latest checkpoint remain in the current browser's `localStorage`.
- Resetting memory is explicit and does not erase checkpoint data.
- Export creates a readable `hs-heist-partner-memory.md` download.
- Agent-authored subtitles and memory are rendered as text, never injected as HTML.
- Memory lessons must cite an existing consequential mission event.
- The project uses original procedural geometry, materials, effects, and audio. GTA V is a pacing and character-switching reference only; no Rockstar assets, identity, characters, audio, or map content are included.

## Deployment

Build `dist/` and deploy it as a static site on Cloudflare Pages, Vercel, Netlify, Render, or another HTTPS host:

```bash
npm run build
```

The repository includes a Netlify/Cloudflare-style `public/_headers` file and `vercel.json` with equivalent security headers. WebMCP capability is feature-detected, so unsupported browsers show the waiting experience rather than crashing.

No live deployment, public repository, or supported-host test is claimed by this local checkout. Those are explicit pre-submission steps.

## License

[MIT](./LICENSE)
