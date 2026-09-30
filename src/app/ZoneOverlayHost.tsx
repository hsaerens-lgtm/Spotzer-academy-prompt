import { Suspense, use } from 'react'
import { useApp } from '../core/store'
import { officeZone } from '../zones/office'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingScreen } from './LoadingScreen'
import { ReadingMode } from './ReadingMode'
import { loadZone } from './zones'

function LazyOverlay({ id }: { id: 'workshop' | 'dungeon' }) {
  const zone = use(loadZone(id))
  const Overlay = zone.Overlay
  return Overlay ? <Overlay /> : null
}

export function ZoneOverlayHost() {
  const zone = useApp((s) => s.zone)
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const OfficeOverlay = officeZone.Overlay!
  return (
    <ErrorBoundary key={zone} zone={zone}>
      {zone === 'office' ? (
        threeD ? <OfficeOverlay /> : <ReadingMode />
      ) : (
        <Suspense fallback={<LoadingScreen />}>
          <LazyOverlay id={zone} />
        </Suspense>
      )}
    </ErrorBoundary>
  )
}
