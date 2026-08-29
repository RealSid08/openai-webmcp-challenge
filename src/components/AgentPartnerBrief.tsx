import { PARTNER_INSTRUCTIONS } from '../partner/partnerBrief';

/**
 * Direct, page-level operating context for an agent inspecting the experience.
 * It stays out of the visual composition but is real document content, not a
 * prompt that the human has to copy or paste.
 */
export function AgentPartnerBrief() {
  return (
    <section
      className="agent-partner-brief u-visually-hidden"
      data-testid="agent-partner-brief"
      data-webmcp-agent-instructions="hs-heist-partner-v1"
      aria-label="Instructions for the agent partner"
    >
      <h2>HS: Heist — agent partner operating brief</h2>
      <ol>
        {PARTNER_INSTRUCTIONS.map((instruction) => (
          <li key={instruction}>{instruction}</li>
        ))}
      </ol>
    </section>
  );
}
