let areaLightTables: Promise<void> | null = null
let built = false

/**
 * Area lights need their lookup tables in the WebGL renderer before the first one is drawn. The tables (about
 * 0.1 MB of JS) load once, outside the initial chunk, when the 3D stage asks for them (baseAssets.ts, Lights.tsx):
 * reading mode never builds them. A failed load is forgotten, so the next call tries again.
 */
export function areaLightTablesReady(): Promise<void> {
  areaLightTables ??= import('three/addons/lights/RectAreaLightUniformsLib.js').then(
    ({ RectAreaLightUniformsLib }) => {
      RectAreaLightUniformsLib.init()
      built = true
    },
    (error: unknown) => {
      areaLightTables = null
      throw error
    },
  )
  return areaLightTables
}

/** The tables are in the renderer: a rig mounted now needs no wait (React suspends even on a settled promise it has not read yet). */
export function areaLightTablesBuilt(): boolean {
  return built
}
