import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getDungeonContent } from '../../../dungeon/content'
import { createDungeonStore, DungeonStoreProvider } from '../store'
import { CertificateForm } from './CertificateForm'

const certificate = vi.hoisted(() => ({
  makeCertificate: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
  downloadPdf: vi.fn(),
}))
vi.mock('../../../dungeon/certificate', async (original) => ({ ...(await original<object>()), ...certificate }))

const renderForm = () => {
  const store = createDungeonStore({ content: getDungeonContent('en'), onVictory: vi.fn(), onEjected: vi.fn() })
  render(
    <DungeonStoreProvider value={store}>
      <CertificateForm floor={1} score={85} date="2026-10-15" />
    </DungeonStoreProvider>,
  )
}

beforeEach(() => {
  certificate.makeCertificate.mockClear()
  certificate.downloadPdf.mockClear()
})

test('an invalid name shows why, and makes nothing', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'R2D2')
  await user.click(screen.getByRole('button', { name: 'Download PDF' }))
  expect(screen.getByText('Use letters, spaces, apostrophes or hyphens (60 characters at most).')).toBeInTheDocument()
  expect(certificate.makeCertificate).not.toHaveBeenCalled()
})

test('a valid name makes the PDF with the floor items and downloads it', async () => {
  const user = userEvent.setup()
  renderForm()
  await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Zoë Martin')
  await user.click(screen.getByRole('button', { name: 'Download PDF' }))
  expect(certificate.makeCertificate).toHaveBeenCalledWith(expect.objectContaining({ floor: 1, name: 'Zoë Martin', score: 85, date: '2026-10-15' }))
  const [[input]] = certificate.makeCertificate.mock.calls as unknown as [[{ items: string[] }]]
  expect(input.items).toHaveLength(13)
  expect(certificate.downloadPdf).toHaveBeenCalledWith(expect.any(Uint8Array), 'athena-prompt-academy-certificate.pdf')
})

test('a failure says so and offers to try again', async () => {
  const user = userEvent.setup()
  certificate.makeCertificate.mockRejectedValueOnce(new Error('boom'))
  renderForm()
  await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Sam')
  await user.click(screen.getByRole('button', { name: 'Download PDF' }))
  expect(await screen.findByText('The certificate could not be created.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('a name the fonts cannot print gets its own message', async () => {
  const user = userEvent.setup()
  certificate.makeCertificate.mockRejectedValueOnce(new Error('unsupported-name'))
  renderForm()
  await user.type(screen.getByRole('textbox', { name: 'Your name' }), 'Sam')
  await user.click(screen.getByRole('button', { name: 'Download PDF' }))
  expect(await screen.findByText('Your name has letters this certificate cannot print yet. Please write it in Latin letters.')).toBeInTheDocument()
})
