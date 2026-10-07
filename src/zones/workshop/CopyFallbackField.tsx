import { useTranslation } from 'react-i18next'
import type { CopyWithFallback } from './copy'

export interface CopyFallbackFieldProps {
  /** The text the clipboard refused (`fallback` of useCopyWithFallback). */
  text: string
  /** `selectFallback` of useCopyWithFallback: selects the text when the field appears and after each refused copy. */
  selectRef: CopyWithFallback['selectFallback']
  rows: number
}

/** The refused copy's fallback: the text shown selected, with the hint to copy it by hand. */
export function CopyFallbackField({ text, selectRef, rows }: CopyFallbackFieldProps) {
  const { t } = useTranslation()
  return (
    <label className="ws-copy-fallback">
      {t('workshop.studio.copyFallback')}
      <textarea ref={selectRef} className="ws-field" readOnly rows={rows} value={text} />
    </label>
  )
}
