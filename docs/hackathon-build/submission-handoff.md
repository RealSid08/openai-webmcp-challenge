# HS: Heist — Submission Handoff

## Release status

The local production build is complete and verified. Nothing has been submitted to Devpost. A public repository, public live URL, public demo video, and real supported-host WebMCP test are still required before submission.

Official Devpost requirements, judging criteria, key dates, and announcements were refreshed through the Devpost Hackathons plugin on 2026-08-28. Submissions close at `2026-09-03T20:00:00Z` (`2026-09-04 06:00` Australia/Melbourne). There were no host announcements at the time of the check.

## Project identity

- **Name:** HS: Heist
- **Tagline:** Switch bodies. Share risk. Remember the failure.
- **Status:** New project
- **Submitter type:** Individual
- **Country:** Australia
- **License:** MIT
- **Built with:** WebMCP, TypeScript 7, React 19, Babylon.js 9, Vite 8, Web Audio API, localStorage, Oxlint, Vitest, Playwright

## Submission description draft

HS: Heist is a short first-person action game built around uneasy trust between a human and a WebMCP agent. Owen “Aye” Mercer and Cody “X” Vance are escaping a locked-down facility. The human controls one infiltrator while the agent controls the other, and switching perspective transfers the abandoned body—and its current danger—to the agent.

The pair must survive two compact combat spaces, coordinate a planter-and-detonator bomb breach, and escape in a getaway car where one drives and the other shoots pursuing vehicles. Either character can be eliminated, the car can be destroyed, three consequential mistakes compromise the mission, and a required agent decision that arrives too late fails the checkpoint. This is not a chatbot pasted beside a game: removing WebMCP removes the second decision-maker and leaves the mission unable to start.

WebMCP improves the experience because the agent sees structured mission state rather than guessing from pixels. Ten top-level imperative tools let it join, receive sequenced events, choose tactics, resolve time-sensitive decisions, prioritize visible pursuers, speak through always-visible radio subtitles, inspect memory, record evidence-backed lessons, and read the debrief. Tool actions pass through the same typed mission store as human input, so the agent changes the live Babylon.js world instead of narrating imaginary actions.

The adaptation loop is deliberately inspectable. A consequential failure can become a structured lesson stored locally and rendered as deterministic Markdown. A later action cites the exact lesson ID it used, and the debrief shows the link between failure, lesson, and changed tactic. The project never claims model retraining or fine-tuning; “learning” means persistent evidence-backed memory plus a visibly different later choice.

The result is something a conventional scripted companion or separate chatbot cannot provide: a human learns the weaknesses of an imperfect partner while that partner accumulates explicit lessons from their shared history. Both sides must work around each other rather than merely issue or obey commands.

## WebMCP implementation proof

The top-level page registers these ten tools with `document.modelContext.registerTool`:

1. `join_heist`
2. `get_mission_briefing`
3. `wait_for_mission_event`
4. `set_partner_tactic`
5. `resolve_partner_decision`
6. `prioritize_pursuer`
7. `send_radio_message`
8. `read_partner_memory`
9. `record_partner_lesson`
10. `get_run_debrief`

The event wait is bounded and abortable. Session IDs, decision IDs, actions, deadlines, and lesson evidence are validated. Unsupported browsers remain on the honest waiting screen; there is no production fallback agent.

## AI tools used

- OpenAI Codex was the primary implementation, integration, research, test, debugging, and review agent.
- Raw Cursor CLI was used for bounded visual passes. Claude Opus 5 High shaped the application shell/pairing treatment; Grok 4.6 High refined the procedural facility and chase presentation. Cursor MCP was not used.
- Every delegated visual result was reviewed, integrated, and re-verified in the repository.

## Current verification evidence

- TypeScript strict build: passing.
- Oxlint with warnings denied: passing.
- Vitest: 23 files / 97 tests passing in the final clean release gate.
- Playwright: 4 end-to-end journeys passing in a production test-mode build in the final clean release gate.
- The browser journeys invoke the actual registered tool handlers for pairing, direct agent instructions, pre-mission subtitles, bomb decisions, failure evidence, memory creation, pursuer prioritization, and debrief.
- Pointer-lock request/event wiring and deliberate denial recovery, movement, default sprint, right-mouse aim, firing/ammunition, active enemy combat, interactive training, minimap states, and free switching are covered through a test-only browser host shim.
- Xbox/PlayStation mappings, dead zones, input switching, controller-only aim assistance, audio intensity, grounded movement, enemy tactics, and view-model poses have deterministic unit coverage.
- Chrome, Zen, and Safari are installed on the development machine. No supported controller was connected during the release gate, so physical controller feel is not claimed.
- Physical mouse/controller play and a real ChatGPT/Chrome WebMCP host still require final human QA after deployment.
- Production build: passing. Its lazy Babylon runtime chunk is approximately 1.0 MB minified / 252 KB gzip and produces Vite's non-blocking large-chunk advisory.

## Screenshot shortlist

- `docs/hackathon-build/evidence/facility.jpg` — first-person facility, both health bars, enemies, cover, objective, and HUD.
- `docs/hackathon-build/evidence/chase.jpg` — rear-gunner chase perspective with the getaway HUD and pursuing vehicles.
- `docs/hackathon-build/evidence/debrief.jpg` — completed run showing failure evidence, lesson, and changed tactic.

The first two are gameplay proof; the debrief is the clearest static proof of the project thesis. A dedicated square/landscape thumbnail should be composed during submission preparation rather than uploading a raw HUD screenshot.

## Under-three-minute demo shot list

Target: approximately 2 minutes 35 seconds.

1. **0:00–0:12 — Cold open:** black `RealSid Games Presents` → `HS` / `Heist` title.
2. **0:12–0:28 — Agent-native premise:** show `WAITING FOR PARTNER`, ask Codex to join, then show `PARTNER ONLINE` and enabled start.
3. **0:28–0:52 — Shared bodies:** enter the facility, show both health bars, send an in-game callout, let the agent answer through a radio subtitle, then use the cinematic character switch.
4. **0:52–1:20 — Asymmetric dependence:** at the blast gate, show the agent choosing `PLANT`, the forced Owen lock, the agent retreating, and the human detonating.
5. **1:20–1:43 — Real failure:** enter the chase, let sustained pursuer fire destroy the car, and show the two-second `VEHICLE DESTROYED` checkpoint card.
6. **1:43–2:08 — Inspectable adaptation:** record the failure-backed lesson, show its Markdown memory entry, replay the checkpoint, and have the agent cite the lesson while prioritizing the closest pursuer.
7. **2:08–2:25 — Success:** show the changed targeting, escape, and `HEIST COMPLETE`.
8. **2:25–2:35 — Thesis card:** zoom the debrief’s failure → lesson → tactic link and end on “Switch bodies. Share risk. Remember the failure.”

Record real tool calls and the live game in one continuous supported-host session where practical. Do not imply that the test harness is ChatGPT or that local memory retrains a model.

## Candid judging alignment

- **WebMCP Leverage:** strong. The agent owns a necessary character through a non-trivial observation/action/memory loop rather than exposing convenience commands.
- **Execution:** strong locally. The slice has pairing, title, gameplay, failure, recovery, persistence, audio, and debrief, but this score is not secure until the public deployment and real host work.
- **Creativity & Ambition:** strong. Perspective ownership and inspectable partner adaptation are unusual uses of WebMCP.
- **Potential Impact:** the weakest argument if described only as “a cool game.” Frame the credible audience as game designers and agent developers exploring understandable, failure-capable companions, and demonstrate why structured tools make those companions more trustworthy than screen-driving or hidden behavior trees.

## Required before `$prepare-submission`

- Create and push a public GitHub/GitLab/Bitbucket repository; confirm the MIT license is detected at the top of the repo.
- Deploy the normal production build to a public HTTPS URL.
- Test all ten tools through ChatGPT’s in-app browser or Chrome with WebMCP enabled and record the exact tested client(s).
- Run one physical keyboard/external-mouse play-through, one Xbox or PlayStation controller play-through, and one failure → lesson → changed-action loop on the deployed build.
- Record and publish the under-three-minute YouTube demo with audio.
- Choose the final thumbnail and public screenshots.
- Supply the public live URL, public repo URL, video URL, and any final submission answers.

Do not submit until those external proof points are complete and explicitly approved.
