import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BoxGeometry, InstancedMesh, MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry, type Texture } from 'three'
import { useApp } from '../../../core/store'
import type { ParsedMap } from '../../../dungeon/map'
import { DELTA, type Cell } from '../../../dungeon/movement'
import { PALETTES, TEXTURES, TORCH_FRAMES } from '../pixels/grids'
import { pixelTexture } from '../pixels/texture'
import { floorOf, useDungeon } from '../store'

const key = (map: ParsedMap, c: Cell) => c.y * map.width + c.x
const neighbours = (c: Cell) => Object.values(DELTA).map((d) => ({ x: c.x + d.x, y: c.y + d.y }))

/** One instanced mesh per surface kind: a draw call each, whatever the size of the floor. */
function Instances({ geometry, material, matrices }: { geometry: BoxGeometry | PlaneGeometry; material: MeshLambertMaterial; matrices: Object3D[] }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const target = mesh.current
    if (!target) return
    matrices.forEach((placed, i) => {
      placed.updateMatrix()
      target.setMatrixAt(i, placed.matrix)
    })
    target.instanceMatrix.needsUpdate = true
  }, [matrices])
  if (matrices.length === 0) return null
  return <instancedMesh ref={mesh} args={[geometry, material, matrices.length]} />
}

const placed = (x: number, y: number, z: number, rx = 0, ry = 0) => {
  const object = new Object3D()
  object.position.set(x, y, z)
  object.rotation.set(rx, ry, 0)
  return object
}

/** Spec 3, §4.4: walls that face a floor cell, floor and ceiling tiles, and wall torches. Cell (x, y) is centred on (x, 0, y). */
export function Maze() {
  const floor = useDungeon(floorOf)
  const reducedMotion = useApp((s) => s.reducedMotion)
  const { map } = floor

  const textures = useMemo(() => {
    const colours = PALETTES[floor.floor]
    return {
      wall: pixelTexture(TEXTURES.wall, colours),
      floor: pixelTexture(TEXTURES.floor, colours),
      ceiling: pixelTexture(TEXTURES.ceiling, colours),
      inscription: pixelTexture(TEXTURES.inscription, colours),
      torches: TORCH_FRAMES.map((frame) => pixelTexture(frame, colours)),
    }
  }, [floor.floor])
  useEffect(() => () => [textures.wall, textures.floor, textures.ceiling, textures.inscription, ...textures.torches].forEach((t: Texture) => t.dispose()), [textures])

  const geometry = useMemo(() => ({ box: new BoxGeometry(1, 1, 1), plane: new PlaneGeometry(1, 1), torch: new PlaneGeometry(0.34, 0.34) }), [])
  const materials = useMemo(
    () => ({
      wall: new MeshLambertMaterial({ map: textures.wall }),
      inscription: new MeshLambertMaterial({ map: textures.inscription }),
      floor: new MeshLambertMaterial({ map: textures.floor }),
      ceiling: new MeshLambertMaterial({ map: textures.ceiling }),
      torch: new MeshBasicMaterial({ map: textures.torches[0], transparent: true, alphaTest: 0.5, toneMapped: false }),
    }),
    [textures],
  )

  const layout = useMemo(() => {
    const isFloor = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < map.width && c.y < map.height && map.floor[key(map, c)]
    const special = new Set([...map.inscriptions].map((c) => key(map, c)))
    const walls: Object3D[] = []
    const inscriptions: Object3D[] = []
    const floors: Object3D[] = []
    const ceilings: Object3D[] = []
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const cell = { x, y }
        if (isFloor(cell)) {
          floors.push(placed(x, 0, y, -Math.PI / 2))
          ceilings.push(placed(x, 1, y, Math.PI / 2))
        } else if (neighbours(cell).some(isFloor)) {
          ;(special.has(key(map, cell)) ? inscriptions : walls).push(placed(x, 0.5, y))
        }
      }
    }
    // A torch on each face of a torch wall that looks onto a floor cell, facing it.
    const torches: Object3D[] = []
    for (const wall of map.torches) {
      for (const [dx, dy] of [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ]) {
        if (!isFloor({ x: wall.x + dx, y: wall.y + dy })) continue
        torches.push(placed(wall.x + dx * 0.51, 0.62, wall.y + dy * 0.51, 0, Math.atan2(dx, dy)))
      }
    }
    return { walls, inscriptions, floors, ceilings, torches }
  }, [map])

  // The torches flicker through their three frames (still with reduced motion).
  const frame = useRef(0)
  useFrame((state) => {
    if (reducedMotion) return
    const next = Math.floor(state.clock.elapsedTime / 0.15) % textures.torches.length
    if (next === frame.current) return
    frame.current = next
    materials.torch.map = textures.torches[next]
  })

  return (
    <group name="maze">
      <Instances geometry={geometry.box} material={materials.wall} matrices={layout.walls} />
      <Instances geometry={geometry.box} material={materials.inscription} matrices={layout.inscriptions} />
      <Instances geometry={geometry.plane} material={materials.floor} matrices={layout.floors} />
      <Instances geometry={geometry.plane} material={materials.ceiling} matrices={layout.ceilings} />
      {layout.torches.map((torch, i) => (
        <mesh key={i} geometry={geometry.torch} material={materials.torch} position={torch.position} rotation={torch.rotation} />
      ))}
    </group>
  )
}

