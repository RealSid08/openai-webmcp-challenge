import '@testing-library/jest-dom/vitest';

// Node 25+ defines a global Web Storage getter before Vitest creates jsdom.
// Vitest can therefore leave `window.localStorage` pointing at Node's undefined
// value instead of jsdom's Storage. Resolve through the current jsdom instance
// so every isolated test file receives its own live browser storage object.
const vitestGlobal = globalThis as typeof globalThis & {
  jsdom?: { window: { localStorage: Storage } };
};
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  get: () => vitestGlobal.jsdom?.window.localStorage,
});

afterEach(() => {
  document.body.innerHTML = '';
  window.localStorage?.clear();
});
