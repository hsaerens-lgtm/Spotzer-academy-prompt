import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './fonts'
import './brand/oe-tokens.css'
import './brand/athena.css'
import './styles/app.css'
import { App } from './app/App'
import { detectWebGL2 } from './app/webgl'
import { i18n, initI18n, resolveLang } from './core/i18n'
import { startRouter } from './core/router'
import { appStore } from './core/store'

initI18n(appStore.getState().settings.lang)
appStore.getState().setWebgl(detectWebGL2() ? 'ok' : 'unavailable')
startRouter(appStore)
appStore.subscribe((state, previous) => {
  if (state.settings.lang !== previous.settings.lang) void i18n.changeLanguage(resolveLang(state.settings.lang))
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
