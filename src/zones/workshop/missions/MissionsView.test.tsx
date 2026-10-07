import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { appStore } from '../../../core/store'
import { resetAppStore } from '../../../test/resetAppStore'
import { makeWorkshopStore } from '../../../test/workshopStore'
import { WorkshopStoreProvider } from '../store'
import { MissionsView, TIP_DELAY_MS, type BuilderSlotProps } from './MissionsView'

function StubBuilder({ input, runKey, onDone }: BuilderSlotProps) {
  useEffect(() => {
    if (input) onDone(runKey)
  }, [input, runKey, onDone])
  return <div data-testid="builder" data-run={runKey} />
}

function renderView(missionId: string) {
  const store = makeWorkshopStore()
  const onSelect = vi.fn()
  render(
    <WorkshopStoreProvider value={store}>
      <MissionsView missionId={missionId} onSelectMission={onSelect} renderBuilder={(props) => <StubBuilder {...props} />} />
    </WorkshopStoreProvider>,
  )
  return { store, onSelect }
}

/** A builder slot the test drives by hand: nothing is revealed until the test calls onDone. Returns the latest slot props. */
function renderManual(missionId: string) {
  let slot: BuilderSlotProps | null = null
  render(
    <WorkshopStoreProvider value={makeWorkshopStore()}>
      <MissionsView
        missionId={missionId}
        onSelectMission={() => {}}
        renderBuilder={(props) => {
          slot = props
          return null
        }}
      />
    </WorkshopStoreProvider>,
  )
  return () => slot!
}

const ada = () => within(screen.getByRole('complementary', { name: 'Ada' }))
const adaSays = (text: string | RegExp) => ada().getByText(text, { selector: '.sr-only' })
/** Ada's comment on a result: it only appears once the builder slot has called onDone, so it is awaited. */
const adaWillSay = (text: string | RegExp) => ada().findByText(text, { selector: '.sr-only' })
async function fill(user: ReturnType<typeof userEvent.setup>, name: string, value: string) {
  const field = screen.getByRole('textbox', { name })
  await user.clear(field)
  await user.click(field)
  await user.paste(value)
}
const letter = {
  'Role block': 'An account manager at a web agency',
  'Task block': 'Write an email to the client',
  'Context block': "The client is Martin's Bakery. The launch moves to next Friday because the photos arrived late.",
  'Format block': 'Friendly and apologetic, under 120 words',
}
async function fillLetter(user: ReturnType<typeof userEvent.setup>, overrides: Partial<typeof letter> = {}) {
  for (const [name, value] of Object.entries({ ...letter, ...overrides })) await fill(user, name, value)
}

beforeEach(() => resetAppStore({ reducedMotion: true }))
afterEach(() => vi.useRealTimers())

test('Ada introduces the mission and the output waits for a test', () => {
  renderView('delayed-website')
  expect(screen.getByRole('region', { name: 'PROMPT_STUDIO.EXE \u2014 MISSION 1' })).toBeInTheDocument()
  expect(adaSays(/First mission: a client email with bad news/)).toBeInTheDocument()
  expect(screen.getByText('Press Build & test to see what the AI would write.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Build & test' })).toBeDisabled()
})

test('a thin context leans: passable answer, cardboard badge, Ada names the weak block', async () => {
  const user = userEvent.setup()
  const { store } = renderView('delayed-website')
  await fillLetter(user, { 'Context block': 'The website is late', 'Format block': 'Friendly' })
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await screen.findByText('LEANING \u00B7 PASSABLE')).toBeInTheDocument()
  expect(screen.getByText('CARDBOARD')).toBeInTheDocument()
  expect(await adaWillSay(/^The Context block is only cardboard\. Who is the client\?/)).toBeInTheDocument()
  await waitFor(() => expect(store.getState().announcement).toMatch(/^LEANING \u00B7 PASSABLE\. The Context block is only cardboard/))
})

test('a complete prompt holds, passes the mission and offers the next one', async () => {
  const user = userEvent.setup()
  const { onSelect } = renderView('delayed-website')
  await fillLetter(user)
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await screen.findByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
  expect(await adaWillSay(/^It holds! Every block is solid stone/)).toBeInTheDocument()
  expect(appStore.getState().progress.workshop?.passed).toEqual(['delayed-website'])
  await user.click(await ada().findByRole('button', { name: 'Next mission' }))
  expect(onSelect).toHaveBeenCalledWith('meeting-notes')
})

test('"It\'s already there" counts the missing detail and rebuilds', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fillLetter(user, { 'Context block': "The client is Martin's Bakery. The photos arrived late, new launch soon." })
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await adaWillSay(/^The Context block is only wood\. When will it be ready\?/)).toBeInTheDocument()
  await user.click(ada().getByRole('button', { name: "It's already there" }))
  expect(await adaWillSay(/^Sorry, I missed it! I was looking for something like "friday"\. It holds!/)).toBeInTheDocument()
  expect(await screen.findByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
})

test('Edit my prompt puts the cursor in the weak block', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fillLetter(user, { 'Context block': 'The website is late' })
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  await user.click(await ada().findByRole('button', { name: 'Edit my prompt' }))
  expect(screen.getByRole('textbox', { name: 'Context block' })).toHaveFocus()
})

test('in free text, Edit my prompt puts the cursor at the end of the sentence that built the weak block', async () => {
  const user = userEvent.setup()
  renderView('florist-post')
  const sentence = "Write an Instagram post for Rosa's Flowers about the Mother's Day discount."
  const text = `You are a social media manager. ${sentence} Make it warm and joyful.`
  await fill(user, 'Your prompt', text)
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await adaWillSay(/^The Context block is only wood\. Until when\?/)).toBeInTheDocument()
  await user.click(ada().getByRole('button', { name: 'Edit my prompt' }))
  const editor = screen.getByRole('textbox', { name: 'Your prompt' }) as HTMLTextAreaElement
  const end = text.indexOf(sentence) + sentence.length
  expect(editor).toHaveFocus()
  // A caret, not a selection: the first key typed must not replace the sentence.
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([end, end])
})

test('Ctrl+Enter builds and tests', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fill(user, 'Task block', 'Write an email')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(await screen.findByText('COLLAPSED \u00B7 VAGUE')).toBeInTheDocument()
})

test('Before / After compares the first attempt with the latest one', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fill(user, 'Task block', 'Write an email')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  await fillLetter(user)
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  await user.click(await ada().findByRole('button', { name: 'Before / After' }))
  // One signal for the toggle: the label stays, the pressed state changes.
  expect(ada().getByRole('button', { name: 'Before / After' })).toHaveAttribute('aria-pressed', 'true')
  const output = screen.getByRole('region', { name: 'AI_OUTPUT.TXT' })
  expect(within(output).getByRole('heading', { name: 'Before' })).toBeInTheDocument()
  expect(within(output).getByRole('heading', { name: 'After' })).toBeInTheDocument()
  expect(within(output).getByText('COLLAPSED \u00B7 VAGUE')).toBeInTheDocument()
  expect(within(output).getByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
  // Each side also shows what every block was made of.
  const side = (name: string) => within(within(output).getByRole('heading', { name }).closest('section')!)
  expect(side('Before').getAllByText('HOLE')).toHaveLength(3)
  expect(side('Before').getAllByText('STONE')).toHaveLength(1)
  expect(side('After').getAllByText('STONE')).toHaveLength(4)
  expect(side('After').queryByText('HOLE')).toBeNull()
})

test('in free text Ada gives a tip after a pause, and "Not now" mutes the tips', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { store } = renderView('florist-post')
  await fill(user, 'Your prompt', "Write an Instagram post for Rosa's Flowers about the Mother's Day discount")
  act(() => vi.advanceTimersByTime(TIP_DELAY_MS))
  expect(adaSays("It looks like you're writing a prompt! Who should the AI be? A social media manager knows how posts work.")).toBeInTheDocument()
  await user.click(ada().getByRole('button', { name: 'Not now' }))
  expect(store.getState().sessions['florist-post'].tipsMuted).toBe(true)
  expect(adaSays(/^Level 2: no more blocks to fill/)).toBeInTheDocument()
})

test('a test cancels the tip Ada was about to give: she comments on the result instead', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderView('florist-post')
  await fill(user, 'Your prompt', "Write an Instagram post for Rosa's Flowers about the Mother's Day discount")
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  act(() => vi.advanceTimersByTime(TIP_DELAY_MS))
  expect(await adaWillSay(/^There's a hole in the building: the Role block is missing\./)).toBeInTheDocument()
  expect(ada().queryByText(/It looks like you're writing a prompt!/, { selector: '.sr-only' })).toBeNull()
})

test('a fix mission starts from its collapsed prompt and Reset restores it', async () => {
  const user = userEvent.setup()
  renderView('plumber-services')
  const editor = screen.getByRole('textbox', { name: 'Your prompt' })
  expect(editor).toHaveValue('Write a services page.')
  expect(await screen.findByText('COLLAPSED \u00B7 VAGUE')).toBeInTheDocument()
  expect(await screen.findByText(/We offer a wide range of high-quality services/)).toBeInTheDocument()
  expect(await adaWillSay(/^Level 3: this prompt gave the answer you see/)).toBeInTheDocument()
  await user.type(editor, ' For Bram.')
  await user.click(screen.getByRole('button', { name: 'Reset' }))
  expect(editor).toHaveValue('Write a services page.')
})

test('Copy my prompt copies the assembled prompt, or selects it when the clipboard is refused', async () => {
  // userEvent.setup() puts its own clipboard stub on navigator: spy on that stub, after the setup.
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
  renderView('delayed-website')
  await fill(user, 'Role block', 'A writer')
  await user.click(screen.getByRole('button', { name: 'Copy my prompt' }))
  expect(writeText).toHaveBeenCalledWith('Role: A writer')
  expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Copied' }))
  const fallback = (await screen.findByRole('textbox', { name: /press Ctrl\+C to copy it/ })) as HTMLTextAreaElement
  expect(fallback).toHaveValue('Role: A writer')
  expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, 'Role: A writer'.length])
})

test('a double click on Build & test reveals the latest run only', async () => {
  const user = userEvent.setup()
  const slot = renderManual('delayed-website')
  await fillLetter(user)
  await user.dblClick(screen.getByRole('button', { name: 'Build & test' }))
  expect(appStore.getState().progress.workshop?.passed).toEqual(['delayed-website'])
  const latest = slot().runKey
  act(() => slot().onDone(latest - 1))
  expect(screen.getByText('The AI is reading your building\u2026', { selector: '.ws-output__note' })).toBeInTheDocument()
  expect(screen.queryByText('HOLDS \u00B7 EXCELLENT')).toBeNull()
  expect(adaSays('The AI is reading your building\u2026')).toBeInTheDocument()
  act(() => slot().onDone(latest))
  expect(await screen.findByText('HOLDS \u00B7 EXCELLENT')).toBeInTheDocument()
  expect(await adaWillSay(/^It holds!/)).toBeInTheDocument()
  // Both runs tested the same prompt: Before / After would show two identical columns.
  expect(ada().queryByRole('button', { name: 'Before / After' })).toBeNull()
})

test('the material badges wait for the builder to finish', async () => {
  const user = userEvent.setup()
  const slot = renderManual('delayed-website')
  await fillLetter(user)
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(screen.queryByText('STONE')).toBeNull()
  act(() => slot().onDone(slot().runKey))
  expect(await screen.findAllByText('STONE')).toHaveLength(4)
})

test('an extra block added but left empty gets no badge', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fillLetter(user)
  await user.click(screen.getByRole('button', { name: 'Example' }))
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await screen.findAllByText('STONE')).toHaveLength(4)
  expect(screen.queryByText('HOLE')).toBeNull()
})

test('a click on a block of the building selects its sentence, unless the prompt changed since the test', async () => {
  const user = userEvent.setup()
  const slot = renderManual('florist-post')
  const text = "You are a social media manager. Write a post for Rosa's Flowers."
  await fill(user, 'Your prompt', text)
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  act(() => slot().onDone(slot().runKey))
  const editor = screen.getByRole('textbox', { name: 'Your prompt' }) as HTMLTextAreaElement
  act(() => slot().onBlockClick('context'))
  expect(editor).toHaveFocus()
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([text.indexOf('Write a post'), text.length])
  await fill(user, 'Your prompt', `Hello there. ${text}`)
  editor.setSelectionRange(0, 0)
  act(() => slot().onBlockClick('context'))
  // The tested offsets would now land on other words: the block is focused without them, caret at the end.
  expect([editor.selectionStart, editor.selectionEnd]).toEqual([editor.value.length, editor.value.length])
})

test('a bubble closed with Escape comes back with the next result, even when Ada says the same thing', async () => {
  const user = userEvent.setup()
  renderView('delayed-website')
  await fillLetter(user, { 'Context block': 'The website is late' })
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  const advice = /^The Context block is only cardboard\./
  expect(await adaWillSay(advice)).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(ada().queryByText(advice, { selector: '.sr-only' })).toBeNull()
  expect(ada().queryByRole('button', { name: 'Edit my prompt' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await adaWillSay(advice)).toBeInTheDocument()
  expect(ada().getByRole('button', { name: 'Edit my prompt' })).toBeInTheDocument()
})

test('a new test clears the reading ring of the previous run', async () => {
  const user = userEvent.setup()
  const slot = renderManual('delayed-website')
  await fill(user, 'Context block', 'The website is late')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  act(() => slot().onReading('context'))
  const block = () => screen.getByRole('textbox', { name: 'Context block' }).closest('.ws-block')
  expect(block()).toHaveClass('is-reading')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(block()).not.toHaveClass('is-reading')
})

function ReadingBuilder({ input, onReading }: BuilderSlotProps) {
  useEffect(() => {
    if (input) onReading('context')
  }, [input, onReading])
  return null
}

function renderReading(missionId: string) {
  render(
    <WorkshopStoreProvider value={makeWorkshopStore()}>
      <MissionsView missionId={missionId} onSelectMission={() => {}} renderBuilder={(props) => <ReadingBuilder {...props} />} />
    </WorkshopStoreProvider>,
  )
}

test('while the AI reads the building, the block being read is highlighted', async () => {
  const user = userEvent.setup()
  renderReading('delayed-website')
  await fill(user, 'Context block', 'The website is late')
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Context block' }).closest('.ws-block')).toHaveClass('is-reading'))
})

test('in free text the sentence being read is shown highlighted', async () => {
  const user = userEvent.setup()
  renderReading('florist-post')
  await fill(user, 'Your prompt', "You are a social media manager. Write a post for Rosa's Flowers.")
  await user.click(screen.getByRole('button', { name: 'Build & test' }))
  expect(await screen.findByText("Write a post for Rosa's Flowers.", { selector: 'mark' })).toBeInTheDocument()
})

test('the list marks the current, the passed and the suggested missions', async () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt', 6)
  renderView('florist-post')
  const list = screen.getByRole('navigation', { name: 'Missions' })
  expect(within(list).getByRole('button', { name: /A post for a florist/ })).toHaveAttribute('aria-current', 'true')
  expect(within(list).getByRole('button', { name: /The delayed website \(passed\)/ })).toBeInTheDocument()
  expect(within(list).getByRole('button', { name: /Meeting notes for your manager.*Start here/ })).toBeInTheDocument()
})
