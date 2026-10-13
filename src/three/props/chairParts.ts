import { CylinderGeometry, ExtrudeGeometry, Matrix4, Shape, Vector3, type BufferGeometry } from 'three'
import { at, mergeParts, type Part } from '../merge'
import { between, roundedBox } from '../shapes'
import { metreUVs } from '../uv'

/**
 * Office meeting chair, in metres: origin on the floor at its centre, front +z. Five-spoke base on casters, gas lift,
 * upholstered seat, curved upholstered back in a black shell, two armrests. The layout footprint is 2 x half wide and
 * deep, backTop high (footprints.ts).
 */
export const CHAIR = {
  seatTop: 0.47,
  seatHalfWidth: 0.25,
  armTop: 0.66,
  backTop: 0.95,
  half: 0.33,
  spokes: 5,
  spokeReach: 0.3,
  casterRadius: 0.025,
} as const

export interface ChairParts {
  /** Seat cushion and back pad (chairFabric). */
  fabric: BufferGeometry
  /** Base, casters, column sleeve, seat pan, mechanism, back shell and spine, armrests (blackMetal). */
  frame: BufferGeometry
  /** The gas lift's bare column (brushedMetal). */
  chrome: BufferGeometry
}

/** Back of the chair: centre height, distance behind the seat's middle, and recline (radians, top towards -z). */
const BACK = { y: 0.735, z: -0.24, recline: 0.17, radius: 0.7 } as const

/** Where the casters touch: their centres, one per spoke, evenly spread on a circle around the column. */
export function casterPositions(): Vector3[] {
  return Array.from({ length: CHAIR.spokes }, (_, k) => {
    const angle = -Math.PI / 2 + (k * 2 * Math.PI) / CHAIR.spokes
    return new Vector3(Math.cos(angle) * CHAIR.spokeReach, CHAIR.casterRadius, Math.sin(angle) * CHAIR.spokeReach)
  })
}

/**
 * A panel bent around a vertical axis in front of it (concave towards +z, the sitter): `width` along its arc,
 * `height` and `thickness`, edges softened by `bevel`. Centred on the origin at the middle of its arc.
 */
function arcPanel(width: number, height: number, thickness: number, radius: number, bevel: number): BufferGeometry {
  const span = width / radius
  const steps = 8
  const shape = new Shape()
  // The shape's plane is (x, -z): after the quarter turn below, its y axis becomes -z and the extrusion becomes +y.
  const point = (r: number, a: number): [number, number] => [r * Math.sin(a), -(radius - r * Math.cos(a))]
  const front = radius - thickness / 2 + bevel
  const back = radius + thickness / 2 - bevel
  for (let i = 0; i <= steps; i++) {
    const [x, y] = point(front, -span / 2 + (i * span) / steps)
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  for (let i = steps; i >= 0; i--) shape.lineTo(...point(back, -span / 2 + (i * span) / steps))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, {
    depth: height - 2 * bevel,
    bevelEnabled: true,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 1,
    curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.computeBoundingBox()
  const { min, max } = geometry.boundingBox!
  geometry.translate(0, -(min.y + max.y) / 2, 0)
  return geometry
}

/** The back's placement, with an extra offset `dz` along its own normal (negative: further behind). */
function backMatrix(dz: number): Matrix4 {
  return at(0, BACK.y, BACK.z, [-BACK.recline, 0, 0]).multiply(new Matrix4().makeTranslation(0, 0, dz))
}

function fabricGeometry(): BufferGeometry {
  return metreUVs(
    mergeParts([
      // Seat cushion, 7 cm thick, its top at seatTop.
      { geometry: roundedBox(2 * CHAIR.seatHalfWidth, 0.07, 0.47, 0.03), matrix: at(0, CHAIR.seatTop - 0.035, 0.03) },
      // Back pad, curved around the sitter, in front of the shell.
      { geometry: arcPanel(0.44, 0.38, 0.04, BACK.radius, 0.012), matrix: backMatrix(0) },
    ]),
  )
}

function frameGeometry(): BufferGeometry {
  const hub = new Vector3(0, 0.105, 0)
  const parts: Part[] = [
    // Hub, the column's sleeve, the mechanism under the seat and the seat pan.
    between(new Vector3(0, 0.085, 0), new Vector3(0, 0.125, 0), 0.055, 0.05, 12),
    between(new Vector3(0, 0.09, 0), new Vector3(0, 0.22, 0), 0.03, 0.03, 10),
    { geometry: roundedBox(0.18, 0.05, 0.22, 0.01, 1), matrix: at(0, 0.355, 0) },
    { geometry: roundedBox(0.44, 0.02, 0.42, 0.006, 1), matrix: at(0, 0.39, 0.02) },
    // The back's shell, just behind the pad, and the spine that carries it from the seat.
    { geometry: arcPanel(0.48, 0.42, 0.014, BACK.radius, 0.005), matrix: backMatrix(-0.027) },
    between(new Vector3(0, 0.38, -0.16), new Vector3(0, 0.56, -0.29), 0.018, 0.016, 8),
  ]
  // Five spokes, each with a caster fork and a wheel turned across the spoke.
  for (const caster of casterPositions()) {
    const angle = Math.atan2(caster.z, caster.x)
    const tip = new Vector3(caster.x, 0.07, caster.z)
    parts.push(between(hub, tip, 0.02, 0.012, 8))
    parts.push(between(tip, new Vector3(caster.x, 0.04, caster.z), 0.012, 0.01, 6))
    parts.push({
      // 8 sides: once turned, one edge of the wheel lies exactly on the floor.
      geometry: new CylinderGeometry(CHAIR.casterRadius, CHAIR.casterRadius, 0.022, 8),
      matrix: at(caster.x, CHAIR.casterRadius, caster.z, [0, Math.PI / 2 - angle, Math.PI / 2]),
    })
  }
  // Two armrests: a bracket out from under the seat, a post up, a pad on top at armTop.
  for (const side of [-1, 1]) {
    const x = side * 0.29
    parts.push(between(new Vector3(side * 0.08, 0.37, -0.03), new Vector3(side * 0.285, 0.37, -0.03), 0.014, 0.014, 8))
    parts.push(between(new Vector3(side * 0.285, 0.37, -0.03), new Vector3(x, CHAIR.armTop - 0.02, -0.03), 0.014, 0.014, 8))
    parts.push({ geometry: roundedBox(0.05, 0.025, 0.25, 0.01, 2), matrix: at(x, CHAIR.armTop - 0.0125, 0) })
  }
  // Cylinders and the extruded shell come with their own UVs: re-project the whole frame in metres.
  return metreUVs(mergeParts(parts))
}

function chromeGeometry(): BufferGeometry {
  return metreUVs(mergeParts([between(new Vector3(0, 0.22, 0), new Vector3(0, 0.335, 0), 0.022, 0.022, 10)]))
}

let parts: ChairParts | null = null

/** The three geometries shared by every chair, built once and never disposed (the office keeps them for the page). */
export function chairParts(): ChairParts {
  parts ??= { fabric: fabricGeometry(), frame: frameGeometry(), chrome: chromeGeometry() }
  return parts
}
