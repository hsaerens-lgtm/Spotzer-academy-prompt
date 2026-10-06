import { useId, type ReactNode } from 'react'

export interface WindowProps {
  title: string
  variant?: 'primary' | 'secondary'
  className?: string
  tools?: ReactNode
  children: ReactNode
}

/** A fixed retro window: lime title bar for the active program, blue-grey for the others. */
export function Window({ title, variant = 'secondary', className, tools, children }: WindowProps) {
  const titleId = useId()
  const classes = ['ws-window', `ws-window--${variant}`, className ?? ''].filter(Boolean).join(' ')
  return (
    <section className={classes} aria-labelledby={titleId}>
      <header className="ws-window__bar">
        <h2 id={titleId} className="ws-window__title">
          {title}
        </h2>
        {tools && <div className="ws-window__tools">{tools}</div>}
      </header>
      <div className="ws-window__body">{children}</div>
    </section>
  )
}
