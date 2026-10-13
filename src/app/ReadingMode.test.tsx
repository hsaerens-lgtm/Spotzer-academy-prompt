import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { MISSION_IDS } from '../test/workshopStore'
import { Hud } from '../ui/Hud'
import { App } from './App'
import { ZoneOverlayHost } from './ZoneOverlayHost'

async function renderApp() {
  await act(async () => {
    render(<App />)
  })
}

test('without WebGL, the office opens in reading mode with the same content', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  expect(screen.getByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  expect(screen.getByTestId('screen-content').querySelector('.vz--what-is-ai')).not.toBeNull()
  expect(screen.getByRole('button', { name: 'Click or press Space to continue' })).toBeInTheDocument()
})

// The CC BY 3D models of the office are credited in the site, in reading mode (public/assets/CREDITS.md lists every file).
test('reading mode credits the 3D models', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  expect(screen.getByText(/3D models: .* CC BY 4\.0/)).toBeInTheDocument()
})

// The announcer is mounted by <App /> for the office overlay and reading mode alike: it exists before any topic opens.
test("Ada's lines are announced by one live region that existed before the topic opened", async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  const regions = () => Array.from(document.querySelectorAll('[aria-live="polite"]'))
  const region = regions()[0]
  expect(region).toBeEmptyDOMElement()
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  expect(regions()[0]).toBe(region)
  expect(region).toHaveTextContent(getContent('en').topicById.get('what-is-ai')!.basics[0].say)
  expect(regions().filter((el) => el.textContent)).toHaveLength(1)
})

test('explains that 3D stopped working', async () => {
  resetAppStore({ webgl: 'unavailable', webglLost: true, readingMode: true })
  await renderApp()
  expect(screen.getByText(/3D stopped working/)).toHaveAttribute('role', 'status')
})

test('manual reading mode hides the 3D stage even with WebGL available', async () => {
  resetAppStore({ readingMode: true })
  await renderApp()
  expect(screen.queryByTestId('stage')).not.toBeInTheDocument()
  expect(screen.getByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
})

test('zone buttons fade to the workshop and the dungeon', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  await userEvent.click(screen.getByRole('button', { name: 'Prompt workshop' }))
  expect(appStore.getState().transition).toEqual({ to: 'workshop', via: null, stage: 'fade' })
})

// The same label as the welcome bar's button: the passed missions that still exist, once there is one.
test('the workshop button counts the passed missions, as in the office', async () => {
  resetAppStore({ webgl: 'unavailable' })
  const progress = appStore.getState().progress
  appStore.setState({ progress: { ...progress, workshop: { passed: ['retired-mission'], prompts: {} } } })
  await renderApp()
  const main = within(screen.getByRole('main', { name: 'Reading mode' }))
  expect(main.getByRole('button', { name: 'Prompt workshop' })).toBeInTheDocument()
  act(() => appStore.getState().passWorkshopMission('delayed-website', 'Prompt', MISSION_IDS))
  expect(main.getByRole('button', { name: 'Prompt workshop · 1/6' })).toBeInTheDocument()
})

// The expanded view sits outside the scrolling <main> so it stays fixed over the page, like in the 3D office.
test('renders the expanded view outside the scrolling reading area', async () => {
  resetAppStore({ webgl: 'unavailable' })
  await renderApp()
  await userEvent.click(screen.getByRole('button', { name: /What is AI\?/ }))
  act(() => appStore.getState().setExpandOpen(true))
  const dialog = screen.getByRole('dialog', { name: 'Expand' })
  expect(screen.getByRole('main', { name: 'Reading mode' }).contains(dialog)).toBe(false)
  expect(dialog.closest('.overlay')).not.toBeNull()
})

// Hud + ZoneOverlayHost only: leaving reading mode would mount the R3F Canvas inside <App />, which jsdom cannot run.
test('the HUD toggle round-trips between reading mode and 3D', async () => {
  resetAppStore()
  render(
    <>
      <Hud />
      <ZoneOverlayHost />
    </>,
  )
  expect(screen.queryByRole('main', { name: 'Reading mode' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reading mode' }))
  expect(appStore.getState().readingMode).toBe(true)
  expect(screen.getByRole('main', { name: 'Reading mode' })).toBeInTheDocument()
  expect(screen.queryByText(/3D stopped working/)).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '3D mode' }))
  expect(appStore.getState().readingMode).toBe(false)
  expect(appStore.getState().webgl).toBe('ok')
  expect(screen.queryByRole('main', { name: 'Reading mode' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reading mode' })).toBeInTheDocument()
})
