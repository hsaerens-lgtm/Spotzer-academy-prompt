import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../../core/store'
import { isFloor, sameCell, type ParsedMap } from '../../dungeon/map'
import { ahead, turned, type Pose } from '../../dungeon/movement'
import { STEP_MS } from './scene/CameraRig'
import { SceneBoundary } from './scene/SceneBoundary'
import { useDungeonKeys, useMoveQueue } from './scene/useDungeonKeys'
import { floorOf, useDungeon, useDungeonStore } from './store'
import { MiniMap } from './ui/MiniMap'
import { MoveButtons } from './ui/MoveButtons'

const DungeonCanvas = lazy(() => import('./scene/DungeonCanvas'))

/** A wall ahead, on the left and on the right. */
function deadEnd(map: ParsedMap, pose: Pose): boolean {
  const wall = (dir: Pose['dir']) => {
    const cell = ahead({ ...pose, dir })
    return !isFloor(map, cell.x, cell.y)
  }
  return wall(pose.dir) && wall(turned(pose.dir, -1)) && wall(turned(pose.dir, 1))
}

/** Spec 3, §3.2 and §4.4: the 3D dungeon, its moves (keys and buttons), the minimap and the inscriptions. */
export function ThreeDView() {
  const { t } = useTranslation()
  const store = useDungeonStore()
  const reducedMotion = useApp((s) => s.reducedMotion)
  const run = useDungeon((s) => s.run)!
  const paused = useDungeon((s) => s.paused)
  const floor = useDungeon(floorOf)
  const exploring = run.phase === 'exploring' && !paused
  const send = useMoveQueue((command) => store.getState().dispatch({ type: 'move', command }), reducedMotion ? 0 : STEP_MS)
  useDungeonKeys(send, exploring)

  const facing = ahead(run.pose)
  const inscription = floor.map.inscriptions.findIndex((cell) => sameCell(cell, facing))

  // A few words for screen readers when the view changes in a way that matters; nothing on every step.
  useEffect(() => {
    if (run.phase !== 'exploring') return
    if (inscription >= 0) store.getState().announce(floor.inscriptions[inscription])
    else if (deadEnd(floor.map, run.pose)) store.getState().announce(t('dungeon.deadEnd'))
  }, [run.pose])

  const fail = () => {
    store.getState().fallbackToText()
    store.getState().announce(t('dungeon.textFallback'))
  }

  return (
    <>
      <SceneBoundary onError={fail}>
        <Suspense fallback={null}>
          <DungeonCanvas store={store} onContextLost={fail} />
        </Suspense>
      </SceneBoundary>
      {inscription >= 0 && exploring && <p className="dg-inscription">{floor.inscriptions[inscription]}</p>}
      <MiniMap />
      {exploring && <MoveButtons onMove={send} />}
    </>
  )
}
