import {
  BLOCK_TYPES,
  blocksFileSchema,
  isCoreBlock,
  missionIndexSchema,
  missionSchema,
  type BlockType,
  type BlocksFile,
  type Mission,
} from './model'

export interface WorkshopIssue {
  path: string
  message: string
}

export interface WorkshopContent {
  lang: string
  blocks: BlocksFile
  labels: Record<BlockType, string>
  /** In the suggested order of missions.json. */
  missions: Mission[]
  missionById: ReadonlyMap<string, Mission>
  issues: WorkshopIssue[]
}

const blockFiles = import.meta.glob<unknown>('/content/*/workshop/blocks.json', { eager: true, import: 'default' })
const indexFiles = import.meta.glob<unknown>('/content/*/workshop/missions.json', { eager: true, import: 'default' })
const missionFiles = import.meta.glob<unknown>('/content/*/workshop/missions/*.json', { eager: true, import: 'default' })

const langOf = (path: string) => path.split('/')[2]
const fileId = (path: string) => path.split('/').pop()!.replace(/\.json$/, '')
const MODE_FOR_LEVEL = { 1: 'blocks', 2: 'free', 3: 'fix' } as const

function fallbackBlocks(): BlocksFile {
  const info = (label: string) => ({ label, building: label, good: label, example: label })
  return {
    role: info('Role'),
    task: info('Task'),
    context: info('Context'),
    format: info('Format'),
    example: info('Example'),
    constraint: info('Constraint'),
  }
}

function missionIssues(mission: Mission): string[] {
  const messages: string[] = []
  const expectedMode = MODE_FOR_LEVEL[mission.level]
  if (mission.mode !== expectedMode) messages.push(`level ${mission.level} missions use mode "${expectedMode}", not "${mission.mode}"`)
  if (mission.mode === 'fix' && !mission.starter) messages.push('fix missions need a starter prompt')
  if (mission.mode !== 'fix' && mission.starter) messages.push('only fix missions have a starter prompt')
  const seen = new Set<string>()
  for (const type of BLOCK_TYPES) {
    for (const detail of mission.blocks[type].details) {
      if (seen.has(detail.id)) messages.push(`detail id "${detail.id}" is used more than once`)
      seen.add(detail.id)
    }
  }
  for (const conflict of mission.conflicts) {
    if (!isCoreBlock(conflict.block)) {
      messages.push(`conflict "${conflict.id}" must be on role, task, context or format`)
    }
  }
  return messages
}

export function buildWorkshopContent(
  lang: string,
  rawBlocks: unknown,
  rawIndex: unknown,
  rawMissions: Record<string, unknown>,
): WorkshopContent {
  const issues: WorkshopIssue[] = []
  const missionPath = (id: string) => `${lang}/workshop/missions/${id}.json`

  const parsedBlocks = blocksFileSchema.safeParse(rawBlocks)
  if (!parsedBlocks.success) issues.push({ path: `${lang}/workshop/blocks.json`, message: parsedBlocks.error.message })
  const blocks = parsedBlocks.success ? parsedBlocks.data : fallbackBlocks()

  const parsedIndex = missionIndexSchema.safeParse(rawIndex)
  if (!parsedIndex.success) issues.push({ path: `${lang}/workshop/missions.json`, message: parsedIndex.error.message })
  const index = parsedIndex.success ? parsedIndex.data : []

  const valid = new Map<string, Mission>()
  for (const [id, raw] of Object.entries(rawMissions)) {
    const parsed = missionSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push({ path: missionPath(id), message: parsed.error.message })
      continue
    }
    if (parsed.data.id !== id) {
      issues.push({ path: missionPath(id), message: `id "${parsed.data.id}" does not match file name "${id}"` })
      continue
    }
    const messages = missionIssues(parsed.data)
    for (const message of messages) issues.push({ path: missionPath(id), message })
    if (messages.length === 0) valid.set(id, parsed.data)
  }

  const missions: Mission[] = []
  for (const entry of index) {
    const mission = valid.get(entry.id)
    if (!mission) {
      if (!(entry.id in rawMissions)) issues.push({ path: `${lang}/workshop/missions.json`, message: `mission "${entry.id}" is listed but has no valid file` })
      continue
    }
    if (mission.level !== entry.level) {
      issues.push({ path: missionPath(entry.id), message: `mission "${entry.id}" is level ${mission.level} but listed as level ${entry.level}` })
    }
    missions.push(mission)
  }
  const listed = new Set(index.map((entry) => entry.id))
  for (const id of valid.keys()) {
    if (!listed.has(id)) issues.push({ path: missionPath(id), message: `mission "${id}" is not listed in missions.json` })
  }

  const labels = Object.fromEntries(BLOCK_TYPES.map((type) => [type, blocks[type].label])) as Record<BlockType, string>
  return { lang, blocks, labels, missions, missionById: new Map(missions.map((m) => [m.id, m])), issues }
}

export const workshopLanguages = [...new Set(Object.keys(indexFiles).map(langOf))].sort()

const cache = new Map<string, WorkshopContent>()

export function getWorkshopContent(lang: string): WorkshopContent {
  const resolved = workshopLanguages.includes(lang) ? lang : 'en'
  let content = cache.get(resolved)
  if (!content) {
    const rawMissions: Record<string, unknown> = {}
    for (const [path, raw] of Object.entries(missionFiles)) {
      if (langOf(path) === resolved) rawMissions[fileId(path)] = raw
    }
    content = buildWorkshopContent(
      resolved,
      blockFiles[`/content/${resolved}/workshop/blocks.json`],
      indexFiles[`/content/${resolved}/workshop/missions.json`],
      rawMissions,
    )
    cache.set(resolved, content)
  }
  return content
}

/** The first mission not passed yet, in the suggested order (the first one when all are passed). */
export function suggestedMission(content: WorkshopContent, passed: readonly string[]): Mission {
  return content.missions.find((mission) => !passed.includes(mission.id)) ?? content.missions[0]
}
