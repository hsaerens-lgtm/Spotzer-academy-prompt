import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SAMPLE_TEXT } from './topics/Tokens'
import './visuals.css'

export interface Tokenizer {
  encode: (text: string) => number[]
  decode: (tokens: number[]) => string
}

export const MAX_DEMO_CHARS = 2000

export const loadTokenizer = (): Promise<Tokenizer> =>
  import('gpt-tokenizer/encoding/o200k_base').then((module) => ({ encode: module.encode, decode: module.decode }))

export function splitTokens(tokenizer: Tokenizer, text: string): string[] {
  return tokenizer.encode(text).map((token) => tokenizer.decode([token]))
}

export function TokensDemo({ loader = loadTokenizer }: { loader?: () => Promise<Tokenizer> }) {
  const { t } = useTranslation()
  const [text, setText] = useState(SAMPLE_TEXT)
  const [tokenizer, setTokenizer] = useState<Tokenizer | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loader().then(
      (loaded) => {
        if (alive) setTokenizer(loaded)
      },
      () => {
        if (alive) setFailed(true)
      },
    )
    return () => {
      alive = false
    }
  }, [loader])

  const tokens = useMemo(() => (tokenizer ? splitTokens(tokenizer, text) : []), [tokenizer, text])

  return (
    <section className="tokens-demo at-card" aria-labelledby="tokens-demo-title">
      <h3 id="tokens-demo-title" className="at-h2">
        {t('dialogue.tryIt')}
      </h3>
      {failed ? (
        <p role="alert">{t('tokensDemo.loadError')}</p>
      ) : (
        <>
          <label className="tokens-demo__label">
            {t('tokensDemo.label')}
            <textarea
              value={text}
              rows={2}
              maxLength={MAX_DEMO_CHARS}
              onChange={(event) => setText(event.target.value.slice(0, MAX_DEMO_CHARS))}
            />
          </label>
          {text.length >= MAX_DEMO_CHARS && (
            <p className="tokens-demo__limit">{t('tokensDemo.limit', { max: MAX_DEMO_CHARS })}</p>
          )}
          {tokenizer ? (
            <>
              <p className="tokens-demo__count" aria-live="polite">
                {t('tokensDemo.count', { count: tokens.length, chars: t('tokensDemo.chars', { count: text.length }) })}
              </p>
              <div className="tokens-demo__chips">
                {tokens.map((token, index) => (
                  <span key={index} className={`tokens-demo__chip tokens-demo__chip--${index % 2}`}>
                    {token}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="tokens-demo__count">{t('tokensDemo.loading')}</p>
          )}
          <p className="tokens-demo__note">{t('tokensDemo.note')}</p>
        </>
      )}
    </section>
  )
}
