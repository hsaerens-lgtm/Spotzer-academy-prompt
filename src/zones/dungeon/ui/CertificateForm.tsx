import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { certificateFileName, downloadPdf, isValidName, makeCertificate, UNSUPPORTED_NAME } from '../../../dungeon/certificate'
import type { Floor } from '../../../dungeon/model'
import { useDungeon } from '../store'

export interface CertificateFormProps {
  floor: Floor
  score: number
  /** YYYY-MM-DD: the date of the best pass. */
  date: string
}

/** Spec 3, §3.9: the name lives in this component only, for as long as the page is open. */
export function CertificateForm({ floor, score, date }: CertificateFormProps) {
  const { t } = useTranslation()
  const items = useDungeon((s) => s.content.floors[floor].itemTitles)
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'invalid' | 'making' | 'failed' | 'unsupported'>('idle')
  const fieldId = useId()
  const messageId = useId()

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!isValidName(name)) {
      setState('invalid')
      return
    }
    setState('making')
    try {
      downloadPdf(await makeCertificate({ floor, name, score, date, items }), certificateFileName(floor))
      setState('idle')
    } catch (error) {
      setState(error instanceof Error && error.message === UNSUPPORTED_NAME ? 'unsupported' : 'failed')
    }
  }

  const message =
    state === 'invalid'
      ? t('dungeon.nameInvalid')
      : state === 'unsupported'
        ? t('dungeon.nameUnsupported')
        : state === 'failed'
          ? t('dungeon.certificateFailed')
          : state === 'making'
            ? t('dungeon.making')
            : null
  return (
    <form className="dg-certificate" onSubmit={submit} noValidate>
      <h3 className="dg-certificate__title">{t('dungeon.certificate')}</h3>
      <div className="dg-certificate__row">
        <label htmlFor={fieldId} className="dg-certificate__label">
          {t('dungeon.yourName')}
        </label>
        <input
          id={fieldId}
          className="dg-certificate__field"
          type="text"
          autoComplete="name"
          maxLength={60}
          value={name}
          aria-invalid={state === 'invalid' || state === 'unsupported'}
          aria-describedby={message ? messageId : undefined}
          onChange={(event) => {
            setName(event.target.value)
            if (state !== 'making') setState('idle')
          }}
        />
        {state === 'failed' ? (
          <button type="button" className="dg-btn dg-btn--primary" onClick={() => void submit()}>
            {t('dungeon.tryAgain')}
          </button>
        ) : (
          <button type="submit" className="dg-btn dg-btn--primary" disabled={state === 'making'}>
            {t('dungeon.download')}
          </button>
        )}
      </div>
      {message && (
        <p id={messageId} className={state === 'making' ? 'dg-note' : 'dg-error'} role={state === 'making' ? 'status' : 'alert'}>
          {message}
        </p>
      )}
    </form>
  )
}
