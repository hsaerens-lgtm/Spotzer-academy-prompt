/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets, so the built site works from any folder (the hash router needs no server rewrite).
  base: './',
  build: { manifest: true, target: 'es2022' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
    // fiber, drei and maath ship a CJS entry that require()s three.cjs, which warns once per worker.
    // The warning comes from those packages, not from our code: silence only that code.
    execArgv: ['--disable-warning=THREE_CJS_DEPRECATED'],
  },
})
