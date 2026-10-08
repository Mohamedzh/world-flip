import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    // Phaser is one large module; it is expected to exceed the default warning size.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
