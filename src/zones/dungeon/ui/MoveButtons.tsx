import { useTranslation } from 'react-i18next'
import type { Command } from '../../../dungeon/movement'

const BUTTONS: { command: Command; label: string; glyph: string }[] = [
  { command: 'turnLeft', label: 'dungeon.turnLeft', glyph: '↶' },
  { command: 'forward', label: 'dungeon.moveForward', glyph: '↑' },
  { command: 'turnRight', label: 'dungeon.turnRight', glyph: '↷' },
  { command: 'strafeLeft', label: 'dungeon.strafeLeft', glyph: '←' },
  { command: 'back', label: 'dungeon.moveBack', glyph: '↓' },
  { command: 'strafeRight', label: 'dungeon.strafeRight', glyph: '→' },
]

/** Spec 3, §3.2: the six moves as buttons, for the mouse (the keyboard has its own keys). */
export function MoveButtons({ onMove }: { onMove: (command: Command) => void }) {
  const { t } = useTranslation()
  return (
    <div className="dg-moves" role="group" aria-label={t('dungeon.moves')}>
      {BUTTONS.map(({ command, label, glyph }) => (
        <button key={command} type="button" className="dg-btn dg-move" aria-label={t(label)} onClick={() => onMove(command)}>
          <span aria-hidden="true">{glyph}</span>
        </button>
      ))}
    </div>
  )
}
