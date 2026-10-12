import { useEffect, useMemo } from 'react'
import { booksMaterial, shelfBooksGeometry } from './shelfBooks'
import type { ShelfBooksSpec } from './plants/types'

/** One shelf of books in room coordinates: one merged mesh with the shared atlas material. */
export function Books({ spec, name }: { spec: ShelfBooksSpec; name?: string }) {
  const geometry = useMemo(() => shelfBooksGeometry(spec), [spec])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name={name} geometry={geometry} material={booksMaterial()} castShadow receiveShadow />
}
