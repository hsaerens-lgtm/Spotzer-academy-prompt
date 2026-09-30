import { MOODS } from '../../content/schema'
import { eyeShapes, faceKey } from './face'

test('each mood has its eye shapes and blinking closes both eyes', () => {
  expect(eyeShapes('neutral', false)).toEqual(['round', 'round'])
  expect(eyeShapes('happy', false)).toEqual(['happy', 'happy'])
  expect(eyeShapes('thinking', false)).toEqual(['dots', 'dots'])
  expect(eyeShapes('surprised', false)).toEqual(['big', 'big'])
  expect(eyeShapes('encouraging', false)).toEqual(['round', 'wink'])
  for (const mood of MOODS) expect(eyeShapes(mood, true)).toEqual(['closed', 'closed'])
})

test('the face is redrawn only when something visible changes', () => {
  const round = eyeShapes('neutral', false)
  expect(faceKey(round, 0.1, 0, 0, 1)).toBe(faceKey(round, 0.1, 0, 0, 5))
  expect(faceKey(round, 0.1, 0, 0, 1)).not.toBe(faceKey(round, 0.2, 0, 0, 1))
  const dots = eyeShapes('thinking', false)
  expect(faceKey(dots, 0, 0, 0, 0)).not.toBe(faceKey(dots, 0, 0, 0, 0.3))
})
