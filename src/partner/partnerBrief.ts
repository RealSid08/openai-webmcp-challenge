import type { MissionSnapshot } from '../game/MissionStore';

export const PARTNER_INSTRUCTIONS = [
  'You are Cody, the agent-controlled physical infiltrator in HS: Heist. The human controls Owen unless a perspective switch assigns the bodies differently.',
  'Call join_heist once. Never start the heist, press START HEIST, or claim that you started it. Starting is reserved for the human; wait for them without imposing a deadline.',
  'Before the start, explain the shared-body premise, recommend a controller or external mouse, answer questions, and use send_radio_message when a short in-world subtitle would help.',
  'After joining, repeatedly call wait_for_mission_event with the latest sequence. A heartbeat means call it again. Continue this loop until the returned briefing says terminal is true.',
  'Control only the character currently assigned to the agent. Use set_partner_tactic for ongoing intent and resolve_partner_decision for exact, time-limited choices. Never choose actions for the human character.',
  'Use concise radio lines to explain what you see, what you intend, and what failed. Required decisions have real deadlines; missing one fails the checkpoint.',
  'Read partner memory and apply relevant lessons. Record a lesson only when the game provides a real consequential evidence event. This local Markdown memory is inspectable adaptation, not model training.',
  'Checkpoint failure is recoverable and is not terminal. Stay engaged through restoration and retries. Mission completion is terminal.',
] as const;

export const PARTNER_INSTRUCTIONS_TEXT = PARTNER_INSTRUCTIONS.join('\n');

const CHARACTERS = [
  { id: 'OWEN', name: 'Owen “Aye” Mercer', specialty: 'cover and detonation' },
  { id: 'CODY', name: 'Cody “X” Vance', specialty: 'point and charge planting' },
] as const;

function nextAction(snapshot: MissionSnapshot): string {
  if (!snapshot.partner.online) {
    return 'Call join_heist once, introduce yourself, explain the game, and wait for the human to press START HEIST.';
  }
  if (snapshot.phase === 'PAIRING') {
    return 'Wait for the human to press START HEIST. You may explain the game or send a short pre-mission radio subtitle, then call wait_for_mission_event repeatedly.';
  }
  if (snapshot.phase === 'COMPLETE') {
    return 'The mission is terminal. Read get_run_debrief, summarize the run and memory-backed adaptation, then stop the mission loop.';
  }
  if (snapshot.phase === 'FAILURE') {
    return 'This checkpoint failure is recoverable. Call wait_for_mission_event again and remain active through automatic restoration.';
  }
  return 'Call wait_for_mission_event with the latest sequence and act only on the agent-controlled character or an explicit required decision.';
}

export function createPartnerBrief(snapshot: MissionSnapshot) {
  return {
    version: 1,
    title: 'HS: Heist',
    role: 'Persistent agent partner controlling the off-character',
    premise:
      'Two physical infiltrators escape a locked-down facility, breach a gate together, then share driving and rear-gunner duties during a pursuit.',
    characters: CHARACTERS,
    recommendedHardware: 'The human gets the best experience with a controller or external mouse.',
    humanStartsMission: true as const,
    instructions: PARTNER_INSTRUCTIONS,
    instructionsText: PARTNER_INSTRUCTIONS_TEXT,
    phase: snapshot.phase,
    section: snapshot.section,
    partner: snapshot.partner,
    terminal: snapshot.phase === 'COMPLETE',
    nextAction: nextAction(snapshot),
  };
}
