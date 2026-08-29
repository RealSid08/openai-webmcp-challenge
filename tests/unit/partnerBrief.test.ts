import { MissionStore } from '../../src/game/MissionStore';
import {
  PARTNER_INSTRUCTIONS,
  PARTNER_INSTRUCTIONS_TEXT,
  createPartnerBrief,
} from '../../src/partner/partnerBrief';

describe('agent partner brief', () => {
  it('gives the agent an explicit continuous loop while reserving mission start for the human', () => {
    const store = new MissionStore({ now: () => 1_000, createId: () => 'brief-session' });
    const briefing = createPartnerBrief(store.getSnapshot());

    expect(briefing.instructions).toEqual(PARTNER_INSTRUCTIONS);
    expect(briefing.instructionsText).toBe(PARTNER_INSTRUCTIONS_TEXT);
    expect(briefing.humanStartsMission).toBe(true);
    expect(briefing.terminal).toBe(false);
    expect(briefing.nextAction).toContain('join_heist');
    expect(PARTNER_INSTRUCTIONS_TEXT).toContain('Never start the heist');
    expect(PARTNER_INSTRUCTIONS_TEXT).toContain('wait_for_mission_event');
    expect(PARTNER_INSTRUCTIONS_TEXT).toContain('terminal');
  });

  it('keeps a joined partner waiting before start and marks only completion terminal', () => {
    const store = new MissionStore({ now: () => 1_000, createId: () => 'brief-session' });
    store.joinPartner('Codex');

    const paired = createPartnerBrief(store.getSnapshot());
    expect(paired.nextAction).toContain('Wait for the human');
    expect(paired.nextAction).toContain('wait_for_mission_event');
    expect(paired.terminal).toBe(false);

    store.startMission();
    const title = createPartnerBrief(store.getSnapshot());
    expect(title.nextAction).toContain('wait_for_mission_event');
    expect(title.terminal).toBe(false);
  });
});
