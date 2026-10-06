import type { Mood } from '../../../content/schema'

export interface Ada2DProps {
  mood?: Mood
  pointing?: boolean
  className?: string
}

function Eyes({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
    case 'encouraging':
      return (
        <>
          <path d="M24 25 q4 -5 8 0" />
          <path d="M38 25 q4 -5 8 0" />
        </>
      )
    case 'thinking':
      return (
        <>
          <path d="M24 24 h8" />
          <circle cx="42" cy="23.5" r="3" />
        </>
      )
    case 'surprised':
      return (
        <>
          <circle cx="28" cy="23.5" r="4.2" />
          <circle cx="42" cy="23.5" r="4.2" />
        </>
      )
    default:
      return (
        <>
          <circle cx="28" cy="23.5" r="3" />
          <circle cx="42" cy="23.5" r="3" />
        </>
      )
  }
}

/** Ada drawn flat: the same silhouette and LED visor as the 3D robot of the office. */
export function Ada2D({ mood = 'neutral', pointing = false, className }: Ada2DProps) {
  const classes = ['ws-ada', `ws-ada--${mood}`, pointing ? 'ws-ada--pointing' : '', className ?? ''].filter(Boolean).join(' ')
  return (
    <svg className={classes} viewBox="0 0 70 104" width="70" height="104" aria-hidden="true" data-mood={mood}>
      <ellipse className="ws-ada__shadow" cx="35" cy="100" rx="16" ry="3" />
      <ellipse className="ws-ada__arm" cx="9" cy="62" rx="6" ry="15" />
      <g className="ws-ada__arm ws-ada__arm--right">
        <ellipse cx="61" cy="62" rx="6" ry="15" />
      </g>
      <path className="ws-ada__body" d="M14 50 Q35 40 56 50 Q58 72 35 94 Q12 72 14 50 Z" />
      <path className="ws-ada__belt" d="M15 53 Q35 47 55 53" />
      <ellipse className="ws-ada__head" cx="35" cy="24" rx="20" ry="17" />
      <rect className="ws-ada__visor" x="19" y="16" width="32" height="15" rx="7.5" />
      <g className="ws-ada__eyes">
        <Eyes mood={mood} />
      </g>
    </svg>
  )
}
