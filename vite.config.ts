/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { DEFAULT_PORT } from './server/config.ts'

// The browser only ever calls /api on its own origin; in development Vite forwards it to the corrector proxy, which
// "npm run dev" binds to 127.0.0.1 (an explicit address: "localhost" may resolve to ::1, where nothing listens).
const apiProxy = { '/api': { target: `http://127.0.0.1:${process.env.PORT ?? DEFAULT_PORT}` } }

export default defineConfig({
  plugins: [react()],
  // Relative assets, so the built site works from any folder (the hash router needs no server rewrite).
  base: './',
  build: { manifest: true, target: 'es2022' },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'scripts/**/*.test.mjs'],
    // fiber, drei and maath ship a CJS entry that require()s three.cjs, which warns once per worker.
    // The warning comes from those packages, not from our code: silence only that code.
    execArgv: ['--disable-warning=THREE_CJS_DEPRECATED'],
  },
})
