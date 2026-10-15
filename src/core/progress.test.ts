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
  withDungeonPassed,
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

  // A broken workshop part (hand-edited, or written by a buggy version) costs the workshop part only, never the office's.
  it('a malformed workshop value is dropped, and the rest of the progress kept', () => {
    const storage = memoryStorage()
    const saved = { ...emptyProgress(), topicsSeen: ['tokens'], deeperSeen: ['llm'], firstVisitDone: true }
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...saved, workshop: 42 }))
    const progress = loadProgress(storage)
    expect(progress).toEqual(saved)
    expect(progress.workshop).toBeUndefined()
    expect(workshopProgress(progress)).toEqual({ passed: [], prompts: {} })
    // Saved again, the broken value is gone.
    saveProgress(progress, storage)
    expect(JSON.parse(storage.getItem(PROGRESS_KEY)!)).toEqual(saved)
  })

  it('records a passed mission and its prompt, and flags the workshop done once every known mission is passed', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', ['a', 'b'])
    expect(one.workshop).toEqual({ passed: ['a'], prompts: { a: 'Prompt A' } })
    expect(one.workshopDone).toBe(false)
    const two = withMissionPassed(one, 'b', 'Prompt B', ['a', 'b'])
    expect(two.workshopDone).toBe(true)
  })

  // Spec 4.6: a mission removed or renamed since leaves its id in the saved progress. It must never count towards
  // workshopDone, a flag that is saved for good and that the dungeon (sub-project 3) relies on.
  it('an unknown id in the saved progress never counts towards the workshop being done', () => {
    const known = ['a', 'b', 'c', 'd', 'e', 'f']
    const storage = memoryStorage()
    const saved = { ...emptyProgress(), workshop: { passed: ['retired-mission'], prompts: { 'retired-mission': 'Old' } } }
    storage.setItem(PROGRESS_KEY, JSON.stringify(saved))
    let progress = loadProgress(storage)
    for (const id of known.slice(0, 5)) progress = withMissionPassed(progress, id, `Prompt ${id}`, known)
    expect(progress.workshop?.passed).toHaveLength(6)
    expect(progress.workshopDone).toBe(false)
    progress = withMissionPassed(progress, 'f', 'Prompt f', known)
    expect(progress.workshopDone).toBe(true)
  })

  it('without any known mission the workshop is never done', () => {
    expect(withMissionPassed(emptyProgress(), 'a', 'Prompt A', []).workshopDone).toBe(false)
  })

  it('passing the same mission with the same prompt changes nothing; a new prompt replaces the old one', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', ['a', 'b'])
    expect(withMissionPassed(one, 'a', 'Prompt A', ['a', 'b'])).toBe(one)
    expect(withMissionPassed(one, 'a', 'Better A', ['a', 'b']).workshop).toEqual({ passed: ['a'], prompts: { a: 'Better A' } })
  })

  it('clearing prompts keeps the passed missions', () => {
    const one = withMissionPassed(emptyProgress(), 'a', 'Prompt A', ['a', 'b'])
    expect(withoutWorkshopPrompts(one).workshop).toEqual({ passed: ['a'], prompts: {} })
    const empty = emptyProgress()
    expect(withoutWorkshopPrompts(empty)).toBe(empty)
  })
})

describe('dungeon progress', () => {
  const stored = (dungeon: unknown) => {
    const storage = memoryStorage()
    storage.setItem(PROGRESS_KEY, JSON.stringify({ ...emptyProgress(), dungeon }))
    return storage
  }
  it('loads a dungeon saved before the expert floor', () => {
    expect(loadProgress(stored({ passed: true, bestScore: 80 })).dungeon).toEqual({ passed: true, bestScore: 80 })
  })
  it('drops a malformed expert result alone', () => {
    expect(loadProgress(stored({ passed: true, bestScore: 80, expert: { passed: 'yes' } })).dungeon).toEqual({ passed: true, bestScore: 80 })
  })
  it('keeps the best floor 1 score and the date it was made', () => {
    const first = withDungeonPassed(emptyProgress(), 1, 70, '2026-10-15')
    expect(first.dungeon).toEqual({ passed: true, bestScore: 70, passedAt: '2026-10-15', expert: null })
    const lower = withDungeonPassed(first, 1, 60, '2026-10-16')
    expect(lower.dungeon).toEqual({ passed: true, bestScore: 70, passedAt: '2026-10-15', expert: null })
    const higher = withDungeonPassed(lower, 1, 95, '2026-10-17')
    expect(higher.dungeon).toEqual({ passed: true, bestScore: 95, passedAt: '2026-10-17', expert: null })
  })
  it('records the expert floor only after floor 1', () => {
    const none = withDungeonPassed(emptyProgress(), 2, 90, '2026-10-15')
    expect(none.dungeon).toBeNull()
    const passed = withDungeonPassed(withDungeonPassed(emptyProgress(), 1, 70, '2026-10-15'), 2, 64, '2026-10-16')
    expect(passed.dungeon?.expert).toEqual({ passed: true, bestScore: 64, passedAt: '2026-10-16' })
    expect(passed.dungeon?.bestScore).toBe(70)
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
