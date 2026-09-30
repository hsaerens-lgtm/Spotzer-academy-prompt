import { useGLTF } from '@react-three/drei'
import { useMemo, type ComponentType } from 'react'
import { Cabinet } from './props/Cabinet'
import { Chair } from './props/Chair'
import { CrtTv } from './props/CrtTv'
import { Lamp } from './props/Lamp'
import { Laptop } from './props/Laptop'
import { LogoCubes } from './props/LogoCubes'
import { Microphone } from './props/Microphone'
import { RetroConsole } from './props/RetroConsole'
import { Sideboard } from './props/Sideboard'
import { Sofa } from './props/Sofa'
import { Table } from './props/Table'
import type { ObjectProps } from './types'

export type ObjectName =
  | 'table'
  | 'chair'
  | 'sideboard'
  | 'cabinet'
  | 'laptop'
  | 'crtTv'
  | 'retroConsole'
  | 'sofa'
  | 'logoCubes'
  | 'lamp'
  | 'microphone'

/**
 * Declare a GLB in /public/models to replace an object's procedural version, e.g. { sofa: '/models/sofa.glb' }.
 * The model must share the procedural origin (floor level, centred) and orientation (front = +z), in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {}

const procedural: Record<ObjectName, ComponentType<ObjectProps>> = {
  table: Table,
  chair: Chair,
  sideboard: Sideboard,
  cabinet: Cabinet,
  laptop: Laptop,
  crtTv: CrtTv,
  retroConsole: RetroConsole,
  sofa: Sofa,
  logoCubes: LogoCubes,
  lamp: Lamp,
  microphone: Microphone,
}

export type ObjectSource = { kind: 'procedural' } | { kind: 'glb'; url: string }

export function resolveObject(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): ObjectSource {
  const url = models[name]
  return url ? { kind: 'glb', url } : { kind: 'procedural' }
}

function GltfObject({ url, ...props }: ObjectProps & { url: string }) {
  const { scene } = useGLTF(url)
  const clone = useMemo(() => scene.clone(true), [scene])
  return (
    <group {...props}>
      <primitive object={clone} />
    </group>
  )
}

export function SceneObject({ object, ...props }: ObjectProps & { object: ObjectName }) {
  const source = resolveObject(object)
  if (source.kind === 'glb') return <GltfObject url={source.url} {...props} />
  const Procedural = procedural[object]
  return <Procedural {...props} />
}
