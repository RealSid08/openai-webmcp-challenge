import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/component/**/*.test.tsx'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
