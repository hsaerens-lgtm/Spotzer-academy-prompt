import { act, render } from '@testing-library/react'
import { getContent } from '../content/load'
import { appStore } from '../core/store'
import { resetAppStore } from '../test/resetAppStore'
import { DialogueAnnouncer } from './DialogueAnnouncer'
import { DialogueBox } from './DialogueBox'

const topic = getContent('en').topicById.get('what-is-ai')!
const liveRegions = () => Array.from(document.querySelectorAll('[aria-live="polite"]'))

beforeEach(() => resetAppStore())

// Spec 8.5: a live region that is created together with its text is not announced, so it must exist beforehand.
test('the live region exists and is empty before a topic opens', () => {
  render(<DialogueAnnouncer />)
  expect(liveRegions()).toHaveLength(1)
  expect(liveRegions()[0]).toHaveClass('sr-only')
  expect(liveRegions()[0]).toBeEmptyDOMElement()
})

test('the same region then carries the first line, and the next one after advancing', () => {
  render(<DialogueAnnouncer />)
  const region = liveRegions()[0]
  act(() => appStore.getState().openTopic('what-is-ai'))
  expect(liveRegions()[0]).toBe(region)
  expect(region).toHaveTextContent(topic.basics[0].say)
  act(() => {
    appStore.getState().finishTyping()
    appStore.getState().advanceDialogue()
  })
  expect(region).toHaveTextContent(topic.basics[1].say)
  expect(region).not.toHaveTextContent(topic.basics[0].say)
})

test('goes back to empty when the topic closes or the office is left', () => {
  render(<DialogueAnnouncer />)
  act(() => appStore.getState().openTopic('what-is-ai'))
  act(() => appStore.getState().closeTopic())
  expect(liveRegions()[0]).toBeEmptyDOMElement()
  act(() => appStore.getState().openTopic('what-is-ai'))
  expect(liveRegions()[0]).toHaveTextContent(topic.basics[0].say)
  act(() => appStore.setState({ zone: 'workshop' }))
  expect(liveRegions()[0]).toBeEmptyDOMElement()
})

test('exactly one polite region carries dialogue text, the dialogue box adds none', () => {
  act(() => appStore.getState().openTopic('what-is-ai'))
  render(
    <>
      <DialogueAnnouncer />
      <DialogueBox />
    </>,
  )
  const withDialogue = liveRegions().filter((region) => region.textContent?.includes(topic.basics[0].say))
  expect(withDialogue).toHaveLength(1)
  expect(document.querySelector('.dialogue [aria-live]')).toBeNull()
})
