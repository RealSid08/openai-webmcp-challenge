import '@testing-library/jest-dom/vitest';

afterEach(() => {
  document.body.innerHTML = '';
  window.localStorage?.clear();
});
