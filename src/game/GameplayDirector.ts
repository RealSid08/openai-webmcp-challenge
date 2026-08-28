import type { PartnerCoordinator, ResolvedPartnerDecision } from '../partner/PartnerCoordinator';
import type { MissionStore } from './MissionStore';

type SteeringAction = 'LEFT' | 'RIGHT' | 'HOLD';

interface GameplayDirectorOptions {
  store: MissionStore;
  coordinator: PartnerCoordinator;
  createId: () => string;
}

export class GameplayDirector {
  private partnerClearOfCharge = false;
  private steeringAction: SteeringAction | null = null;
  private readonly unsubscribeDecision: () => void;

  constructor(private readonly options: GameplayDirectorOptions) {
    this.unsubscribeDecision = options.coordinator.onDecisionResolved((decision) =>
      this.handleDecision(decision),
    );
  }

  completeEncounter():
    | { ok: true; advancedTo: 'FACILITY_TWO' | 'BOMB_GATE' }
    | { ok: false; reason: 'NO_ACTIVE_ENCOUNTER' } {
    const section = this.options.store.getSnapshot().section;
    if (section === 'FACILITY_ONE') {
      this.options.store.activateRoomOneCheckpoint();
      return { ok: true, advancedTo: 'FACILITY_TWO' };
    }
    if (section === 'FACILITY_TWO') {
      this.options.store.enterBombGate();
      this.requestDecision('BOMB_PLANT', ['PLANT', 'WAIT', 'RETREAT'], 30_000);
      return { ok: true, advancedTo: 'BOMB_GATE' };
    }
    return { ok: false, reason: 'NO_ACTIVE_ENCOUNTER' };
  }

  finishChargePlant(): { ok: true } | { ok: false; reason: string } {
    const armed = this.options.store.armCharge();
    if (!armed.ok) return armed;
    this.partnerClearOfCharge = false;
    this.requestDecision('BOMB_RETREAT', ['RETREAT', 'WAIT'], 24_000);
    return { ok: true };
  }

  detonateCharge():
    | { ok: true; safe: boolean }
    | { ok: false; reason: string } {
    return this.options.store.detonateCharge(this.partnerClearOfCharge);
  }

  startChase(): { ok: true } | { ok: false; reason: 'GATE_NOT_OPEN' } {
    if (this.options.store.getSnapshot().bomb.state !== 'DETONATED') {
      return { ok: false, reason: 'GATE_NOT_OPEN' };
    }
    this.options.store.activateChaseCheckpoint();
    return { ok: true };
  }

  requestChaseTurn(
    turn: 1 | 2,
  ): { ok: true; controller: 'HUMAN' | 'AGENT' } | { ok: false; reason: 'CHASE_NOT_ACTIVE' } {
    const snapshot = this.options.store.getSnapshot();
    if (snapshot.section !== 'CHASE' || snapshot.phase !== 'MISSION') {
      return { ok: false, reason: 'CHASE_NOT_ACTIVE' };
    }
    if (snapshot.humanCharacter === 'CODY') {
      this.requestDecision(`CHASE_TURN_${turn}`, ['LEFT', 'RIGHT', 'HOLD'], 20_000);
      return { ok: true, controller: 'AGENT' };
    }
    return { ok: true, controller: 'HUMAN' };
  }

  consumeSteeringAction(): SteeringAction | null {
    const action = this.steeringAction;
    this.steeringAction = null;
    return action;
  }

  isPartnerClearOfCharge(): boolean {
    return this.partnerClearOfCharge;
  }

  destroy(): void {
    this.unsubscribeDecision();
  }

  private requestDecision(kind: string, actions: readonly string[], timeoutMs: number): void {
    this.options.store.openRequiredDecision({
      id: this.options.createId(),
      kind,
      actions,
      timeoutMs,
    });
  }

  private handleDecision(decision: ResolvedPartnerDecision): void {
    if (decision.kind === 'BOMB_PLANT') {
      if (decision.action === 'PLANT') {
        this.options.store.startChargePlant();
        this.options.store.forceHumanCharacter('OWEN', 20_000, 'CODY_PLANTING');
        return;
      }
      this.options.store.recordCriticalIncident('DELAYED_CHARGE_PLANT');
      if (this.options.store.getSnapshot().phase === 'MISSION') {
        this.requestDecision('BOMB_PLANT', ['PLANT', 'WAIT', 'RETREAT'], 24_000);
      }
      return;
    }

    if (decision.kind === 'BOMB_RETREAT') {
      if (decision.action === 'RETREAT') {
        this.partnerClearOfCharge = true;
        this.options.coordinator.publish({
          type: 'PARTNER_CLEAR_OF_CHARGE',
          summary: 'Cody reached the marked safe zone. Owen can detonate.',
        });
        return;
      }
      this.options.store.recordCriticalIncident('PARTNER_REMAINED_IN_BLAST_ZONE');
      if (this.options.store.getSnapshot().phase === 'MISSION') {
        this.requestDecision('BOMB_RETREAT', ['RETREAT', 'WAIT'], 18_000);
      }
      return;
    }

    if (decision.kind.startsWith('CHASE_TURN_')) {
      if (decision.action === 'LEFT' || decision.action === 'RIGHT' || decision.action === 'HOLD') {
        this.steeringAction = decision.action;
      }
    }
  }
}
