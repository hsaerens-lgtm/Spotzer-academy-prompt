import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { App } from './App'

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
