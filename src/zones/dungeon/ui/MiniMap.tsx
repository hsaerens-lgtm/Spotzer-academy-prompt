import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { brand } from '../../../core/brand'
import { floorOf, useDungeon } from '../store'

const CELL = 6

/** Spec 3, §3.2: the cells seen so far, the walls around them, beaten guardians and the player's arrow. */
export function MiniMap() {
  const { t } = useTranslation()
  const floor = useDungeon(floorOf)
  const run = useDungeon((s) => s.run)!
  const seen = useDungeon((s) => s.seen)
  const canvas = useRef<HTMLCanvasElement>(null)
  const { map } = floor

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    context.clearRect(0, 0, map.width * CELL, map.height * CELL)
    for (const key of seen) {
      const x = key % map.width
      const y = Math.floor(key / map.width)
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue
      context.fillStyle = map.floor[key] ? brand.surface3 : brand.blueGrey
      context.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
    map.guardians.forEach((cell, i) => {
      if (!run.defeated[i] || !seen.has(cell.y * map.width + cell.x)) return
      context.fillStyle = brand.mint
      context.fillRect(cell.x * CELL + 1, cell.y * CELL + CELL / 2 - 0.5, CELL - 2, 1)
    })
    // The player: a lime arrow pointing the way they face.
    const cx = run.pose.x * CELL + CELL / 2
    const cy = run.pose.y * CELL + CELL / 2
    const angle = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI }[run.pose.dir]
    context.fillStyle = brand.lime
    context.beginPath()
    context.moveTo(cx + Math.cos(angle) * 3, cy + Math.sin(angle) * 3)
    context.lineTo(cx + Math.cos(angle + 2.4) * 3, cy + Math.sin(angle + 2.4) * 3)
    context.lineTo(cx + Math.cos(angle - 2.4) * 3, cy + Math.sin(angle - 2.4) * 3)
    context.closePath()
    context.fill()
  }, [seen, run.pose, run.defeated, map])

  return <canvas ref={canvas} className="dg-minimap" width={map.width * CELL} height={map.height * CELL} role="img" aria-label={t('dungeon.minimap')} />
}
