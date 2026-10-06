import { memoryStorage } from '../test/memoryStorage'
import {
  PROGRESS_KEY,
  SETTINGS_KEY,
  defaultSettings,
  emptyProgress,
  loadProgress,
  loadSettings,
  markSeen,
  saveProgress,
  saveSettings,
  withMissionPassed,
  withoutWorkshopPrompts,
  workshopProgress,
} from './progress'

describe('progress', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage()
    const progress = { ...emptyProgress(), topicsSeen: ['tokens'], firstVisitDone: true }
    expect(saveProgress(progress, storage)).toBe(true)
    expect(JSON.parse(storage.data.get(PROGRESS_KEY)!)).toEqual(progress)
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('returns empty progress without storage', () => {
    expect(loadProgress(null)).toEqual(emptyProgress())
    expect(saveProgress(emptyProgress(), null)).toBe(false)
  })

  it('returns empty progress for corrupted or unknown data', () => {
    const storage = memoryStorage()
    storage.setItem(PROGRESS_KEY, '{not json')
    expect(loadProgress(storage)).toEqual(emptyProgress())
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), version: 2 }))
    expect(loadProgress(storage)).toEqual(emptyProgress())
    storage.setItem(PROGRESS_KEY, JSON.stringify({ topicsSeen: 'tokens' }))
    expect(loadProgress(storage)).toEqual(emptyProgress())
  })

  // Review focus 1: blocked or throwing storage must never break the site.
  it('survives a storage whose methods throw', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadProgress(throwing)).toEqual(emptyProgress())
    expect(saveProgress(emptyProgress(), throwing)).toBe(false)
  })

  it('survives window.localStorage itself throwing', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('SecurityError')
      },
    })
    try {
      expect(loadProgress()).toEqual(emptyProgress())
      expect(saveProgress(emptyProgress())).toBe(false)
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original)
      else delete (window as { localStorage?: Storage }).localStorage
    }
  })

  it('marks sections as seen once', () => {
    const once = markSeen(emptyProgress(), 'tokens', 'basics')
    expect(once.topicsSeen).toEqual(['tokens'])
    expect(markSeen(once, 'tokens', 'basics')).toBe(once)
    expect(markSeen(once, 'tokens', 'deeper').deeperSeen).toEqual(['tokens'])
  })
})

describe('workshop progress', () => {
  // Review focus 5: progress written by the office version has no workshop key.
  it('progress from the office version still loads', () => {
    const storage = memoryStorage()
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), topicsSeen: ['tokens'] }))
    const progress = loadProgress(storage)
    expect(progress.topicsSeen).toEqual(['tokens'])
    expect(workshopProgress(progress)).toEqual({ passed: [], prompts: {} })
  })

  it('records a passed mission and its prompt, and flags the workshop done at the total', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', 2)
    expect(one.workshop).toEqual({ passed: ['a'], prompts: { a: 'Prompt A' } })
    expect(one.workshopDone).toBe(false)
    const two = withMissionPassed(one, 'b', 'Prompt B', 2)
    expect(two.workshopDone).toBe(true)
  })

  it('passing the same mission with the same prompt changes nothing; a new prompt replaces the old one', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', 6)
    expect(withMissionPassed(one, 'a', 'Prompt A', 6)).toBe(one)
    expect(withMissionPassed(one, 'a', 'Better A', 6).workshop).toEqual({ passed: ['a'], prompts: { a: 'Better A' } })
  })

  it('clearing prompts keeps the passed missions', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', 6)
    expect(withoutWorkshopPrompts(one).workshop).toEqual({ passed: ['a'], prompts: {} })
    const empty = emptyProgress()
    expect(withoutWorkshopPrompts(empty)).toBe(empty)
  })
})

describe('settings', () => {
  it('round-trips and falls back to defaults', () => {
    const storage = memoryStorage()
    expect(loadSettings(storage)).toEqual(defaultSettings())
    saveSettings({ sound: false, lang: 'en' }, storage)
    expect(loadSettings(storage)).toEqual({ sound: false, lang: 'en' })
    storage.setItem(SETTINGS_KEY, '"broken"')
    expect(loadSettings(storage)).toEqual(defaultSettings())
  })
})
