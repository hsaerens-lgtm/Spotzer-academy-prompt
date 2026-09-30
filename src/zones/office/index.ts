import type { ZoneModule } from '../../app/zones'
import { OfficeOverlay } from './OfficeOverlay'
import { OfficeScene } from './OfficeScene'

export const officeZone: ZoneModule = { id: 'office', Scene: OfficeScene, Overlay: OfficeOverlay }
