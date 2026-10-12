import { useGLTF } from '@react-three/drei'
import { createPortal } from '@react-three/fiber'
import { Fragment, useLayoutEffect, useMemo, type ComponentType } from 'react'
import type { Object3D } from 'three'
import { cloneModel, meshesOf, normaliseModel, prepareModel, scaleToHeight } from './gltf'
import { HoverOutline } from './interactive'
import { CrtTv } from './props/CrtTv'
import { FloorLamp } from './props/FloorLamp'
import { Lamp } from './props/Lamp'
import { Laptop } from './props/Laptop'
import { LogoCubes } from './props/LogoCubes'
import { Microphone } from './props/Microphone'
import { RetroConsole } from './props/RetroConsole'
import { Shelves } from './props/Shelves'
import { Sideboard } from './props/Sideboard'
import { Sofa } from './props/Sofa'
import { Table } from './props/Table'
import { TvStand } from './props/TvStand'
import type { ObjectProps } from './types'

export type ObjectName =
  | 'table' | 'laptop' | 'retroConsole' | 'sofa' | 'logoCubes' | 'lamp' | 'microphone' // procedural (existing)
  | 'tvStand' | 'shelves' // procedural, Task 10
  | 'floorLamp' // procedural, Task 10b
  | 'sideboard' | 'crtTv' // procedural until Task 11, then GLB

/** Every object name, in the order of the union (objects.test.ts checks that they match). */
export const OBJECT_NAMES = [
  'table', 'laptop', 'retroConsole', 'sofa', 'logoCubes', 'lamp', 'microphone',
  'tvStand', 'shelves',
  'floorLamp',
  'sideboard', 'crtTv',
] as const satisfies readonly ObjectName[]

/**
 * CC0 models that draw an object instead of its procedural version: public/assets/models/<asset id>.glb, declared in
 * scripts/assets/manifest.json and src/three/assets.ts (MODELS), always through modelUrl() (publicUrl, no leading '/').
 * A model is normalised on load (standing on y = 0, centred on x and z); its front must face +z, in metres.
 */
export const glbModels: Partial<Record<ObjectName, string>> = {}

const procedural: Partial<Record<ObjectName, ComponentType<ObjectProps>>> = {
  table: Table,
  laptop: Laptop,
  retroConsole: RetroConsole,
  sofa: Sofa,
  logoCubes: LogoCubes,
  lamp: Lamp,
  microphone: Microphone,
  tvStand: TvStand,
  shelves: Shelves,
  floorLamp: FloorLamp,
  sideboard: Sideboard,
  crtTv: CrtTv,
}

export interface ModelProps extends ObjectProps {
  /** Lime hover outline on every mesh of a model (interactive models, inside an <Interactive>). */
  outline?: boolean
  /** Scale the model uniformly to this height, in metres, before normalising it. */
  height?: number
  /** Called once per placed copy, after preparation: the place to find named nodes and materials. */
  onModel?: (root: Object3D) => void
}

export type ObjectSource = { kind: 'procedural' } | { kind: 'glb'; url: string }

export function resolveObject(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): ObjectSource {
  const url = models[name]
  return url ? { kind: 'glb', url } : { kind: 'procedural' }
}

/** A declared model or a procedural component can draw the object. */
export function hasSource(name: ObjectName, models: Partial<Record<ObjectName, string>> = glbModels): boolean {
  return Boolean(models[name]) || procedural[name] !== undefined
}

function GltfObject({ url, outline = false, height, onModel, ...props }: ModelProps & { url: string }) {
  // Draco off, drei's built-in meshopt decoder on: nothing is fetched from a CDN.
  const { scene } = useGLTF(url, false, true)
  const root = useMemo(() => {
    const copy = cloneModel(scene)
    prepareModel(copy)
    if (height) scaleToHeight(copy, height)
    normaliseModel(copy)
    return copy
  }, [scene, height])
  // Once per copy, on purpose: a new onModel function on a later render does not run again.
  useLayoutEffect(() => {
    onModel?.(root)
  }, [root])
  const meshes = useMemo(() => (outline ? meshesOf(root) : []), [outline, root])
  return (
    <group {...props}>
      <primitive object={root} />
      {meshes.map((mesh) => (
        <Fragment key={mesh.uuid}>{createPortal(<HoverOutline />, mesh)}</Fragment>
      ))}
    </group>
  )
}

export function SceneObject({ object, outline, height, onModel, ...props }: ModelProps & { object: ObjectName }) {
  const source = resolveObject(object)
  if (source.kind === 'glb') return <GltfObject url={source.url} outline={outline} height={height} onModel={onModel} {...props} />
  const Procedural = procedural[object]
  if (!Procedural) throw new Error(`Nothing draws "${object}": declare its model in glbModels.`)
  return <Procedural {...props} />
}
