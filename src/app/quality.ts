import { createContext, useContext } from 'react'

export type Quality = 'high' | 'medium' | 'low'

export const QualityContext = createContext<Quality>('high')

/** What a quality tier turns on (spec section 7). */
export interface QualitySettings {
  dpr: number | [number, number]
  /** Sun shadow map in pixels; 0: no dynamic shadow. */
  shadowMapSize: 0 | 1024 | 2048
  /** Ceiling-line area lights and the pendant light. */
  accentLights: boolean
  animatePlants: boolean
  /** City windows switch on and off over time; frozen when false. */
  animateCityWindows: boolean
}

export const QUALITY_SETTINGS: Record<Quality, QualitySettings> = {
  high: { dpr: [1, 1.5], shadowMapSize: 2048, accentLights: true, animatePlants: true, animateCityWindows: true },
  medium: { dpr: 1, shadowMapSize: 1024, accentLights: false, animatePlants: true, animateCityWindows: true },
  low: { dpr: 1, shadowMapSize: 0, accentLights: false, animatePlants: false, animateCityWindows: false },
}

/** The settings of the current tier. Inside the Canvas (Stage provides QualityContext). */
export function useQualitySettings(): QualitySettings {
  return QUALITY_SETTINGS[useContext(QualityContext)]
}

/**
 * A rasterizer without GPU (SwiftShader in the e2e browser, llvmpipe, the Windows Basic Render Driver) draws the
 * office at a few frames per second: Stage starts it on the low tier, settled, at SOFTWARE_DPR.
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render/i
export const SOFTWARE_DPR = 0.35

export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer)
}

/**
 * True once Stage has found a software rasterizer: the office then hides what costs the most per frame and no journey
 * needs (the street trees, Task 8). Never true on a GPU: the spec's tier table applies unchanged on the reference PC.
 */
export const SoftwareRendererContext = createContext(false)

/** Inside the Canvas (Stage provides SoftwareRendererContext). */
export function useSoftwareRenderer(): boolean {
  return useContext(SoftwareRendererContext)
}

/** The part of a WebGL context that rendererName reads. */
export interface RendererInfoSource {
  RENDERER: number
  getParameter(name: number): unknown
  getExtension(name: 'WEBGL_debug_renderer_info'): { UNMASKED_RENDERER_WEBGL: number } | null
}

/** The renderer's real name: Chrome reports "WebKit WebGL" and keeps the real one behind WEBGL_debug_renderer_info. */
export function rendererName(gl: RendererInfoSource): string {
  const name = String(gl.getParameter(gl.RENDERER))
  if (!/^webkit webgl$/i.test(name)) return name
  const debug = gl.getExtension('WEBGL_debug_renderer_info')
  return debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : name
}

const ORDER: Quality[] = ['low', 'medium', 'high']

export function nextQuality(current: Quality, event: 'decline' | 'incline' | 'fallback'): Quality {
  if (event === 'fallback') return 'low'
  const index = ORDER.indexOf(current) + (event === 'incline' ? 1 : -1)
  return ORDER[Math.min(ORDER.length - 1, Math.max(0, index))]
}

export function dprFor(quality: Quality): number | [number, number] {
  return QUALITY_SETTINGS[quality].dpr
}

export interface QualityState {
  level: Quality
  changes: number
  settled: boolean
}
export const INITIAL_QUALITY: QualityState = { level: 'high', changes: 0, settled: false }
const MAX_CHANGES = 3

/**
 * Only real level changes count as flip-flops; after too many, settle on low for good.
 * 'software': the renderer has no GPU (isSoftwareRenderer), settle on low at once.
 */
export function reduceQuality(state: QualityState, event: 'decline' | 'incline' | 'software'): QualityState {
  if (event === 'software') return { level: 'low', changes: state.changes, settled: true }
  if (state.settled) return state
  const level = nextQuality(state.level, event)
  if (level === state.level) return state
  const changes = state.changes + 1
  if (changes > MAX_CHANGES) return { level: nextQuality(level, 'fallback'), changes, settled: true }
  return { level, changes, settled: false }
}
