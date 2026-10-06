// @vitest-environment node
import { findLeaks } from './leaks.ts'

test('finds a key, the key variable and the OpenAI address, nothing else', () => {
  expect(findLeaks('const k = "sk-abcdefghijklmnopqrstuvwx1234"')).toEqual(['an OpenAI key (sk-...)'])
  expect(findLeaks('process.env.OPENAI_API_KEY')).toEqual(['the OPENAI_API_KEY variable'])
  expect(findLeaks('fetch("https://api.openai.com/v1/responses")')).toEqual(['the OpenAI API address'])
  expect(findLeaks('a risk-free desk-lamp')).toEqual([])
})
