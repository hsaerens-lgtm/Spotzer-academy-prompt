import { useTranslation } from 'react-i18next'
import type { ZoneModule } from '../../app/zones'
import { ComingSoon } from '../../ui/ComingSoon'

function DungeonSoon() {
  const { t } = useTranslation()
  return <ComingSoon title={t('zones.dungeon.title')} body={t('zones.dungeon.soon')} />
}

export const dungeonZone: ZoneModule = { id: 'dungeon', Overlay: DungeonSoon }
