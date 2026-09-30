import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueBox } from './DialogueBox'
import { ExpandOverlay } from './ExpandOverlay'

// The real content has no topic on the tokens screen yet: add one to the content the store and selectors read.
vi.mock('../content/load', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../content/load')>()
  const { makeTopic } = await import('../test/fixtures')
  const tokensTopic = makeTopic({
    id: 'tokens-fixture',
    title: 'Tokens fixture',
    basics: [{ say: 'Tokens are pieces of text.', screen: 'tokens:1' }],
  })
  return {
    ...actual,
    getContent: (lang: string) => {
      const content = actual.getContent(lang)
      return { ...content, topicById: new Map([...content.topicById, [tokensTopic.id, tokensTopic]]) }
    },
  }
})

const tryIt = () => screen.queryByRole('button', { name: 'Try it yourself' })

beforeEach(() => resetAppStore())

test('offers "Try it yourself" only while the screen shows the tokens visual', () => {
  act(() => appStore.getState().openTopic('what-is-ai'))
  const { unmount } = render(<DialogueBox />)
  expect(tryIt()).not.toBeInTheDocument()
  unmount()

  act(() => appStore.getState().openTopic('tokens-fixture'))
  render(<DialogueBox />)
  expect(tryIt()).toBeInTheDocument()
})

test('"Try it yourself" opens the expanded view with the live demo', async () => {
  const user = userEvent.setup()
  act(() => appStore.getState().openTopic('tokens-fixture'))
  render(<DialogueBox />)
  await user.click(tryIt()!)
  expect(appStore.getState().expandOpen).toBe(true)
})

test('the expanded tokens view shows the demo and keeps Tab focus inside the dialog', async () => {
  const user = userEvent.setup()
  act(() => {
    appStore.getState().openTopic('tokens-fixture')
    appStore.getState().setExpandOpen(true)
  })
  render(<ExpandOverlay />)
  // Wait for the lazily loaded tokenizer so its state update lands inside Testing Library's act
  // (scoped to the demo: the wall screen itself also prints a token count).
  const demo = await screen.findByRole('region', { name: 'Try it yourself' })
  expect(await within(demo).findByText(/^\d+ tokens · \d+ characters$/)).toBeInTheDocument()
  const close = screen.getByRole('button', { name: 'Close' })
  const box = screen.getByRole('textbox', { name: 'Type a sentence' })
  expect(close).toHaveFocus()
  await user.tab()
  expect(box).toHaveFocus()
  await user.tab()
  expect(close).toHaveFocus()
  await user.tab({ shift: true })
  expect(box).toHaveFocus()
})

test('a screen that is not the tokens visual gets no demo', () => {
  act(() => {
    appStore.getState().openTopic('what-is-ai')
    appStore.getState().setExpandOpen(true)
  })
  render(<ExpandOverlay />)
  expect(screen.queryByRole('textbox', { name: 'Type a sentence' })).not.toBeInTheDocument()
})
