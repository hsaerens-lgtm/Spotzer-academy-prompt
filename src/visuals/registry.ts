import type { ComponentType } from 'react'
import type { VisualId } from './manifest'
import type { VisualProps } from './parts'
import { Agents } from './topics/Agents'
import { AiSafetyAtWork } from './topics/AiSafetyAtWork'
import { ContextWindow } from './topics/ContextWindow'
import { GenerativeAi } from './topics/GenerativeAi'
import { Hallucinations } from './topics/Hallucinations'
import { Llm } from './topics/Llm'
import { Mcp } from './topics/Mcp'
import { Multimodal } from './topics/Multimodal'
import { Prompt } from './topics/Prompt'
import { Skills } from './topics/Skills'
import { Tokens } from './topics/Tokens'
import { Tools } from './topics/Tools'
import { WhatIsAi } from './topics/WhatIsAi'

export const visualComponents: Record<VisualId, ComponentType<VisualProps>> = {
  'what-is-ai': WhatIsAi,
  'generative-ai': GenerativeAi,
  llm: Llm,
  tokens: Tokens,
  'context-window': ContextWindow,
  hallucinations: Hallucinations,
  prompt: Prompt,
  multimodal: Multimodal,
  agents: Agents,
  tools: Tools,
  skills: Skills,
  mcp: Mcp,
  'ai-safety-at-work': AiSafetyAtWork,
}
