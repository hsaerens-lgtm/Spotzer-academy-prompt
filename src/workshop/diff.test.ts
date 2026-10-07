import { diffWords } from './diff'

test('marks the words added by the improved prompt', () => {
  expect(diffWords('Write a post', 'Write a short post')).toEqual([
    { text: 'Write a ', added: false },
    { text: 'short ', added: true },
    { text: 'post', added: false },
  ])
})

test('ignores case when matching, keeps the new text', () => {
  expect(diffWords('write a post', 'Write a post.')).toEqual([
    { text: 'Write a ', added: false },
    { text: 'post.', added: true },
  ])
})

test('everything is new when the original is empty', () => {
  expect(diffWords('', 'You are a writer.')).toEqual([{ text: 'You are a writer.', added: true }])
})
