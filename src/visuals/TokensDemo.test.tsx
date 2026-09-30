import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from '../ui/DialogueBox'
import { MAX_DEMO_CHARS, TokensDemo, loadTokenizer, splitTokens, type Tokenizer } from './TokensDemo'
import { SAMPLE_TEXT, SAMPLE_TOKENS } from './topics/Tokens'

/** One token per character: predictable counts for UI tests. */
const charTokenizer: Tokenizer = {
  encode: (text) => Array.from(text, (char) => char.codePointAt(0)!),
  decode: (tokens) => String.fromCodePoint(...tokens),
}
const fakeLoader = () => Promise.resolve(charTokenizer)

async function renderDemo(loader: () => Promise<Tokenizer> = fakeLoader) {
  await act(async () => {
    render(<TokensDemo loader={loader} />)
  })
}

beforeEach(() => resetAppStore())

test('splits the pre-filled sample once the tokenizer is loaded', async () => {
  await renderDemo()
  expect(screen.getByRole('textbox', { name: 'Type a sentence' })).toHaveValue(SAMPLE_TEXT)
  expect(screen.getByText(`${SAMPLE_TEXT.length} tokens · ${SAMPLE_TEXT.length} characters`)).toBeInTheDocument()
})

test('updates as the user types', async () => {
  const user = userEvent.setup()
  await renderDemo()
  const box = screen.getByRole('textbox', { name: 'Type a sentence' })
  await user.clear(box)
  await user.type(box, 'Hi AI')
  expect(screen.getByText('5 tokens · 5 characters')).toBeInTheDocument()
})

// Review focus 5: a huge paste stays capped and responsive.
test('caps pasted text at the demo limit', async () => {
  const user = userEvent.setup()
  await renderDemo()
  const box = screen.getByRole('textbox', { name: 'Type a sentence' })
  await user.clear(box)
  await user.click(box)
  await user.paste('x'.repeat(5000))
  expect((box as HTMLTextAreaElement).value).toHaveLength(MAX_DEMO_CHARS)
  expect(screen.getByText(`${MAX_DEMO_CHARS} tokens · ${MAX_DEMO_CHARS} characters`)).toBeInTheDocument()
  expect(screen.getByText(`Limited to ${MAX_DEMO_CHARS} characters.`)).toBeInTheDocument()
})

test('explains when the tokenizer cannot load', async () => {
  await renderDemo(() => Promise.reject(new Error('offline')))
  expect(screen.getByRole('alert')).toHaveTextContent("The live demo couldn't load.")
})

// Review focus 3: typing a space in the demo must not advance the dialogue.
test('typing in the demo does not advance the dialogue', async () => {
  const user = userEvent.setup()
  act(() => appStore.getState().openTopic('what-is-ai'))
  await act(async () => {
    render(
      <>
        <DialogueBox />
        <TokensDemo loader={fakeLoader} />
      </>,
    )
  })
  await user.type(screen.getByRole('textbox', { name: 'Type a sentence' }), ' {Enter}')
  expect(appStore.getState().dialogue).toMatchObject({ beatIndex: 0, phase: 'typing' })
})

test('the real tokenizer splits the sample like the wall screen', async () => {
  expect(splitTokens(await loadTokenizer(), SAMPLE_TEXT)).toEqual([...SAMPLE_TOKENS])
})
