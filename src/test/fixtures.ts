import type { Topic } from '../content/schema'

export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: 'alpha',
    chapter: 'basics',
    title: 'Alpha',
    teaser: 'The first test topic',
    reviewed: '2026-09-29',
    basics: [
      { say: 'Basics one.', mood: 'happy', gesture: 'pointScreen', screen: 'what-is-ai:1' },
      { say: 'Basics two.' },
      { say: 'Basics three.', screen: 'what-is-ai:2' },
    ],
    deeper: [{ say: 'Deeper one.' }, { say: 'Deeper two.', screen: 'what-is-ai:4' }],
    takeaway: 'Alpha in one line.',
    next: null,
    ...overrides,
  }
}
