import { render, screen } from '@testing-library/react'
import { flattenKeys, resources } from '../core/i18n'
import { visualManifest, type VisualId } from './manifest'
import { visualComponents } from './registry'
import { ScreenContent } from './ScreenContent'
import { SAMPLE_TEXT, SAMPLE_TOKENS } from './topics/Tokens'

const registered = Object.keys(visualComponents) as VisualId[]
const visualKeys = new Set(flattenKeys(resources.en.visuals))

describe.each(registered)('visual %s', (id) => {
  it('has a kicker, a title and a description', () => {
    for (const key of ['kicker', 'title', 'description']) expect(visualKeys.has(`${id}.${key}`)).toBe(true)
  })

  it.each(Array.from({ length: visualManifest[id].steps }, (_, i) => i + 1))(
    'renders step %i without missing text',
    (step) => {
      const { container } = render(<ScreenContent screen={{ visualId: id, step }} />)
      expect(container.querySelector(`.vz--${id}`)).not.toBeNull()
      // i18next returns the key itself when a translation is missing.
      expect(container.textContent).not.toMatch(new RegExp(`${id}\\.[a-zA-Z]`))
    },
  )
})

test('the idle screen shows when there is no visual', () => {
  render(<ScreenContent screen={null} />)
  expect(screen.getByText('Learn to talk to AI')).toHaveClass('at-script')
})

test('an unknown visual falls back to the idle screen', () => {
  render(<ScreenContent screen={{ visualId: 'nope', step: 1 }} />)
  expect(screen.getByText('Learn to talk to AI')).toBeInTheDocument()
})

test('the screen exposes a text description of the visual', () => {
  render(<ScreenContent screen={{ visualId: 'what-is-ai', step: 1 }} />)
  expect(screen.getByText(/Four nested circles/)).toHaveClass('sr-only')
})

test('the tokens sample matches the real o200k tokenizer', async () => {
  const { encode, decode } = await import('gpt-tokenizer/encoding/o200k_base')
  expect(encode(SAMPLE_TEXT).map((id) => decode([id]))).toEqual([...SAMPLE_TOKENS])
  expect(SAMPLE_TOKENS.join('')).toBe(SAMPLE_TEXT)
})

test('every visual of the manifest has a component', () => {
  expect(Object.keys(visualComponents).sort()).toEqual(Object.keys(visualManifest).sort())
})
