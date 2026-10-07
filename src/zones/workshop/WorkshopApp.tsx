import '@fontsource/vt323/400.css'
import './workshop.css'
import { useEffect, useMemo, useState } from 'react'
import { appStore, useApp } from '../../core/store'
import { suggestedMission } from '../../workshop/content'
import { BuilderWindow, type BuilderWindowProps } from './builder/BuilderWindow'
import { CorrectorView } from './corrector/CorrectorView'
import { getWorkshopStore } from './instance'
import { MissionList } from './missions/MissionList'
import { MissionsView } from './missions/MissionsView'
import { MyPromptsWindow } from './myPrompts/MyPromptsWindow'
import { WorkshopStoreProvider, useWorkshop, type WorkshopView } from './store'
import { DesktopIcons } from './ui/DesktopIcons'
import { Taskbar } from './ui/Taskbar'
import { WorkshopAnnouncer } from './WorkshopAnnouncer'
import { WorkshopTestBridge } from './WorkshopTestBridge'

const NO_PASSES: readonly string[] = []

function Desktop() {
  const content = useWorkshop((s) => s.content)
  const route = useApp((s) => s.workshopRoute)
  const passed = useApp((s) => s.progress.workshop?.passed) ?? NO_PASSES
  const view: WorkshopView = route.app ?? 'missions'
  const suggestedId = suggestedMission(content, passed).id
  // Never an unknown mission on screen (the missions view needs a real one): the suggested one stands in at once.
  const missionId = route.mission && content.missionById.has(route.mission) ? route.mission : suggestedId

  // State wins: an unknown or missing mission in the URL becomes the suggested one (the router replaces the entry).
  useEffect(() => {
    if (route.mission !== missionId) appStore.getState().setWorkshopRoute({ mission: missionId, app: route.app })
  }, [route.mission, route.app, missionId])

  // The mission opened by Ada's "Next mission": that button goes away with the old mission, so the new one's first
  // editor takes the focus. Anything else that opens a mission or a program keeps the focus where it is.
  const [focusOnOpen, setFocusOnOpen] = useState<string | null>(null)
  const openMission = (id: string, takeFocus: boolean) => {
    setFocusOnOpen(takeFocus ? id : null)
    appStore.getState().setWorkshopRoute({ mission: id, app: null })
  }
  const setView = (next: WorkshopView) => {
    setFocusOnOpen(null)
    appStore.getState().setWorkshopRoute({ mission: missionId, app: next === 'missions' ? null : next })
  }
  const selectMission = (id: string) => openMission(id, false)
  const nextMission = (id: string) => openMission(id, true)
  const passedCount = passed.filter((id) => content.missionById.has(id)).length
  const renderBuilder = (props: Omit<BuilderWindowProps, 'className' | 'labels'>) => (
    <BuilderWindow className="ws-area-builder" labels={content.labels} {...props} />
  )

  return (
    <div className={`ws-desktop ws-desktop--${view}`} data-testid="workshop">
      <DesktopIcons onOpen={setView} />
      {/* On the left in every program, and outside the views: picking a mission keeps the focus on it. */}
      <MissionList
        className="ws-area-missions"
        missions={content.missions}
        passed={passed}
        currentId={missionId}
        suggestedId={suggestedId}
        onSelect={selectMission}
      />
      {/* Keyed: a mission's tip, closed bubble, comparison and revealed result never carry over to another mission. */}
      {view === 'missions' && (
        <MissionsView
          key={missionId}
          missionId={missionId}
          onSelectMission={nextMission}
          renderBuilder={renderBuilder}
          focusOnOpen={focusOnOpen === missionId}
        />
      )}
      {view === 'prompts' && <MyPromptsWindow className="ws-area-main" />}
      {view === 'corrector' && <CorrectorView renderBuilder={renderBuilder} />}
      <Taskbar
        view={view}
        passed={passedCount}
        total={content.missions.length}
        onView={setView}
        onBack={() => appStore.getState().requestZone('office')}
      />
      <WorkshopAnnouncer />
    </div>
  )
}

export function WorkshopApp() {
  const store = useMemo(() => getWorkshopStore(), [])
  return (
    <WorkshopStoreProvider value={store}>
      <Desktop />
      {import.meta.env.DEV && <WorkshopTestBridge store={store} />}
    </WorkshopStoreProvider>
  )
}
