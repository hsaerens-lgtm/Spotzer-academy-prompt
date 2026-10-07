import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../../../core/store'
import { resetAppStore } from '../../../test/resetAppStore'
import { MISSION_IDS, makeWorkshopStore } from '../../../test/workshopStore'
import { WorkshopStoreProvider } from '../store'
import { MyPromptsWindow } from './MyPromptsWindow'

function renderWindow() {
  render(
    <WorkshopStoreProvider value={makeWorkshopStore()}>
      <MyPromptsWindow />
    </WorkshopStoreProvider>,
  )
  return screen.getByRole('region', { name: 'MY_PROMPTS.TXT' })
}

beforeEach(() => resetAppStore())
afterEach(() => {
  delete (navigator as { clipboard?: Clipboard }).clipboard
})

test('shows a hint when nothing is saved yet', () => {
  const panel = renderWindow()
  expect(within(panel).getByText('Your passed prompts will appear here. Finish a mission to save one.')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Clear my prompts' })).not.toBeInTheDocument()
})

test('lists passed prompts in mission order and copies one', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  appStore.getState().passWorkshopMission('newsletter', 'Prompt N', MISSION_IDS)
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  const panel = renderWindow()
  expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['The delayed website', 'The too-long newsletter'])
  await userEvent.click(within(panel).getAllByRole('button', { name: 'Copy' })[1])
  expect(writeText).toHaveBeenCalledWith('Prompt N')
  expect(within(panel).getByRole('button', { name: 'Copied' })).toBeInTheDocument()
})

test('clearing asks first and keeps the passed missions', async () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  const panel = renderWindow()
  await userEvent.click(within(panel).getByRole('button', { name: 'Clear my prompts' }))
  expect(within(panel).getByText('Clear every saved prompt? Your passed missions stay ticked.')).toBeInTheDocument()
  await userEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
  expect(appStore.getState().progress.workshop?.prompts).toEqual({ 'delayed-website': 'Prompt D' })
  await userEvent.click(within(panel).getByRole('button', { name: 'Clear my prompts' }))
  await userEvent.click(within(panel).getByRole('button', { name: 'Yes, clear' }))
  expect(appStore.getState().progress.workshop).toEqual({ passed: ['delayed-website'], prompts: {} })
  expect(within(panel).getByText(/Finish a mission to save one/)).toBeInTheDocument()
})

test('the focus follows the confirmation: Cancel on open, Clear after Cancel, the hint after the clear', async () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  const panel = renderWindow()
  expect(document.body).toHaveFocus()
  await userEvent.click(within(panel).getByRole('button', { name: 'Clear my prompts' }))
  expect(within(panel).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  expect(within(panel).getByRole('button', { name: 'Cancel' })).toHaveAccessibleDescription('Clear every saved prompt? Your passed missions stay ticked.')
  await userEvent.click(within(panel).getByRole('button', { name: 'Cancel' }))
  expect(within(panel).getByRole('button', { name: 'Clear my prompts' })).toHaveFocus()
  await userEvent.click(within(panel).getByRole('button', { name: 'Clear my prompts' }))
  await userEvent.click(within(panel).getByRole('button', { name: 'Yes, clear' }))
  expect(within(panel).getByText(/Finish a mission to save one/)).toHaveFocus()
})

test('a mission id that is not in the content is ignored', () => {
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  appStore.getState().passWorkshopMission('retired-mission', 'Prompt R', MISSION_IDS)
  const panel = renderWindow()
  expect(within(panel).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['The delayed website'])
  expect(within(panel).queryByText('Prompt R')).not.toBeInTheDocument()
})

test('Copied goes to the prompt copied last', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  appStore.getState().passWorkshopMission('newsletter', 'Prompt N', MISSION_IDS)
  const panel = renderWindow()
  await userEvent.click(within(panel).getAllByRole('button', { name: 'Copy' })[0])
  expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['Copied', 'Copy', 'Clear my prompts'])
  await userEvent.click(within(panel).getAllByRole('button', { name: 'Copy' })[0])
  expect(within(panel).getAllByRole('button').map((b) => b.textContent)).toEqual(['Copy', 'Copied', 'Clear my prompts'])
})

test('when the clipboard refuses, the prompt is shown selected with the Ctrl+C hint', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  appStore.getState().passWorkshopMission('newsletter', 'Prompt N', MISSION_IDS)
  const panel = renderWindow()
  await userEvent.click(within(panel).getAllByRole('button', { name: 'Copy' })[1])
  const field = (await within(panel).findByRole('textbox', { name: /press Ctrl\+C to copy it/ })) as HTMLTextAreaElement
  expect(field).toHaveValue('Prompt N')
  expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'Prompt N'.length])
  expect(within(panel).getByText('Prompt D')).toBeInTheDocument()
  expect(within(panel).queryByRole('button', { name: 'Copied' })).not.toBeInTheDocument()
})

test('clearing drops Copied, so a prompt saved later is not already copied', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  const panel = renderWindow()
  await userEvent.click(within(panel).getByRole('button', { name: 'Copy' }))
  await userEvent.click(within(panel).getByRole('button', { name: 'Clear my prompts' }))
  await userEvent.click(within(panel).getByRole('button', { name: 'Yes, clear' }))
  act(() => appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS))
  expect(within(panel).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
})

test('a prompt that changes after it was copied is no longer marked Copied', async () => {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true })
  appStore.getState().passWorkshopMission('delayed-website', 'Prompt D', MISSION_IDS)
  const panel = renderWindow()
  await userEvent.click(within(panel).getByRole('button', { name: 'Copy' }))
  expect(within(panel).getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  act(() => appStore.getState().passWorkshopMission('delayed-website', 'Prompt D, better', MISSION_IDS))
  expect(within(panel).getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  expect(within(panel).getByText('Prompt D, better')).toBeInTheDocument()
})
