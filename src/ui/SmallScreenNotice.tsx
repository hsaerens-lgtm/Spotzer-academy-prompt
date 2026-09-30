import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './overlay.css'

export const MIN_WIDTH = 1280
export const MIN_HEIGHT = 720

const isSmall = () => window.innerWidth < MIN_WIDTH || window.innerHeight < MIN_HEIGHT

export function SmallScreenNotice() {
  const { t } = useTranslation()
  const [small, setSmall] = useState(isSmall)
  useEffect(() => {
    const onResize = () => setSmall(isSmall())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  if (!small) return null
  return (
    <p className="small-screen panel" role="status">
      {t('app.smallScreen')}
    </p>
  )
}
