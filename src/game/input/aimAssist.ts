import type { InputDevice } from './inputBindings';

export interface AimAssistCandidate {
  id: string;
  alive: boolean;
  visible: boolean;
  angularError: number;
  distance: number;
  yawError: number;
  pitchError: number;
}

export function chooseAimAssistTarget<T extends AimAssistCandidate>(
  candidates: readonly T[],
  options: { coneRadians: number; maxDistance?: number },
): T | null {
  const maxDistance = options.maxDistance ?? 80;
  const eligible = candidates.filter(
    (candidate) =>
      candidate.alive &&
      candidate.visible &&
      candidate.angularError <= options.coneRadians &&
      candidate.distance <= maxDistance,
  );
  if (eligible.length === 0) return null;
  return [...eligible].sort(
    (left, right) =>
      left.angularError * 4 + left.distance / 100 -
      (right.angularError * 4 + right.distance / 100),
  )[0] ?? null;
}

export function computeAimAssistCorrection(
  target: AimAssistCandidate | null,
  context: { inputDevice: InputDevice; aiming: boolean; deltaSeconds: number },
): { yaw: number; pitch: number; slowdown: number } {
  if (!target || context.inputDevice === 'KEYBOARD_MOUSE' || !target.alive || !target.visible) {
    return { yaw: 0, pitch: 0, slowdown: 1 };
  }
  const strength = context.aiming ? 0.2 : 0.1;
  const maxCorrection = (context.aiming ? 0.25 : 0.22) * Math.max(0, context.deltaSeconds);
  const clamp = (value: number) => Math.min(Math.max(value, -maxCorrection), maxCorrection);
  return {
    yaw: clamp(target.yawError * strength),
    pitch: clamp(target.pitchError * strength),
    slowdown: context.aiming ? 0.58 : 0.8,
  };
}
