import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './brand/oe-tokens.css'
import './brand/athena.css'
import './styles/app.css'
import { App } from './app/App'
import { initI18n } from './core/i18n'

initI18n('en')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
