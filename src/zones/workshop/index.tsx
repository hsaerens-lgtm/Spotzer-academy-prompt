import { useTranslation } from 'react-i18next'
import type { ZoneModule } from '../../app/zones'
import { ComingSoon } from '../../ui/ComingSoon'

function WorkshopSoon() {
  const { t } = useTranslation()
  return <ComingSoon title={t('zones.workshop.title')} body={t('zones.workshop.soon')} />
}

export const workshopZone: ZoneModule = { id: 'workshop', Overlay: WorkshopSoon }
