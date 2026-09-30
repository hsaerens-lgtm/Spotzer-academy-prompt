import { LOGO_H, LOGO_W, logoBoxes } from './logo'

test('the logo mark becomes five centred boxes', () => {
  const boxes = logoBoxes(1)
  expect(boxes).toHaveLength(5)
  const xs = boxes.flatMap((b) => [b.position[0] - b.size[0] / 2, b.position[0] + b.size[0] / 2])
  const ys = boxes.flatMap((b) => [b.position[1] - b.size[1] / 2, b.position[1] + b.size[1] / 2])
  expect(Math.min(...xs)).toBeCloseTo(-LOGO_W / 2)
  expect(Math.max(...xs)).toBeCloseTo(LOGO_W / 2)
  expect(Math.min(...ys)).toBeCloseTo(-LOGO_H / 2)
  expect(Math.max(...ys)).toBeCloseTo(LOGO_H / 2)
  // The mint square is top-left: SVG y goes down, 3D y goes up.
  expect(boxes[0]).toMatchObject({ color: 'mint', position: [-16, 25] })
})
