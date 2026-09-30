export function detectWebGL2(doc: Document = document): boolean {
  try {
    return doc.createElement('canvas').getContext('webgl2') !== null
  } catch {
    return false
  }
}
