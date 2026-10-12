import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { resetAppStore } from '../../../test/resetAppStore'
import { makeReport } from '../../../test/workshopFixtures'
import { makeWorkshopStore } from '../../../test/workshopStore'
import type { BuildingInput } from '../../../workshop/building/plan'
import { WorkshopStoreProvider, type CorrectorApi } from '../store'
import { CorrectorView, type CorrectorBuilderProps } from './CorrectorView'

function StubBuilder({ input, runKey, onDone }: { input: BuildingInput | null; runKey: number; onDone: (key: number) => void }) {
  useEffect(() => {
    if (input) onDone(runKey)
  }, [input, runKey, onDone])
  return <div data-testid="builder">{input?.tier}</div>
}

async function renderView(api: Partial<CorrectorApi> = {}) {
  const store = makeWorkshopStore({ api })
  await act(async () => {
    render(
      <WorkshopStoreProvider value={store}>
        <CorrectorView renderBuilder={(props) => <StubBuilder {...props} />} />
      </WorkshopStoreProvider>,
    )
  })
  return store
}

/**
 * A builder that never finishes by itself: the test calls onDone, and every runKey it was rendered with is kept.
 * Pass the store of an earlier render to open the view again on the same workshop.
 */
async function renderHeld(store = makeWorkshopStore()) {
  const builder: { runKeys: number[]; props: CorrectorBuilderProps | null } = { runKeys: [], props: null }
  await act(async () => {
    render(
      <WorkshopStoreProvider value={store}>
        <CorrectorView
          renderBuilder={(props) => {
            builder.runKeys.push(props.runKey)
            builder.props = props
            return <div data-testid="builder" />
          }}
        />
      </WorkshopStoreProvider>,
    )
  })
  return { store, builder }
}

const ada = () => within(screen.getByRole('complementary', { name: 'Ada' }))
const corrector = () => within(screen.getByRole('region', { name: 'CORRECTOR.EXE' }))
const output = () => within(screen.getByRole('region', { name: 'AI_OUTPUT.TXT' }))
const promptField = () => corrector().getByRole('textbox', { name: 'Paste or write any prompt' })
const SCORE_LINE = '62/100 \u00b7 Leans'
const STALE = 'Edited since this check. Check your prompt again to update the report and run both.'
/**
 * A browser moves the focus off a button that turns disabled, to the page; jsdom leaves it there (and will not blur a
 * disabled element), so the tests do what the browser does: the focus passes through a throwaway button to the page.
 */
const loseFocus = (element: HTMLElement) => {
  expect(element).toHaveFocus()
  const elsewhere = document.createElement('button')
  document.body.append(elsewhere)
  act(() => {
    elsewhere.focus()
    elsewhere.blur()
  })
  elsewhere.remove()
  expect(document.body).toHaveFocus()
}

beforeEach(() => resetAppStore({ reducedMotion: true }))

test('without the server the corrector says it is offline', async () => {
  await renderView({ health: async () => ({ ok: true, data: { corrector: false } }) })
  expect(corrector().getByText('The corrector is offline.')).toBeInTheDocument()
  expect(corrector().queryByRole('textbox')).not.toBeInTheDocument()
  expect(output().getByText('The corrector is offline, so there is nothing to compare yet.')).toBeInTheDocument()
  expect(output().queryByText("Paste any prompt and I'll ask a real AI to inspect your building.")).not.toBeInTheDocument()
})

test('the builder waits for Check my prompt, not for Build & test', async () => {
  const { builder } = await renderHeld()
  expect(builder.props).toMatchObject({ input: null, emptyText: 'Your building will appear here after Check my prompt.' })
})

// Offline there is no Check my prompt button: the builder does not send the learner looking for one.
test('offline, the builder says there is no building instead of waiting for a check', async () => {
  const { builder } = await renderHeld(makeWorkshopStore({ api: { health: async () => ({ ok: true, data: { corrector: false } }) } }))
  expect(builder.props).toMatchObject({ input: null, emptyText: 'The corrector is offline, so there is no building to inspect.' })
})

test('checks a prompt: score, materials, summary, building and the improved prompt', async () => {
  const user = userEvent.setup()
  const store = await renderView()
  expect(corrector().getByText(/this text is sent to OpenAI/)).toBeInTheDocument()
  const check = corrector().getByRole('button', { name: 'Check my prompt' })
  expect(check).toBeDisabled()
  await user.type(promptField(), 'Write a post')
  await user.click(check)
  expect(await corrector().findByText(SCORE_LINE)).toBeInTheDocument()
  expect(corrector().getAllByText('CARDBOARD')).toHaveLength(1)
  expect(await ada().findByText('The building leans: the context floor is thin.', { selector: '.sr-only' })).toBeInTheDocument()
  expect(screen.getByTestId('builder')).toHaveTextContent('passable')
  const improved = output()
  expect(await improved.findByRole('heading', { name: 'Improved prompt' })).toBeInTheDocument()
  expect(improved.getByText(/Rosa's Flowers/, { selector: 'ins' })).toBeInTheDocument()
  await waitFor(() => expect(store.getState().announcement).toBe('62/100. Leans. The building leans: the context floor is thin.'))
})

// Review focus 3: slow, failing and repeated checks.
test('the button is disabled while checking; an error keeps the text and offers to try again', async () => {
  const user = userEvent.setup()
  let resolve!: (value: Awaited<ReturnType<CorrectorApi['correct']>>) => void
  const correct = vi
    .fn<CorrectorApi['correct']>()
    .mockImplementationOnce(() => new Promise((r) => (resolve = r)))
    .mockResolvedValueOnce({ ok: true, data: makeReport() })
  await renderView({ correct })
  const field = promptField()
  await user.type(field, 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  expect(corrector().getByRole('button', { name: 'Check my prompt' })).toBeDisabled()
  expect(corrector().getByText('Asking the AI to inspect your building\u2026')).toBeInTheDocument()
  await act(async () => resolve({ ok: false, error: 'timeout' }))
  expect(await corrector().findByText('The AI took too long to answer. Try again.')).toBeInTheDocument()
  expect(field).toHaveValue('Write a post')
  await user.click(corrector().getByRole('button', { name: 'Try again' }))
  expect(await corrector().findByText(SCORE_LINE)).toBeInTheDocument()
  expect(correct).toHaveBeenCalledTimes(2)
})

test('a check that cannot reach the server ignores a second submit, keeps the form filled and can be tried again', async () => {
  const user = userEvent.setup()
  let reject!: (reason: Error) => void
  const correct = vi
    .fn<CorrectorApi['correct']>()
    .mockImplementationOnce(() => new Promise((_, r) => (reject = r)))
    .mockResolvedValueOnce({ ok: true, data: makeReport() })
  const store = await renderView({ correct })
  const field = promptField()
  const purpose = corrector().getByRole('textbox', { name: 'What is it for? (optional)' })
  await user.type(field, 'Write a post')
  await user.type(purpose, 'A shop post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await user.dblClick(corrector().getByRole('button', { name: 'Check my prompt' }))
  await user.type(field, '{Control>}{Enter}{/Control}')
  expect(correct).toHaveBeenCalledTimes(1)
  await act(async () => reject(new Error('Failed to fetch')))
  const message = "The AI isn't reachable right now. Try again in a moment."
  expect(await corrector().findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(store.getState().announcement).toBe(message))
  expect(field).toHaveValue('Write a post')
  expect(purpose).toHaveValue('A shop post')
  await user.click(corrector().getByRole('button', { name: 'Try again' }))
  expect(await corrector().findByText(SCORE_LINE)).toBeInTheDocument()
  expect(corrector().queryByText(message)).not.toBeInTheDocument()
  expect(correct).toHaveBeenCalledTimes(2)
  expect(correct).toHaveBeenLastCalledWith({ prompt: 'Write a post', purpose: 'A shop post', lang: 'en' })
})

test('an edited prompt marks the report as outdated; a failed re-check shows its error above the old report', async () => {
  const user = userEvent.setup()
  const correct = vi
    .fn<CorrectorApi['correct']>()
    .mockResolvedValueOnce({ ok: true, data: makeReport() })
    .mockResolvedValueOnce({ ok: false, error: 'rate' })
    .mockResolvedValueOnce({ ok: true, data: makeReport() })
  await renderView({ correct })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  expect(await output().findByRole('button', { name: 'Run both' })).toBeInTheDocument()
  expect(screen.queryByText(STALE)).not.toBeInTheDocument()

  await user.type(promptField(), ' today')
  expect(corrector().getByText(STALE)).toBeInTheDocument()
  expect(output().getByText(STALE)).toBeInTheDocument()
  expect(output().queryByRole('button', { name: 'Run both' })).not.toBeInTheDocument()

  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  const error = await corrector().findByText("You've reached the corrector's limit for now. Try again in a minute.")
  const oldScore = corrector().getByText(SCORE_LINE)
  expect(error.compareDocumentPosition(oldScore) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(corrector().getByText(STALE)).toBeInTheDocument()

  await user.click(corrector().getByRole('button', { name: 'Try again' }))
  expect(await output().findByRole('button', { name: 'Run both' })).toBeInTheDocument()
  expect(screen.queryByText(STALE)).not.toBeInTheDocument()
  expect(correct).toHaveBeenLastCalledWith({ prompt: 'Write a post today', purpose: undefined, lang: 'en' })
})

test('Run both shows both real answers side by side', async () => {
  const user = userEvent.setup()
  await renderView()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  const panel = output()
  await user.click(await panel.findByRole('button', { name: 'Run both' }))
  expect(await panel.findByRole('heading', { name: 'With your prompt' })).toBeInTheDocument()
  expect(await panel.findByText('Answer to: Write a post')).toBeInTheDocument()
  expect(panel.getByRole('heading', { name: 'With the improved prompt' })).toBeInTheDocument()
})

// Spec 3.9: the answers are capped. One cut at the length limit is still shown, with a note under it.
test('an answer cut at the length limit is shown with a note under it', async () => {
  const user = userEvent.setup()
  const run = vi.fn<CorrectorApi['run']>(async (prompt) =>
    prompt === 'Write a post' ? { ok: true, data: { answer: 'Dear Martin, the launch', truncated: true } } : { ok: true, data: { answer: 'A whole answer.' } },
  )
  await renderView({ run })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await user.click(await output().findByRole('button', { name: 'Run both' }))
  const answer = await output().findByText('Dear Martin, the launch')
  const notes = output().getAllByText('The answer was cut short at the length limit.')
  expect(notes).toHaveLength(1)
  expect(answer.nextElementSibling).toBe(notes[0])
  expect(output().getByText('A whole answer.').nextElementSibling).toBeNull()
})

// The check's own error text speaks of the check: a failed run says it was the run.
test('a failed Run both says the run went wrong, not the check', async () => {
  const user = userEvent.setup()
  const run = vi.fn<CorrectorApi['run']>().mockResolvedValueOnce({ ok: false, error: 'error' }).mockResolvedValue({ ok: false, error: 'invalid' })
  const store = await renderView({ run })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await user.click(await output().findByRole('button', { name: 'Run both' }))
  const message = 'Something went wrong while running the prompts. Try again.'
  expect(await output().findByText(message)).toBeInTheDocument()
  expect(screen.queryByText(/with the check/)).toBeNull()
  await waitFor(() => expect(store.getState().announcement).toBe(message))
  // A prompt the server refuses to run is not a prompt that "can't be checked".
  await user.click(output().getByRole('button', { name: 'Run both' }))
  await waitFor(() => expect(store.getState().corrector.run.error).toBe('invalid'))
  expect(output().getByText(message)).toBeInTheDocument()
  expect(screen.queryByText(/can't be checked/)).toBeNull()
})

test('Run both is disabled while its answers or a new check are on their way', async () => {
  const user = userEvent.setup()
  let release!: () => void
  const gate = new Promise<void>((r) => (release = r))
  let finishCheck!: (value: Awaited<ReturnType<CorrectorApi['correct']>>) => void
  const correct = vi
    .fn<CorrectorApi['correct']>()
    .mockResolvedValueOnce({ ok: true, data: makeReport() })
    .mockImplementationOnce(() => new Promise((r) => (finishCheck = r)))
  const run = vi.fn<CorrectorApi['run']>(async (prompt) => {
    await gate
    return { ok: true, data: { answer: `Answer to: ${prompt}` } }
  })
  await renderView({ correct, run })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  const runBoth = await output().findByRole('button', { name: 'Run both' })
  await user.click(runBoth)
  expect(runBoth).toBeDisabled()
  expect(output().getByText('Running both prompts\u2026')).toBeInTheDocument()
  await user.click(runBoth)
  expect(run).toHaveBeenCalledTimes(2)
  await act(async () => release())
  expect(await output().findByText('Answer to: Write a post')).toBeInTheDocument()
  expect(runBoth).toBeEnabled()

  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  expect(runBoth).toBeDisabled()
  await act(async () => finishCheck({ ok: false, error: 'timeout' }))
  expect(await corrector().findByText('The AI took too long to answer. Try again.')).toBeInTheDocument()
  expect(runBoth).toBeEnabled()
})

test('Copy copies the improved prompt, or shows it selected with the Ctrl+C hint when the clipboard refuses', async () => {
  // userEvent.setup() puts its own clipboard stub on navigator: spy on that stub, after the setup.
  const user = userEvent.setup()
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'))
  await renderView()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  const improvedPrompt = makeReport().improvedPrompt
  await user.click(await output().findByRole('button', { name: 'Copy' }))
  expect(writeText).toHaveBeenCalledWith(improvedPrompt)
  await user.click(await output().findByRole('button', { name: 'Copied' }))
  const fallback = (await output().findByRole('textbox', { name: 'The improved prompt is selected below. Press Ctrl+C to copy it.' })) as HTMLTextAreaElement
  expect(fallback).toHaveValue(improvedPrompt)
  expect([fallback.selectionStart, fallback.selectionEnd]).toEqual([0, improvedPrompt.length])
})

test('Ctrl+Enter checks the prompt', async () => {
  const user = userEvent.setup()
  const correct = vi.fn<CorrectorApi['correct']>(async () => ({ ok: true, data: makeReport() }))
  await renderView({ correct })
  await user.type(promptField(), 'Write a post')
  await user.keyboard('{Control>}{Enter}{/Control}')
  expect(correct).toHaveBeenCalledWith({ prompt: 'Write a post', purpose: undefined, lang: 'en' })
})

test('the report waits for its building; an older building finishing is ignored; the run key only moves with a new report', async () => {
  const user = userEvent.setup()
  const { store, builder } = await renderHeld()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await waitFor(() => expect(builder.props?.input).not.toBeNull())
  expect(builder.props!.runKey).toBe(1)
  // The building is still going up: no score, no badges, no improved prompt, nothing announced.
  expect(corrector().queryByText(SCORE_LINE)).not.toBeInTheDocument()
  expect(screen.queryByText('CARDBOARD')).not.toBeInTheDocument()
  expect(output().getByText('The AI is reading your building\u2026')).toBeInTheDocument()
  expect(output().queryByRole('heading', { name: 'Improved prompt' })).not.toBeInTheDocument()
  expect(store.getState().announcement).toBe('')
  act(() => builder.props!.onDone(0))
  expect(corrector().queryByText(SCORE_LINE)).not.toBeInTheDocument()
  act(() => builder.props!.onDone(1))
  expect(corrector().getByText(SCORE_LINE)).toBeInTheDocument()
  expect(corrector().getAllByText('CARDBOARD')).toHaveLength(1)
  expect(output().getByRole('heading', { name: 'Improved prompt' })).toBeInTheDocument()

  // Typing renders the builder again with the same key and building: it does not start over.
  const input = builder.props!.input
  const rendered = builder.runKeys.length
  await user.type(promptField(), ' today')
  expect(builder.runKeys.length).toBeGreaterThan(rendered)
  expect(new Set(builder.runKeys.slice(rendered))).toEqual(new Set([1]))
  expect(builder.props!.input).toBe(input)

  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await waitFor(() => expect(builder.props!.runKey).toBe(2))
  expect(corrector().queryByText(SCORE_LINE)).not.toBeInTheDocument()
  // The first building finishing late neither reveals the new report nor, later, hides it.
  act(() => builder.props!.onDone(1))
  expect(corrector().queryByText(SCORE_LINE)).not.toBeInTheDocument()
  act(() => builder.props!.onDone(2))
  expect(corrector().getByText(SCORE_LINE)).toBeInTheDocument()
  act(() => builder.props!.onDone(1))
  expect(corrector().getByText(SCORE_LINE)).toBeInTheDocument()
})

// F12 and spec 6.1: a report whose building fell back to the plan view is announced with the fallback first.
test('a report shown in the plan view after a 3D failure is announced with the fallback first', async () => {
  const user = userEvent.setup()
  const { store, builder } = await renderHeld()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await waitFor(() => expect(builder.props?.input).not.toBeNull())
  act(() => {
    builder.props!.onUnavailable(1)
    builder.props!.onDone(1)
  })
  await waitFor(() =>
    expect(store.getState().announcement).toBe(
      "The 3D builder isn't available here, so here's the plan view. 62/100. Leans. The building leans: the context floor is thin.",
    ),
  )
})

// The workshop unmounts the corrector while another program is open: coming back must not replay the last report.
test('a revealed report shows again at once when the view opens again: no replay, no second announcement', async () => {
  const user = userEvent.setup()
  const { store, builder } = await renderHeld()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await waitFor(() => expect(builder.props?.input).not.toBeNull())
  expect(builder.props!.seen).toBe(false)
  act(() => builder.props!.onDone(1))
  await waitFor(() => expect(store.getState().announcement).toBe('62/100. Leans. The building leans: the context floor is thin.'))
  const said = store.getState().announcements

  cleanup()
  const again = await renderHeld(store)
  // Shown without waiting for the builder, which is told the building was already seen to its end.
  expect(corrector().getByText(SCORE_LINE)).toBeInTheDocument()
  expect(output().getByRole('heading', { name: 'Improved prompt' })).toBeInTheDocument()
  expect(again.builder.props).toMatchObject({ runKey: 1, seen: true })
  act(() => again.builder.props!.onDone(1))
  expect(store.getState().announcements).toBe(said)
})

test('a report whose building was still going up when the view closed is built and announced when it opens again', async () => {
  const user = userEvent.setup()
  const { store, builder } = await renderHeld()
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await waitFor(() => expect(builder.props?.input).not.toBeNull())

  cleanup()
  const again = await renderHeld(store)
  expect(corrector().queryByText(SCORE_LINE)).not.toBeInTheDocument()
  expect(again.builder.props).toMatchObject({ runKey: 1, seen: false })
  expect(store.getState().announcement).toBe('')
  act(() => again.builder.props!.onDone(1))
  expect(corrector().getByText(SCORE_LINE)).toBeInTheDocument()
  await waitFor(() => expect(store.getState().announcement).toBe('62/100. Leans. The building leans: the context floor is thin.'))
})

// Review focus 3: a keyboard user who pressed a button keeps their place while it is disabled.
test('a pressed Check my prompt gets the keyboard focus back, as Try again after a failure', async () => {
  const user = userEvent.setup()
  const pending: ((value: Awaited<ReturnType<CorrectorApi['correct']>>) => void)[] = []
  const correct = vi.fn<CorrectorApi['correct']>(() => new Promise((resolve) => pending.push(resolve)))
  await renderView({ correct })
  await user.type(promptField(), 'Write a post')
  const button = corrector().getByRole('button', { name: 'Check my prompt' })
  act(() => button.focus())
  await user.keyboard('{Enter}')
  expect(button).toBeDisabled()
  loseFocus(button)
  await act(async () => pending[0]({ ok: false, error: 'timeout' }))
  expect(await corrector().findByRole('button', { name: 'Try again' })).toBe(button)
  await waitFor(() => expect(button).toHaveFocus())

  await user.keyboard('{Enter}')
  expect(button).toBeDisabled()
  loseFocus(button)
  await act(async () => pending[1]({ ok: true, data: makeReport() }))
  expect(await corrector().findByText(SCORE_LINE)).toBeInTheDocument()
  expect(button).toHaveAccessibleName('Check my prompt')
  await waitFor(() => expect(button).toHaveFocus())
})

test('a pressed Run both gets the keyboard focus back when the answers arrive, unless the reader moved on', async () => {
  const user = userEvent.setup()
  const waiting: (() => void)[] = []
  const run = vi.fn<CorrectorApi['run']>(async (prompt) => {
    await new Promise<void>((release) => waiting.push(release))
    return { ok: true, data: { answer: `Answer to: ${prompt}` } }
  })
  const answer = () => act(async () => waiting.splice(0).forEach((release) => release()))
  await renderView({ run })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  const runBoth = await output().findByRole('button', { name: 'Run both' })
  act(() => runBoth.focus())
  await user.keyboard('{Enter}')
  expect(runBoth).toBeDisabled()
  loseFocus(runBoth)
  await answer()
  expect(await output().findByText('Answer to: Write a post')).toBeInTheDocument()
  await waitFor(() => expect(runBoth).toHaveFocus())

  // Pressed again, then the reader goes back to the prompt: the focus stays where they put it.
  await user.keyboard('{Enter}')
  expect(runBoth).toBeDisabled()
  loseFocus(runBoth)
  act(() => promptField().focus())
  await answer()
  await waitFor(() => expect(runBoth).toBeEnabled())
  expect(promptField()).toHaveFocus()
})

test('Run both says when both answers are ready, or why they are not', async () => {
  const user = userEvent.setup()
  const run = vi
    .fn<CorrectorApi['run']>()
    .mockResolvedValueOnce({ ok: true, data: { answer: 'One' } })
    .mockResolvedValueOnce({ ok: true, data: { answer: 'Two' } })
    .mockResolvedValue({ ok: false, error: 'rate' })
  const store = await renderView({ run })
  await user.type(promptField(), 'Write a post')
  await user.click(corrector().getByRole('button', { name: 'Check my prompt' }))
  await user.click(await output().findByRole('button', { name: 'Run both' }))
  await waitFor(() => expect(store.getState().announcement).toBe('Both answers are ready, side by side.'))
  await user.click(output().getByRole('button', { name: 'Run both' }))
  const message = "You've reached the corrector's limit for now. Try again in a minute."
  expect(await output().findByText(message)).toBeInTheDocument()
  await waitFor(() => expect(store.getState().announcement).toBe(message))
})
