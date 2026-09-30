import { parseScreenRef, type Beat, type ScreenRef, type Topic } from '../content/schema'

export type Section = 'basics' | 'deeper'
export type Phase = 'typing' | 'waiting' | 'choices'

export interface DialogueState {
  topicId: string
  section: Section
  beatIndex: number
  phase: Phase
}

export interface SectionCompleted {
  topicId: string
  section: Section
}

export type Choice = { kind: 'deeper' } | { kind: 'next'; topicId: string } | { kind: 'all' }

const beatsOf = (topic: Topic, section: Section) => (section === 'basics' ? topic.basics : topic.deeper)

export function start(topic: Topic): DialogueState {
  return { topicId: topic.id, section: 'basics', beatIndex: 0, phase: 'typing' }
}

export function finishTyping(state: DialogueState): DialogueState {
  return state.phase === 'typing' ? { ...state, phase: 'waiting' } : state
}

export function advance(
  state: DialogueState,
  topic: Topic,
): { state: DialogueState; completed: SectionCompleted | null } {
  if (state.phase === 'typing') return { state: { ...state, phase: 'waiting' }, completed: null }
  if (state.phase === 'choices') return { state, completed: null }
  const beats = beatsOf(topic, state.section)
  if (state.beatIndex < beats.length - 1) {
    return { state: { ...state, beatIndex: state.beatIndex + 1, phase: 'typing' }, completed: null }
  }
  return { state: { ...state, phase: 'choices' }, completed: { topicId: topic.id, section: state.section } }
}

export function chooseDeeper(state: DialogueState, topic: Topic): DialogueState {
  if (state.phase !== 'choices' || state.section !== 'basics') return state
  return { topicId: topic.id, section: 'deeper', beatIndex: 0, phase: 'typing' }
}

export function currentBeat(state: DialogueState, topic: Topic): Beat {
  const beats = beatsOf(topic, state.section)
  return beats[Math.min(state.beatIndex, beats.length - 1)]
}

export function choicesFor(state: DialogueState, topic: Topic, knownTopicIds: ReadonlySet<string>): Choice[] {
  if (state.phase !== 'choices') return []
  const choices: Choice[] = []
  if (state.section === 'basics') choices.push({ kind: 'deeper' })
  if (topic.next && knownTopicIds.has(topic.next)) choices.push({ kind: 'next', topicId: topic.next })
  choices.push({ kind: 'all' })
  return choices
}

export function screenAt(state: DialogueState, topic: Topic): ScreenRef | null {
  const upto = (beats: Beat[]) => beats.slice(0, state.beatIndex + 1)
  const sequence = state.section === 'basics' ? upto(topic.basics) : [...topic.basics, ...upto(topic.deeper)]
  for (let i = sequence.length - 1; i >= 0; i--) {
    const screen = sequence[i].screen
    if (screen) return parseScreenRef(screen)
  }
  return null
}
