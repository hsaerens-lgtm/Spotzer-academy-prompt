import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { certificateFileName, fitNameSize, isValidName, makeCertificate, NAME_SIZE, NAME_WIDTH, UNSUPPORTED_NAME } from './certificate'

const font = (path: string) => new Uint8Array(readFileSync(path))
const fonts = {
  regular: font('node_modules/@fontsource/montserrat/files/montserrat-latin-400-normal.woff'),
  bold: font('node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff'),
  italic: font('node_modules/@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff'),
  boldExtended: font('node_modules/@fontsource/montserrat/files/montserrat-latin-ext-700-normal.woff'),
}

test('the certificate is one A4 landscape page carrying the name and score in its metadata', async () => {
  const bytes = await makeCertificate({ floor: 1, name: 'Zoë Martin-Dubois', score: 85, date: '2026-10-15', items: ['Tokens', 'Prompt'] }, fonts)
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
  const pdf = await PDFDocument.load(bytes)
  expect(pdf.getPageCount()).toBe(1)
  const { width, height } = pdf.getPage(0).getSize()
  expect(Math.round(width)).toBe(842)
  expect(Math.round(height)).toBe(595)
  expect(pdf.getTitle()).toBe('Athena Prompt Academy · Certificate of completion')
  expect(pdf.getSubject()).toBe('Zoë Martin-Dubois · 85/100 · 15 October 2026')
})

test('the expert certificate has its own title and file name', async () => {
  const pdf = await PDFDocument.load(await makeCertificate({ floor: 2, name: 'Sam', score: 64, date: '2026-10-16', items: ['Security'] }, fonts))
  expect(pdf.getTitle()).toBe('Athena Prompt Academy · Expert certificate')
  expect(certificateFileName(1)).toBe('athena-prompt-academy-certificate.pdf')
  expect(certificateFileName(2)).toBe('athena-prompt-academy-expert-certificate.pdf')
})

test('names: letters, spaces, apostrophes and hyphens, 1 to 60 characters', () => {
  for (const ok of ['Zoë', "Seán O'Brien", 'Anne-Marie de la Tour', '  Sam  ']) expect(isValidName(ok), ok).toBe(true)
  for (const bad of ['', '   ', 'a'.repeat(61), 'R2D2', '<b>Bob</b>', 'Bob!', "-Bob", "Bob'"]) expect(isValidName(bad), bad).toBe(false)
})

test('a name with Central European letters prints with the extended Latin font', async () => {
  const pdf = await PDFDocument.load(await makeCertificate({ floor: 1, name: 'Łukasz Dvořák', score: 90, date: '2026-10-15', items: ['Tokens'] }, fonts))
  expect(pdf.getSubject()).toBe('Łukasz Dvořák · 90/100 · 15 October 2026')
})

test('a name the certificate fonts cannot print is refused, not printed blank', async () => {
  await expect(makeCertificate({ floor: 1, name: '山田', score: 90, date: '2026-10-15', items: ['Tokens'] }, fonts)).rejects.toThrow(UNSUPPORTED_NAME)
})

test('without the extended Latin font, a Central European name is refused rather than printed with gaps', async () => {
  const { boldExtended: _unused, ...basic } = fonts
  await expect(makeCertificate({ floor: 1, name: 'Łukasz', score: 90, date: '2026-10-15', items: ['Tokens'] }, basic)).rejects.toThrow(UNSUPPORTED_NAME)
})

// Final review, finding 2: the name shrinks to fit the frame, down to the widest 60-letter name the form accepts.
test('a long name shrinks to fit inside the frame', async () => {
  const { PDFDocument } = await import('pdf-lib')
  const { default: fontkit } = await import('@pdf-lib/fontkit')
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const bold = await pdf.embedFont(fonts.bold)
  for (const name of ['Jean-Baptiste Emmanuel Zorg-Delacroix', 'Maximiliana Wilhelmina Hohenzollern-Sigmaringen de la Tour', 'W'.repeat(60)]) {
    const size = fitNameSize(bold.widthOfTextAtSize(name, NAME_SIZE), NAME_WIDTH)
    expect(bold.widthOfTextAtSize(name, size), name).toBeLessThanOrEqual(NAME_WIDTH + 0.01)
  }
  expect(fitNameSize(bold.widthOfTextAtSize('Sam', NAME_SIZE), NAME_WIDTH)).toBe(NAME_SIZE)
  // And the whole certificate still comes out for the longest names.
  await expect(makeCertificate({ floor: 1, name: 'W'.repeat(60), score: 90, date: '2026-10-15', items: ['Tokens'] }, fonts)).resolves.toBeInstanceOf(Uint8Array)
})

// Deferred minor: a typographic apostrophe (autocorrect, copy-paste) is an apostrophe.
test('a typographic apostrophe is accepted and printed', async () => {
  expect(isValidName('Seán O’Brien')).toBe(true)
  const pdf = await PDFDocument.load(await makeCertificate({ floor: 1, name: 'Seán O’Brien', score: 90, date: '2026-10-15', items: ['Tokens'] }, fonts))
  expect(pdf.getSubject()).toBe("Seán O'Brien · 90/100 · 15 October 2026")
})
