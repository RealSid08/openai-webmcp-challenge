import { useSyncExternalStore } from 'react';

import type { MissionSnapshot, MissionStore } from '../game/MissionStore';

export function useMissionSnapshot(store: MissionStore): MissionSnapshot {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.getSnapshot(),
    () => store.getSnapshot(),
  );
}
