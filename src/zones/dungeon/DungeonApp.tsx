import '@fontsource/vt323/400.css'
import './dungeon.css'
import { useEffect, useMemo } from 'react'
import { sound } from '../../core/sound'
import { appStore, useApp } from '../../core/store'
import { getDungeonContent } from '../../dungeon/content'
import { DungeonTestBridge } from './DungeonTestBridge'
import { JINGLES } from './sounds'
import { createDungeonStore, DungeonStoreProvider, useDungeon, useDungeonStore } from './store'
import { TextDungeon } from './text/TextDungeon'
import { ThreeDView } from './ThreeDView'
import { Announcer } from './ui/Announcer'
import { BossPanel } from './ui/BossPanel'
import { DialogBox } from './ui/DialogBox'
import { GameOver } from './ui/GameOver'
import { Hud } from './ui/Hud'
import { PauseMenu } from './ui/PauseMenu'
import { ScoreScreen } from './ui/ScoreScreen'
import { TitleScreen } from './ui/TitleScreen'

function Game() {
  const store = useDungeonStore()
  const floor = useApp((s) => s.dungeonRoute.floor)
  const floor1Passed = useApp((s) => s.progress.dungeon?.passed === true)
  const run = useDungeon((s) => s.run)
  const effect = useDungeon((s) => s.effect)
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const view = useDungeon((s) => s.view)

  // Spec 3, §4.6: floor 2 needs floor 1; a run starts for the floor in the route, and stops without one.
  useEffect(() => {
    if (floor === 2 && !floor1Passed) appStore.getState().setDungeonRoute({ floor: null })
    else if (floor && store.getState().run?.floor !== floor) store.getState().start(floor)
    else if (!floor && store.getState().run) store.getState().quit()
  }, [floor, floor1Passed, store])

  useEffect(() => {
    if (effect) sound.jingle(JINGLES[effect.kind])
  }, [effect])

  if (!floor || !run || run.floor !== floor) return <TitleScreen />
  return (
    <div className={`dg-game dg-game--floor${run.floor}`} data-testid="dungeon">
      {threeD && view === '3d' ? <ThreeDView /> : <TextDungeon />}
      <Hud />
      {(run.phase === 'encounter' || run.phase === 'answered') && <DialogBox key={run.current} />}
      {(run.phase === 'boss' || run.phase === 'bossFeedback') && <BossPanel />}
      {run.phase === 'victory' && <ScoreScreen />}
      {run.phase === 'ejected' && <GameOver />}
      <PauseMenu />
    </div>
  )
}

export function DungeonApp() {
  const lang = useApp((s) => s.settings.lang)
  const store = useMemo(
    () =>
      createDungeonStore({
        content: getDungeonContent(lang),
        onVictory: (floor, score, date) => appStore.getState().passDungeonFloor(floor, score, date),
        // Spec 3, §3.5: Ada debriefs a floor-1 ejection in the office; the expert floor has its corrections screen.
        onEjected: (floor, missed) => {
          if (floor === 1) appStore.getState().setDungeonDebrief({ topics: [...new Set(missed)] })
        },
      }),
    [lang],
  )
  return (
    <DungeonStoreProvider value={store}>
      <div className="dg-root">
        <Game />
        <Announcer />
      </div>
      {import.meta.env.DEV && <DungeonTestBridge store={store} />}
    </DungeonStoreProvider>
  )
}
