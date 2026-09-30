export function detectWebGL2(doc: Document = document): boolean {
  try {
    return doc.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}

/**
 * Listener for 'webglcontextlost'. R3F force-loses the context of a canvas it unmounts on purpose
 * (reading mode, zone change): that detached canvas must not be reported as a device failure.
 */
export function onContextLost(canvas: HTMLCanvasElement, report: () => void) {
  return (event: Event) => {
    event.preventDefault()
    if (!canvas.isConnected) return
    report()
  }
}
