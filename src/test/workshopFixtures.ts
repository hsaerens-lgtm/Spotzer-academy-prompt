import type { BlocksFile, CorrectorReport, Mission } from '../workshop/model'

export function makeMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: 'test-mission',
    level: 1,
    mode: 'blocks',
    title: 'Test mission',
    situation: 'Martin is waiting for his website.',
    goal: 'Get the AI to write the email.',
    blocks: {
      role: {
        required: true,
        placeholder: 'e.g. An account manager',
        details: [{ id: 'role-job', label: 'Who the AI is', patterns: ['you are', 'act as', 'account manager'], hint: 'Give the AI a job.' }],
      },
      task: { required: true, details: [{ id: 'task-email', label: 'Write an email', patterns: ['email'], hint: 'Say what to write.' }] },
      context: {
        required: true,
        details: [
          { id: 'client', label: "The client's name", patterns: ['martin*'], hint: 'Name the client.' },
          { id: 'reason', label: "Why it's late", patterns: ['photo*'], hint: 'Say why it is late.' },
          { id: 'new-date', label: 'The new date', patterns: ['friday', 'next week'], hint: 'Give the new date.' },
        ],
      },
      format: {
        required: true,
        details: [
          { id: 'tone', label: 'The tone', patterns: ['friendly'], hint: 'Pick a tone.' },
          { id: 'length', label: 'The length', patterns: ['short', 'words'], hint: 'Say how long.' },
        ],
      },
      example: { required: false, details: [{ id: 'example', label: 'An example', patterns: ['for example', 'e.g.'], hint: 'Show an example.' }] },
      constraint: { required: false, details: [{ id: 'constraint', label: 'A rule', patterns: ["don't", 'avoid'], hint: 'Add a rule.' }] },
    },
    conflicts: [{ id: 'length-clash', block: 'format', a: ['short'], b: ['detailed'], explain: 'Short or detailed? Pick one.' }],
    answers: { vague: 'A vague answer.', passable: 'A passable answer.', excellent: 'An excellent answer.' },
    ada: { intro: 'Fill in the blocks.', success: 'It holds!', takeaway: 'Context matters.' },
    samples: [
      { input: { mode: 'blocks', blocks: { task: 'Write an email' } }, expect: 'vague' },
      { input: { mode: 'blocks', blocks: { role: 'You are an account manager', task: 'Write an email', context: 'Martin', format: 'Friendly' } }, expect: 'passable' },
      {
        input: {
          mode: 'blocks',
          blocks: { role: 'You are an account manager', task: 'Write an email', context: 'Martin, photos late, next Friday', format: 'Friendly, 100 words' },
        },
        expect: 'excellent',
      },
    ],
    reviewed: '2026-10-06',
    ...overrides,
  }
}

export function makeBlocksFile(): BlocksFile {
  const info = (label: string, building: string) => ({ label, building, good: `A good ${label} block.`, example: `${label} example.` })
  return {
    role: info('Role', 'the foundation'),
    task: info('Task', 'the ground floor'),
    context: info('Context', 'the upper floor'),
    format: info('Format', 'the roof'),
    example: info('Example', 'a pillar'),
    constraint: info('Constraint', 'the braces'),
  }
}

export function makeReport(overrides: Partial<CorrectorReport> = {}): CorrectorReport {
  return {
    score: 62,
    verdict: 'leans',
    summary: 'The building leans: the context floor is thin.',
    blocks: [
      { type: 'role', quality: 3, quote: 'You are a copywriter', good: 'A clear job.', missing: '' },
      { type: 'task', quality: 3, quote: 'Write a post', good: 'A clear task.', missing: '' },
      { type: 'context', quality: 1, quote: 'for a shop', good: 'Some context.', missing: 'Which shop, which offer?' },
      { type: 'format', quality: 2, quote: 'short', good: 'A length.', missing: 'No tone.' },
      { type: 'example', quality: 0, quote: null, good: '', missing: 'No example.' },
      { type: 'constraint', quality: 0, quote: null, good: '', missing: 'No rule.' },
    ],
    conflicts: [],
    improvedPrompt: 'You are a copywriter. Write a short, warm post for Rosa\'s Flowers about 15% off bouquets until Sunday.',
    changes: ['Named the shop', 'Added the offer', 'Added a tone'],
    ...overrides,
  }
}
