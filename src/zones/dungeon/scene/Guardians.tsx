import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MeshBasicMaterial, PlaneGeometry, type Group } from 'three'
import { useApp } from '../../../core/store'
import type { DungeonGuardian } from '../../../dungeon/content'
import type { Cell } from '../../../dungeon/movement'
import { BOSS_GRIDS, GUARDIAN_SPRITES, PALETTES, TINT_COLOURS } from '../pixels/grids'
import { pixelTexture } from '../pixels/texture'
import { floorOf, useDungeon } from '../store'

const FADE_MS = 400

/** A sprite that always faces the camera, bobbing on two frames; it shrinks and fades away once beaten. */
function Sprite({ grid, tint, cell, size, defeated, floor }: { grid: string[]; tint?: string; cell: Cell; size: number; defeated: boolean; floor: 1 | 2 }) {
  const reducedMotion = useApp((s) => s.reducedMotion)
  const material = useMemo(
    () => new MeshBasicMaterial({ map: pixelTexture(grid, PALETTES[floor], tint), transparent: true, alphaTest: 0.5, toneMapped: false }),
    [grid, tint, floor],
  )
  const geometry = useMemo(() => new PlaneGeometry(size, size), [size])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
      geometry.dispose()
    },
    [material, geometry],
  )
  const group = useRef<Group>(null)
  const [gone, setGone] = useState(defeated && reducedMotion)
  const fadingSince = useRef<number | null>(null)

  useFrame((state) => {
    const target = group.current
    if (!target) return
    // Two frames of bobbing, half a second each.
    target.position.y = size / 2 + (reducedMotion ? 0 : Math.floor(state.clock.elapsedTime * 2) % 2 === 0 ? 0.03 : 0)
    if (!defeated) return
    if (reducedMotion) {
      setGone(true)
      return
    }
    fadingSince.current ??= state.clock.elapsedTime
    const t = Math.min(1, ((state.clock.elapsedTime - fadingSince.current) * 1000) / FADE_MS)
    target.scale.setScalar(1 + t * 0.6)
    material.opacity = 1 - t
    material.alphaTest = 0
    if (t >= 1) setGone(true)
  })

  if (gone) return null
  return (
    <group ref={group} position={[cell.x, size / 2, cell.y]}>
      <Billboard lockX lockZ>
        <mesh geometry={geometry} material={material} />
      </Billboard>
    </group>
  )
}

/** Spec 3, §3.3 and §3.4: the guardians on their cells, and the boss in its hall. */
export function Guardians() {
  const floor = useDungeon(floorOf)
  const defeated = useDungeon((s) => s.run?.defeated ?? [])
  const victory = useDungeon((s) => s.run?.phase === 'victory')
  return (
    <group name="guardians">
      {floor.guardians.map((guardian: DungeonGuardian, i) => (
        <Sprite
          key={`${floor.floor}-${i}`}
          grid={GUARDIAN_SPRITES[guardian.sprite]}
          tint={TINT_COLOURS[guardian.tint]}
          cell={floor.map.guardians[i]}
          size={0.9}
          defeated={defeated[i] ?? false}
          floor={floor.floor}
        />
      ))}
      <Sprite key={`boss-${floor.floor}`} grid={BOSS_GRIDS[floor.boss.sprite]} cell={floor.map.boss} size={1} defeated={victory} floor={floor.floor} />
    </group>
  )
}
