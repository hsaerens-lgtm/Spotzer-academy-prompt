import { appStore, useApp } from '../core/store'
import { ErrorBoundary } from './ErrorBoundary'
import { Fader } from './Fader'
import { LoadingScreen } from './LoadingScreen'
import { DialogueAnnouncer } from '../ui/DialogueAnnouncer'
import { Hud } from '../ui/Hud'
import { SmallScreenNotice } from '../ui/SmallScreenNotice'
import { Stage } from './Stage'
import { ZoneOverlayHost } from './ZoneOverlayHost'

export function App() {
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const showLoading = useApp((s) => s.zone === 'office' && !s.sceneReady)
  return (
    <div className="app">
      {threeD && (
        <ErrorBoundary zone="office" onError={() => appStore.getState().reportWebglLost()}>
          <Stage />
        </ErrorBoundary>
      )}
      <div className="overlay">
        <ZoneOverlayHost />
      </div>
      <Hud />
      <DialogueAnnouncer />
      <SmallScreenNotice />
      {threeD && showLoading && <LoadingScreen />}
      <Fader />
    </div>
  )
}
