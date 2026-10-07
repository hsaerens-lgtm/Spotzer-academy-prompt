import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { resetAppStore } from '../../../test/resetAppStore'
import { makeReport } from '../../../test/workshopFixtures'
import { makeWorkshopStore } from '../../../test/workshopStore'
import type { BuildingInput } from '../../../workshop/building/plan'
import { WorkshopStoreProvider, type CorrectorApi } from '../store'
import { CorrectorView } from './CorrectorView'

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

const ada = () => within(screen.getByRole('complementary', { name: 'Ada' }))
const corrector = () => within(screen.getByRole('region', { name: 'CORRECTOR.EXE' }))
const output = () => within(screen.getByRole('region', { name: 'AI_OUTPUT.TXT' }))
const promptField = () => corrector().getByRole('textbox', { name: 'Paste or write any prompt' })
const SCORE_LINE = '62/100 \u00b7 Leans'
const STALE = 'Edited since this check. Check your prompt again to update the report and run both.'

beforeEach(() => resetAppStore({ reducedMotion: true }))

test('without the server the corrector says it is offline', async () => {
  await renderView({ health: async () => ({ ok: true, data: { corrector: false } }) })
  expect(corrector().getByText('The corrector is offline.')).toBeInTheDocument()
  expect(corrector().queryByRole('textbox')).not.toBeInTheDocument()
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
  const fallback = (await output().findByRole('textbox', { name: /press Ctrl\+C to copy it/ })) as HTMLTextAreaElement
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
