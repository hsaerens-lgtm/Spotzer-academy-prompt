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
