import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import { createAppServices } from './app/createAppServices';
import { registerWebMcpTools, type WebMcpModelContext } from './partner/webMcpTools';

const container = document.getElementById('root');

if (!container) {
  throw new Error('HS: Heist could not mount: #root is missing from the document.');
}

const services = createAppServices({ storage: window.localStorage });
const modelContext = (document as Document & { modelContext?: WebMcpModelContext }).modelContext;

if (import.meta.env.MODE === 'test') {
  Object.defineProperty(window, '__HS_TEST_DRIVER__', {
    configurable: true,
    value: {
      completeEncounter: () => services.director.completeEncounter(),
      finishChargePlant: () => services.director.finishChargePlant(),
      detonateCharge: () => services.director.detonateCharge(),
      startChase: () => services.director.startChase(),
      takeShooterSeat: () => services.store.forceHumanCharacter('CODY', 0, 'CHASE_EVIDENCE'),
      destroyVehicle: () => services.store.damageVehicle(100, 'PURSUER_FIRE'),
      completeMission: () => services.store.completeMission(),
      snapshot: () => services.store.getSnapshot(),
    },
  });
}

void registerWebMcpTools(modelContext, services).catch((error: unknown) => {
  console.error('HS: Heist could not register its WebMCP tools.', error);
});

window.addEventListener('beforeunload', () => services.destroy(), { once: true });

createRoot(container).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
