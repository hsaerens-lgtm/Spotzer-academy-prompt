import { Component, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { appStore, type ZoneId } from '../core/store'
import { Button } from '../ui/Button'

interface Props {
  zone: ZoneId
  onError?: (error: unknown) => void
  children: ReactNode
}

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
    this.props.onError?.(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <ErrorCard zone={this.props.zone} onRecover={() => this.setState({ failed: false })} />
  }
}

function ErrorCard({ zone, onRecover }: { zone: ZoneId; onRecover: () => void }) {
  const { t } = useTranslation()
  const recover = () => {
    const state = appStore.getState()
    if (zone === 'office') state.setReadingMode(true)
    else state.requestZone('office')
    onRecover()
  }
  return (
    <div className="error-card panel at-card at-card--raised" role="alert">
      <h2 className="at-h2">{t('errors.generic')}</h2>
      <p className="at-lede">{t('errors.genericBody')}</p>
      <Button variant="primary" onClick={recover}>
        {t('zones.back')}
      </Button>
    </div>
  )
}
