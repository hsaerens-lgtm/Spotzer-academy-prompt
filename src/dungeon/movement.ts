export type Dir = 'N' | 'E' | 'S' | 'W'
export interface Cell {
  x: number
  y: number
}
export interface Pose extends Cell {
  dir: Dir
}
export type Command = 'forward' | 'back' | 'turnLeft' | 'turnRight' | 'strafeLeft' | 'strafeRight'

const ORDER: Dir[] = ['N', 'E', 'S', 'W']
/** North is up the map (y - 1). */
export const DELTA: Record<Dir, Cell> = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } }

export const turned = (dir: Dir, quarter: 1 | -1): Dir => ORDER[(ORDER.indexOf(dir) + quarter + 4) % 4]
export const ahead = (pose: Pose): Cell => ({ x: pose.x + DELTA[pose.dir].x, y: pose.y + DELTA[pose.dir].y })

/** One command from `pose`. `isOpen` says whether a cell can be entered. */
export function step(pose: Pose, command: Command, isOpen: (x: number, y: number) => boolean): { pose: Pose; bumped: boolean; turned: boolean } {
  if (command === 'turnLeft' || command === 'turnRight') {
    return { pose: { ...pose, dir: turned(pose.dir, command === 'turnLeft' ? -1 : 1) }, bumped: false, turned: true }
  }
  const towards =
    command === 'forward' ? pose.dir : command === 'back' ? turned(turned(pose.dir, 1), 1) : turned(pose.dir, command === 'strafeLeft' ? -1 : 1)
  const x = pose.x + DELTA[towards].x
  const y = pose.y + DELTA[towards].y
  return isOpen(x, y) ? { pose: { ...pose, x, y }, bumped: false, turned: false } : { pose, bumped: true, turned: false }
}
