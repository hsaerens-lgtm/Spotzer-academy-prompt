import type { z } from 'zod'
import { getContent } from '../content/load'
import { missionSchema } from '../workshop/model'
import { mapIssues, parseMap, type ParsedMap } from './map'
import {
  bossesSchema,
  DOMAINS,
  floor1Schema,
  floor2Schema,
  FLOOR2_GUARDIANS_PER_DOMAIN,
  mapsSchema,
  type BossFile,
  type Domain,
  type Floor,
  type Sprite,
  type Tint,
} from './model'
import type { Pool } from './questions'

export interface DungeonGuardian {
  name: string
  sprite: Sprite
  tint: Tint
  /** Said when the guardian is beaten: the topic's takeaway (floor 1) or its own line (floor 2). */
  line: string
  topic: string | null
  domain: Domain | null
}
export interface FloorContent {
  floor: Floor
  guardians: DungeonGuardian[]
  pools: Pool[]
  inscriptions: string[]
  map: ParsedMap
  boss: BossFile
  /** Floor 1: the 13 topic titles; floor 2: the 5 domain titles (certificate, review). */
  itemTitles: string[]
}
export interface DungeonContent {
  lang: string
  floors: Record<Floor, FloorContent>
}
export interface RawDungeon {
  floor1: unknown
  floor2: unknown
  bosses: unknown
  maps: unknown
}

const allFiles = import.meta.glob<unknown>('/content/*/dungeon/*.json', { eager: true, import: 'default' })

function parse<S extends z.ZodType>(schema: S, value: unknown, path: string): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) throw new Error(`${path}: ${result.error.message}`)
  return result.data
}

/** Builds and checks a language's dungeon. Content tests keep it valid; anything wrong throws, listing every issue. */
export function buildDungeonContent(lang: string, raw: RawDungeon, topics: ReadonlyMap<string, { title: string; takeaway: string }>): DungeonContent {
  const at = (name: string) => `${lang}/dungeon/${name}.json`
  const floor1 = parse(floor1Schema, raw.floor1, at('floor1'))
  const floor2 = parse(floor2Schema, raw.floor2, at('floor2'))
  const bosses = parse(bossesSchema, raw.bosses, at('bosses'))
  const maps = parse(mapsSchema, raw.maps, at('maps'))
  const issues: string[] = []
  for (const key of ['1', '2'] as const) {
    const parsed = missionSchema.safeParse(bosses[key].mission)
    if (!parsed.success) issues.push(`${at('bosses')} ${key}: ${parsed.error.message}`)
    if (bosses[key].mission.mode !== 'fix' || !bosses[key].mission.starter) issues.push(`${at('bosses')} ${key}: a boss is a fix mission with a starter`)
  }

  const guardians1: DungeonGuardian[] = floor1.guardians.map((g) => {
    const topic = topics.get(g.topic)
    if (!topic) issues.push(`${at('floor1')}: unknown topic "${g.topic}"`)
    return { name: g.name, sprite: g.sprite, tint: g.tint, line: topic?.takeaway ?? '', topic: g.topic, domain: null }
  })
  if (floor2.domains.map((d) => d.id).join() !== DOMAINS.join()) issues.push(`${at('floor2')}: domains must be ${DOMAINS.join(', ')}, in this order`)
  const guardians2: DungeonGuardian[] = floor2.domains.flatMap((d) =>
    d.guardians.map((g) => ({ name: g.name, sprite: g.sprite, tint: g.tint, line: g.line, topic: null, domain: d.id })),
  )

  const floorOf = (floor: Floor, guardians: DungeonGuardian[], pools: Pool[], inscriptions: string[], itemTitles: string[]): FloorContent => {
    const map = parseMap(maps[floor === 1 ? '1' : '2'])
    for (const issue of mapIssues(map, guardians.length)) issues.push(`${at('maps')} ${floor}: ${issue}`)
    if (map.inscriptions.length !== inscriptions.length) {
      issues.push(`${at('maps')} ${floor}: ${map.inscriptions.length} inscription walls for ${inscriptions.length} inscriptions`)
    }
    return { floor, guardians, pools, inscriptions, map, boss: bosses[floor === 1 ? '1' : '2'], itemTitles }
  }
  const floors: Record<Floor, FloorContent> = {
    1: floorOf(
      1,
      guardians1,
      floor1.guardians.map((g, i) => ({ questions: g.questions, guardians: [i] })),
      floor1.inscriptions,
      floor1.guardians.map((g) => topics.get(g.topic)?.title ?? g.topic),
    ),
    2: floorOf(
      2,
      guardians2,
      floor2.domains.map((d, i) => ({
        questions: d.questions,
        guardians: Array.from({ length: FLOOR2_GUARDIANS_PER_DOMAIN }, (_, j) => i * FLOOR2_GUARDIANS_PER_DOMAIN + j),
      })),
      floor2.inscriptions,
      floor2.domains.map((d) => d.title),
    ),
  }
  if (issues.length > 0) throw new Error(`Dungeon content issues:\n${issues.join('\n')}`)
  return { lang, floors }
}

const cache = new Map<string, DungeonContent>()

export function getDungeonContent(lang: string): DungeonContent {
  const resolved = Object.keys(allFiles).some((path) => path.startsWith(`/content/${lang}/dungeon/`)) ? lang : 'en'
  let content = cache.get(resolved)
  if (!content) {
    const file = (name: string) => allFiles[`/content/${resolved}/dungeon/${name}.json`]
    content = buildDungeonContent(
      resolved,
      { floor1: file('floor1'), floor2: file('floor2'), bosses: file('bosses'), maps: file('maps') },
      getContent(resolved).topicById,
    )
    cache.set(resolved, content)
  }
  return content
}
