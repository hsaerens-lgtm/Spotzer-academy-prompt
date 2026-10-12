import { readFileSync } from 'node:fs'
import { blocksFileSchema, type BlocksFile } from '../src/workshop/model.ts'

/** The same block definitions as the workshop interface, so Ada and the real AI speak the same language. */
export function loadBlocks(path: string): BlocksFile {
  return blocksFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')))
}
