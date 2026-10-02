import { Suspense, use, useMemo } from 'react'
import { useApp } from '../core/store'
import { officeZone } from '../zones/office'
import { ErrorBoundary } from './ErrorBoundary'
import { LoadingScreen } from './LoadingScreen'
import { ReadingMode } from './ReadingMode'
import { loadZone, type ZoneModule } from './zones'

function LazyOverlay({ load }: { load: Promise<ZoneModule> }) {
  const zone = use(load)
  const Overlay = zone.Overlay
  return Overlay ? <Overlay /> : null
}

export function ZoneOverlayHost() {
  const zone = useApp((s) => s.zone)
  const threeD = useApp((s) => s.webgl === 'ok' && !s.readingMode)
  const OfficeOverlay = officeZone.Overlay!
  // One import per visit to a lazy zone, kept across Suspense retries: a failed import is dropped from the loader's
  // cache, so asking for it again on every retry would import again and again instead of reaching the error card.
  // The next visit (zone changes) asks again, and so retries.
  const lazyLoad = useMemo(() => (zone === 'office' ? null : loadZone(zone)), [zone])
  return (
    <ErrorBoundary key={zone} zone={zone}>
      {lazyLoad ? (
        <Suspense fallback={<LoadingScreen />}>
          <LazyOverlay load={lazyLoad} />
        </Suspense>
      ) : threeD ? (
        <OfficeOverlay />
      ) : (
        <ReadingMode />
      )}
    </ErrorBoundary>
  )
}
