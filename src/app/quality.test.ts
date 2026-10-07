import {
  INITIAL_QUALITY,
  QUALITY_SETTINGS,
  SOFTWARE_DPR,
  dprFor,
  isSoftwareRenderer,
  nextQuality,
  reduceQuality,
  rendererName,
  type QualityState,
} from './quality'

test('declining lowers the resolution first, then drops shadows', () => {
  expect(nextQuality('high', 'decline')).toBe('medium')
  expect(nextQuality('medium', 'decline')).toBe('low')
  expect(nextQuality('low', 'decline')).toBe('low')
})

test('inclining climbs back, fallback goes straight to low', () => {
  expect(nextQuality('low', 'incline')).toBe('medium')
  expect(nextQuality('medium', 'incline')).toBe('high')
  expect(nextQuality('high', 'fallback')).toBe('low')
})

test('pixel ratio per level', () => {
  expect(dprFor('high')).toEqual([1, 1.5])
  expect(dprFor('medium')).toBe(1)
  expect(dprFor('low')).toBe(1)
})

test('a fast machine keeps high quality however often it reports an incline', () => {
  let state: QualityState = INITIAL_QUALITY
  for (let i = 0; i < 20; i++) state = reduceQuality(state, 'incline')
  expect(state).toEqual({ level: 'high', changes: 0, settled: false })
  expect(state).toBe(INITIAL_QUALITY)
})

test('sustained declines step down to low, then stay there without settling', () => {
  let state: QualityState = INITIAL_QUALITY
  const levels: string[] = []
  for (let i = 0; i < 20; i++) {
    state = reduceQuality(state, 'decline')
    levels.push(state.level)
  }
  expect(levels.slice(0, 3)).toEqual(['medium', 'low', 'low'])
  expect(new Set(levels)).toEqual(new Set(['medium', 'low']))
  expect(state).toEqual({ level: 'low', changes: 2, settled: false })
})

test('flip-flopping between levels settles on low for good', () => {
  let state: QualityState = INITIAL_QUALITY
  for (const event of ['decline', 'incline', 'decline', 'incline'] as const) state = reduceQuality(state, event)
  expect(state).toMatchObject({ level: 'low', settled: true })
  const settled = state
  expect(reduceQuality(settled, 'incline')).toBe(settled)
  expect(reduceQuality(settled, 'decline')).toBe(settled)
})

// Spec section 7: what each tier keeps.
test('each tier matches the spec table', () => {
  expect(QUALITY_SETTINGS.high).toEqual({ dpr: [1, 1.5], shadowMapSize: 2048, accentLights: true, animatePlants: true, animateCityWindows: true })
  expect(QUALITY_SETTINGS.medium).toEqual({ dpr: 1, shadowMapSize: 1024, accentLights: false, animatePlants: true, animateCityWindows: true })
  expect(QUALITY_SETTINGS.low).toEqual({ dpr: 1, shadowMapSize: 0, accentLights: false, animatePlants: false, animateCityWindows: false })
  for (const quality of ['high', 'medium', 'low'] as const) expect(dprFor(quality)).toBe(QUALITY_SETTINGS[quality].dpr)
})

test('software rasterizers are recognised by their renderer name', () => {
  expect(isSoftwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe(true)
  expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true)
  expect(isSoftwareRenderer('ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(true)
  expect(isSoftwareRenderer('ANGLE (AMD, AMD Radeon(TM) 860M Graphics (0x00001114) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe(false)
  expect(isSoftwareRenderer('Apple M2')).toBe(false)
  // Chrome masks the name behind WEBGL_debug_renderer_info; other browsers give it directly.
  const context = (renderer: string, unmasked: string | null) => ({
    RENDERER: 1,
    getParameter: (name: number) => (name === 1 ? renderer : unmasked),
    getExtension: () => (unmasked === null ? null : { UNMASKED_RENDERER_WEBGL: 2 }),
  })
  expect(rendererName(context('WebKit WebGL', 'ANGLE (Google, SwiftShader driver)'))).toBe('ANGLE (Google, SwiftShader driver)')
  expect(rendererName(context('llvmpipe (LLVM 15.0.7, 256 bits)', null))).toBe('llvmpipe (LLVM 15.0.7, 256 bits)')
  expect(rendererName(context('WebKit WebGL', null))).toBe('WebKit WebGL')
})

test('a software rasterizer settles on low at once, at a reduced resolution', () => {
  expect(reduceQuality(INITIAL_QUALITY, 'software')).toEqual({ level: 'low', changes: 0, settled: true })
  const settled = reduceQuality(INITIAL_QUALITY, 'software')
  expect(reduceQuality(settled, 'incline')).toBe(settled)
  expect(SOFTWARE_DPR).toBe(0.35)
})
