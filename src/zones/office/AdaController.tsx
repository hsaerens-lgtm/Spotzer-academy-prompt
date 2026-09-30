import { useEffect, useState } from 'react'
import type { Gesture, Mood } from '../../content/schema'
import { useCurrentBeat } from '../../core/selectors'
import { useApp } from '../../core/store'
import { Interactive } from '../../three/interactive'
import { Ada } from '../../three/robot/Ada'
import { objectActions } from './interactions'
import { layout } from './layout'

/** Drives Ada from the dialogue: mood and gesture of the current beat, a wave on arrival and when clicked. */
export function AdaController() {
  const beat = useCurrentBeat()
  const dialogue = useApp((s) => s.dialogue)
  const pokes = useApp((s) => s.adaPokes)
  const reducedMotion = useApp((s) => s.reducedMotion)
  const [gesture, setGesture] = useState<{ name: Gesture; key: number }>({ name: 'wave', key: 1 })
  const beatKey = dialogue ? `${dialogue.topicId}:${dialogue.section}:${dialogue.beatIndex}` : null
  const beatGesture = beat?.gesture

  useEffect(() => {
    if (beatKey && beatGesture && beatGesture !== 'none') {
      setGesture((current) => ({ name: beatGesture, key: current.key + 1 }))
    }
  }, [beatKey, beatGesture])

  useEffect(() => {
    if (pokes > 0) setGesture((current) => ({ name: 'wave', key: current.key + 1 }))
  }, [pokes])

  const mood: Mood = beat?.mood ?? (dialogue ? 'neutral' : 'happy')
  const { position, rotationY } = layout.ada
  return (
    <Interactive id="ada" onActivate={objectActions.ada}>
      <Ada
        name="ada"
        position={position}
        rotation-y={rotationY}
        mood={mood}
        gesture={gesture.name}
        gestureKey={gesture.key}
        speaking={dialogue?.phase === 'typing'}
        reducedMotion={reducedMotion}
      />
    </Interactive>
  )
}
