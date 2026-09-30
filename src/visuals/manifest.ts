/** Number of build-up steps of each wall-screen visual. Steps are numbered from 1. */
export const visualManifest = {
  'what-is-ai': { steps: 4 },
  'generative-ai': { steps: 3 },
  llm: { steps: 4 },
  tokens: { steps: 4 },
  'context-window': { steps: 3 },
  hallucinations: { steps: 3 },
  prompt: { steps: 4 },
  multimodal: { steps: 3 },
  agents: { steps: 4 },
  tools: { steps: 3 },
  skills: { steps: 3 },
  mcp: { steps: 3 },
  'ai-safety-at-work': { steps: 4 },
} as const satisfies Record<string, { steps: number }>

export type VisualId = keyof typeof visualManifest

export function isVisualId(id: string): id is VisualId {
  return Object.hasOwn(visualManifest, id)
}
