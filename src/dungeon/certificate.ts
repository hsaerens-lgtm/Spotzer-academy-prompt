import type { Floor } from './model'

export interface CertificateInput {
  floor: Floor
  name: string
  score: number
  /** ISO date (YYYY-MM-DD) of the best pass. */
  date: string
  /** The 13 topics or the 5 domains covered. */
  items: string[]
}
export interface CertificateFonts {
  regular: Uint8Array
  bold: Uint8Array
  italic: Uint8Array
  /** Montserrat Bold's Latin Extended file: the letters of names like Łukasz or Dvořák. */
  boldExtended?: Uint8Array
}
/** Thrown when the name holds letters neither bold font can print (it would come out blank). */
export const UNSUPPORTED_NAME = 'unsupported-name'
/** The name's size, and the width it may take: the page inside the frame, with a margin. */
export const NAME_SIZE = 40
export const NAME_WIDTH = 760
/**
 * The size that fits a name drawn `widthAtFull` wide at NAME_SIZE into `maxWidth`: never larger than NAME_SIZE, and
 * small enough for the widest name the form accepts (60 W's still fit at about 11 points).
 */
export const fitNameSize = (widthAtFull: number, maxWidth: number) => Math.min(NAME_SIZE, (NAME_SIZE * maxWidth) / widthAtFull)

const NAME = /^\p{L}(?:[\p{L} '-]*\p{L})?$/u
/** Letters, spaces, apostrophes and hyphens; starts and ends with a letter; 60 characters at most once trimmed. */
export const isValidName = (name: string) => name.trim().length <= 60 && NAME.test(name.trim())
export const certificateFileName = (floor: Floor) =>
  floor === 1 ? 'athena-prompt-academy-certificate.pdf' : 'athena-prompt-academy-expert-certificate.pdf'
const TITLE = { 1: 'Certificate of completion', 2: 'Expert certificate' } as const
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** The charter's fonts, from the @fontsource files the site already ships (fetched only when a PDF is made). */
async function browserFonts(): Promise<CertificateFonts> {
  const urls = await Promise.all([
    import('@fontsource/montserrat/files/montserrat-latin-400-normal.woff?url'),
    import('@fontsource/montserrat/files/montserrat-latin-700-normal.woff?url'),
    import('@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff?url'),
    import('@fontsource/montserrat/files/montserrat-latin-ext-700-normal.woff?url'),
  ])
  const [regular, bold, italic, boldExtended] = await Promise.all(
    urls.map(async ({ default: url }) => new Uint8Array(await (await fetch(url)).arrayBuffer())),
  )
  return { regular, bold, italic, boldExtended }
}

/** Spec 3, §3.9 and §4.8: A4 landscape, Athena colours, pdf-lib loaded on demand. The name goes nowhere else. */
export async function makeCertificate(input: CertificateInput, fonts?: CertificateFonts): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, { default: fontkit }] = await Promise.all([import('pdf-lib'), import('@pdf-lib/fontkit')])
  const files = fonts ?? (await browserFonts())
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const [regular, bold, italic] = await Promise.all([files.regular, files.bold, files.italic].map((file) => pdf.embedFont(file, { subset: true })))
  const extended = files.boldExtended ? await pdf.embedFont(files.boldExtended, { subset: true }) : null
  // The name, run by run: each letter in the first bold font that has it. A letter neither has would print blank.
  const name = input.name.trim()
  const fontFor = (char: string) => [bold, extended].find((font) => font?.getCharacterSet().includes(char.codePointAt(0)!)) ?? null
  const runs: { text: string; font: typeof bold }[] = []
  for (const char of name) {
    const font = fontFor(char)
    if (!font) throw new Error(UNSUPPORTED_NAME)
    const last = runs[runs.length - 1]
    if (last?.font === font) last.text += char
    else runs.push({ text: char, font })
  }
  const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
  const ink = hex('#0B0D0E')
  const lime = hex('#58FC73')
  const mint = hex('#4DDBB8')
  const onDark = hex('#F4F6F5')
  const muted = hex('#9AA3A8')
  const page = pdf.addPage([841.89, 595.28])
  const { width, height } = page.getSize()
  const date = longDate(input.date)
  const title = TITLE[input.floor]
  pdf.setTitle(`Athena Prompt Academy · ${title}`)
  pdf.setSubject(`${name} · ${input.score}/100 · ${date}`)
  pdf.setCreator('Athena Prompt Academy')
  pdf.setProducer('Athena Prompt Academy')

  page.drawRectangle({ x: 0, y: 0, width, height, color: ink })
  page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: lime, borderWidth: 3 })
  // The Athena cubes, as on the site's logo: mint and white on top, two lime below.
  const cube = 14
  const cubes: [number, number, ReturnType<typeof rgb>][] = [
    [0, 1, mint],
    [1, 1, onDark],
    [0, 0, lime],
    [1, 0, lime],
  ]
  for (const [cx, cy, color] of cubes) page.drawRectangle({ x: 64 + cx * (cube + 3), y: height - 96 + cy * (cube + 3), width: cube, height: cube, color })
  page.drawText('ATHENA PROMPT ACADEMY', { x: 108, y: height - 82, size: 12, font: bold, color: onDark })

  const centre = (text: string, y: number, size: number, font: typeof regular, color = onDark) =>
    page.drawText(text, { x: (width - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color })
  centre(title.toUpperCase(), height - 170, 30, bold, lime)
  centre('This certifies that', height - 215, 13, regular, muted)
  const runsWidth = (size: number) => runs.reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.text, size), 0)
  const nameSize = fitNameSize(runsWidth(NAME_SIZE), NAME_WIDTH)
  let x = (width - runsWidth(nameSize)) / 2
  for (const run of runs) {
    page.drawText(run.text, { x, y: height - 268, size: nameSize, font: run.font, color: onDark })
    x += run.font.widthOfTextAtSize(run.text, nameSize)
  }
  centre('has braved the dungeon of the Athena Prompt Academy', height - 305, 18, italic, mint)
  centre(`Score ${input.score}/100 · ${date}`, height - 345, 14, regular)
  const lines: string[] = []
  let line = ''
  for (const word of input.items.join(' · ').split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (regular.widthOfTextAtSize(next, 10) > width - 200) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  lines.forEach((text, i) => centre(text, height - 385 - i * 15, 10, regular, muted))
  centre('Self-assessed internal training, not an official qualification', 48, 9, regular, muted)
  return pdf.save()
}

/** Hands the file to the browser's downloads; the object URL is dropped right after. */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
