/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { manifest: true, target: 'es2022' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // fiber, drei and maath ship a CJS entry that require()s three.cjs, which warns once per worker.
    // The warning comes from those packages, not from our code: silence only that code.
    execArgv: ['--disable-warning=THREE_CJS_DEPRECATED'],
  },
})
