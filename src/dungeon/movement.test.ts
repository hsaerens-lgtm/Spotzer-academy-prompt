import { ahead, step, type Pose } from './movement'

const open = (cells: string[]) => (x: number, y: number) => cells.includes(`${x},${y}`)

test('forward, back and strafes move one cell; turns stay put', () => {
  const pose: Pose = { x: 2, y: 2, dir: 'N' }
  const all = () => true
  expect(step(pose, 'forward', all).pose).toEqual({ x: 2, y: 1, dir: 'N' })
  expect(step(pose, 'back', all).pose).toEqual({ x: 2, y: 3, dir: 'N' })
  expect(step(pose, 'strafeLeft', all).pose).toEqual({ x: 1, y: 2, dir: 'N' })
  expect(step(pose, 'strafeRight', all).pose).toEqual({ x: 3, y: 2, dir: 'N' })
  expect(step(pose, 'turnLeft', all)).toEqual({ pose: { x: 2, y: 2, dir: 'W' }, bumped: false, turned: true })
  expect(step({ ...pose, dir: 'W' }, 'turnRight', all).pose.dir).toBe('N')
  expect(ahead({ x: 2, y: 2, dir: 'E' })).toEqual({ x: 3, y: 2 })
})

test('a closed cell bumps without moving', () => {
  expect(step({ x: 1, y: 1, dir: 'E' }, 'forward', open(['1,1']))).toEqual({ pose: { x: 1, y: 1, dir: 'E' }, bumped: true, turned: false })
})
