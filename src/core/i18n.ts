import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

export type Dict = { [key: string]: string | Dict }

const uiFiles = import.meta.glob<Dict>('/content/*/ui.json', { eager: true, import: 'default' })
const visualFiles = import.meta.glob<Dict>('/content/*/visuals.json', { eager: true, import: 'default' })

const langOf = (path: string) => path.split('/')[2]

export const resources: Record<string, { ui: Dict; visuals: Dict }> = {}
for (const [path, dict] of Object.entries(uiFiles)) resources[langOf(path)] = { ui: dict, visuals: {} }
for (const [path, dict] of Object.entries(visualFiles)) {
  const lang = langOf(path)
  if (resources[lang]) resources[lang].visuals = dict
}

export const DEFAULT_LANG = 'en'
export const languages = Object.keys(resources).sort()

export function resolveLang(lang: string): string {
  return languages.includes(lang) ? lang : DEFAULT_LANG
}

export function flattenKeys(dict: Dict, prefix = ''): string[] {
  return Object.entries(dict).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : flattenKeys(value, `${prefix}${key}.`),
  )
}

export function missingKeys(base: Dict, other: Dict): string[] {
  const present = new Set(flattenKeys(other))
  return flattenKeys(base).filter((key) => !present.has(key))
}

export function initI18n(lang: string = DEFAULT_LANG) {
  const lng = resolveLang(lang)
  if (i18n.isInitialized) {
    if (i18n.language !== lng) void i18n.changeLanguage(lng)
    return i18n
  }
  void i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: DEFAULT_LANG,
    ns: ['ui', 'visuals'],
    defaultNS: 'ui',
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return i18n
}

export { i18n }
