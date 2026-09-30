import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'
import { brand, brandCssVars } from './brand'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const tokensCssPath = resolve(__dirname, '../brand/oe-tokens.css')
const athenaCssPath = resolve(__dirname, '../brand/athena.css')

const tokensCss = readFileSync(tokensCssPath, 'utf-8')
const athenaCss = readFileSync(athenaCssPath, 'utf-8')
const css = tokensCss + athenaCss

function cssHex(variable: string): string | undefined {
  const match = css.match(new RegExp(`${variable}:\\s*(#[0-9A-Fa-f]{6})`))
  return match?.[1]?.toUpperCase()
}

describe('brand colours', () => {
  it.each(Object.entries(brandCssVars))('%s mirrors %s', (key, variable) => {
    expect(cssHex(variable)).toBe(brand[key as keyof typeof brand].toUpperCase())
  })
})
