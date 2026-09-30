import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Scales fixed-size content (the 1280 × 720 screen) to fit its container. */
export function FitScreen({ width = 1280, height = 720, children }: { width?: number; height?: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => {
      const { clientWidth, clientHeight } = element
      if (clientWidth > 0 && clientHeight > 0) setScale(Math.min(clientWidth / width, clientHeight / height))
    }
    update()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [width, height])

  return (
    <div className="fit-screen" ref={ref}>
      <div className="fit-screen__inner" style={{ width, height, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
