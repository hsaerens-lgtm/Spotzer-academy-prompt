import type { ComponentType } from 'react'
import type { VisualId } from './manifest'
import type { VisualProps } from './parts'
import { GenerativeAi } from './topics/GenerativeAi'
import { Llm } from './topics/Llm'
import { Tokens } from './topics/Tokens'
import { WhatIsAi } from './topics/WhatIsAi'

export const visualComponents: Partial<Record<VisualId, ComponentType<VisualProps>>> = {
  'what-is-ai': WhatIsAi,
  'generative-ai': GenerativeAi,
  llm: Llm,
  tokens: Tokens,
}
