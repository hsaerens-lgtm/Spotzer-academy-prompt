import { brand } from '../../core/brand'

export function OfficeScene() {
  return (
    <>
      <color attach="background" args={[brand.ink]} />
      <ambientLight intensity={0.6} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[10, 12]} />
        <meshStandardMaterial color={brand.surface2} />
      </mesh>
    </>
  )
}
