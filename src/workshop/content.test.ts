import { makeBlocksFile, makeMission } from '../test/workshopFixtures'
import { buildWorkshopContent, getWorkshopContent, suggestedMission, workshopLanguages } from './content'
import { blockResult, evaluate } from './engine/evaluate'
import { BONUS_BLOCKS, WORKSHOP_MISSION_COUNT } from './model'

const content = getWorkshopContent('en')

test('English workshop content has no issues', () => {
  expect(workshopLanguages).toContain('en')
  expect(content.issues).toEqual([])
})

test('the six missions come in the agreed order, levels and modes', () => {
  expect(content.missions.map((m) => [m.id, m.level, m.mode])).toEqual([
    ['delayed-website', 1, 'blocks'],
    ['meeting-notes', 1, 'blocks'],
    ['florist-post', 2, 'free'],
    ['support-hours', 2, 'free'],
    ['plumber-services', 3, 'fix'],
    ['newsletter', 3, 'fix'],
  ])
  expect(content.missions).toHaveLength(WORKSHOP_MISSION_COUNT)
})

test('block labels come from blocks.json', () => {
  expect(content.labels).toEqual({ role: 'Role', task: 'Task', context: 'Context', format: 'Format', example: 'Example', constraint: 'Constraint' })
})

const samples = content.missions.flatMap((mission) => mission.samples.map((sample, index) => ({ mission, sample, index })))

test.each(samples)('$mission.id sample $index gives "$sample.expect"', ({ mission, sample }) => {
  expect(evaluate(mission, sample.input).tier).toBe(sample.expect)
})

test.each(content.missions)('$id has a sample for every tier and one with a bonus block', (mission) => {
  expect(new Set(mission.samples.map((s) => s.expect))).toEqual(new Set(['vague', 'passable', 'excellent']))
  const withBonus = mission.samples.some((sample) => {
    const evaluation = evaluate(mission, sample.input)
    return BONUS_BLOCKS.some((type) => blockResult(evaluation, type).present)
  })
  expect(withBonus).toBe(true)
})

test.each(content.missions.filter((m) => m.mode === 'fix'))('$id starts from a vague prompt', (mission) => {
  expect(evaluate(mission, { mode: 'fix', text: mission.starter! }).tier).toBe('vague')
})

test('the suggested mission is the first one not passed yet, in order', () => {
  expect(suggestedMission(content, []).id).toBe('delayed-website')
  expect(suggestedMission(content, ['delayed-website', 'florist-post']).id).toBe('meeting-notes')
  expect(suggestedMission(content, content.missions.map((m) => m.id)).id).toBe('delayed-website')
})

describe('validation', () => {
  const build = (missions: Record<string, unknown>, index: unknown = Object.keys(missions).map((id) => ({ id, level: 1 }))) =>
    buildWorkshopContent('xx', makeBlocksFile(), index, missions)

  it('reports a file whose id does not match its name', () => {
    expect(build({ other: makeMission() }).issues).toContainEqual({ path: 'xx/workshop/missions/other.json', message: 'id "test-mission" does not match file name "other"' })
  })

  it('reports a mode that does not match the level', () => {
    const issues = build({ 'test-mission': makeMission({ mode: 'free' }) }).issues
    expect(issues.map((i) => i.message)).toContain('level 1 missions use mode "blocks", not "free"')
  })

  it('needs a starter in fix mode and only there', () => {
    const fix = build({ 'test-mission': makeMission({ level: 3, mode: 'fix' }) }, [{ id: 'test-mission', level: 3 }]).issues
    expect(fix.map((i) => i.message)).toContain('fix missions need a starter prompt')
    const blocks = build({ 'test-mission': makeMission({ starter: 'Write a page.' }) }).issues
    expect(blocks.map((i) => i.message)).toContain('only fix missions have a starter prompt')
  })

  it('needs unique detail ids and conflicts on structural blocks', () => {
    const mission = makeMission()
    mission.blocks.task.details[0].id = 'client'
    mission.conflicts[0].block = 'example'
    const messages = build({ 'test-mission': mission }).issues.map((i) => i.message)
    expect(messages).toContain('detail id "client" is used more than once')
    expect(messages).toContain('conflict "length-clash" must be on role, task, context or format')
  })

  it('reports missions missing from the index and index entries without a file', () => {
    const messages = build({ 'test-mission': makeMission() }, [{ id: 'ghost', level: 1 }]).issues.map((i) => i.message)
    expect(messages).toContain('mission "ghost" is listed but has no valid file')
    expect(messages).toContain('mission "test-mission" is not listed in missions.json')
  })

  it('reports a level that differs from the index', () => {
    const messages = build({ 'test-mission': makeMission() }, [{ id: 'test-mission', level: 2 }]).issues.map((i) => i.message)
    expect(messages).toContain('mission "test-mission" is level 1 but listed as level 2')
  })
})

test('an unknown language falls back to English', () => {
  expect(getWorkshopContent('xx').lang).toBe('en')
})
