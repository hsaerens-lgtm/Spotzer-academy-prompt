import { createContext, useContext } from 'react'
import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { DungeonContent, FloorContent } from '../../dungeon/content'
import type { Floor } from '../../dungeon/model'
import { ahead } from '../../dungeon/movement'
import { draw } from '../../dungeon/questions'
import { newSeed, seeded } from '../../dungeon/random'
import { isFloor } from '../../dungeon/map'
import { reduce, startRun, type RunEffect, type RunEvent, type RunState } from '../../dungeon/run'
import { localDay } from '../../dungeon/today'

export interface DungeonDeps {
  content: DungeonContent
  seed?: () => number
  /** Today as YYYY-MM-DD (the date of a pass). */
  today?: () => string
  onVictory: (floor: Floor, score: number, date: string) => void
  onEjected: (floor: Floor, missedTopics: string[]) => void
}
export interface DungeonState {
  content: DungeonContent
  run: RunState | null
  /** Cells the player has seen (minimap), as y * width + x. */
  seen: Set<number>
  view: '3d' | 'text'
  /** The last run effect, with a new id each time (the same effect twice is two events). */
  effect: { kind: RunEffect; id: number } | null
  announcement: { text: string; id: number } | null
  paused: boolean
  start: (floor: Floor, seed?: number) => void
  dispatch: (event: RunEvent) => void
  quit: () => void
  fallbackToText: () => void
  setPaused: (on: boolean) => void
  announce: (text: string) => void
}

export const floorOf = (s: Pick<DungeonState, 'content' | 'run'>): FloorContent => s.content.floors[s.run?.floor ?? 1]

/** The player's cell, its four neighbours and the two cells ahead (the second only past an open first): what a torch lights. */
function seenAround(floor: FloorContent, run: RunState, seen: Set<number>): Set<number> {
  const next = new Set(seen)
  const { map } = floor
  const mark = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < map.width && y < map.height) next.add(y * map.width + x)
  }
  mark(run.pose.x, run.pose.y)
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    mark(run.pose.x + dx, run.pose.y + dy)
  }
  const one = ahead(run.pose)
  mark(one.x, one.y)
  if (isFloor(map, one.x, one.y)) {
    const two = ahead({ ...run.pose, ...one })
    mark(two.x, two.y)
  }
  return next
}

let counter = 0

export function createDungeonStore(deps: DungeonDeps): StoreApi<DungeonState> {
  const today = deps.today ?? (() => localDay())
  return createStore<DungeonState>()((set, get) => ({
    content: deps.content,
    run: null,
    seen: new Set(),
    view: '3d',
    effect: null,
    announcement: null,
    paused: false,
    start: (floor, seed = deps.seed?.() ?? newSeed()) => {
      const content = get().content.floors[floor]
      const asked = draw(content.pools, content.guardians.length, seeded(seed))
      const run = startRun(floor, content.map, asked, seed)
      set({ run, seen: seenAround(content, run, new Set()), effect: null, paused: false })
    },
    dispatch: (event) => {
      const { run, seen } = get()
      if (!run) return
      const floor = floorOf(get())
      const { state, effect } = reduce(floor.map, run, event)
      if (state === run && !effect) return
      set({
        run: state,
        seen: state.pose === run.pose ? seen : seenAround(floor, state, seen),
        effect: effect ? { kind: effect, id: ++counter } : get().effect,
      })
      if (effect === 'victory') deps.onVictory(state.floor, state.score, today())
      if (effect === 'ejected') {
        const missed = state.answers
          .filter((a) => !a.correct)
          .map((a) => floor.guardians[a.guardian].topic)
          .filter((topic): topic is string => topic !== null)
        deps.onEjected(state.floor, missed)
      }
    },
    quit: () => set({ run: null, seen: new Set(), effect: null, paused: false }),
    fallbackToText: () => set({ view: 'text' }),
    setPaused: (on) => set({ paused: on }),
    announce: (text) => set({ announcement: { text, id: ++counter } }),
  }))
}

const DungeonStoreContext = createContext<StoreApi<DungeonState> | null>(null)
export const DungeonStoreProvider = DungeonStoreContext.Provider

export function useDungeonStore(): StoreApi<DungeonState> {
  const store = useContext(DungeonStoreContext)
  if (!store) throw new Error('useDungeonStore needs a DungeonStoreProvider')
  return store
}

export function useDungeon<T>(selector: (s: DungeonState) => T): T {
  return useStore(useDungeonStore(), selector)
}
