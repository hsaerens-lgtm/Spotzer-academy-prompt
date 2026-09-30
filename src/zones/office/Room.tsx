import { materials } from '../../three/materials'

export const ROOM = { width: 10, depth: 12, height: 3.2 }
const WINDOW = { centerZ: -2.0, centerY: 1.65, width: 3.4, height: 2.1 }

function LeftWall() {
  const m = materials()
  const { depth: D, height: H, width: W } = ROOM
  const x = -W / 2
  const bottom = WINDOW.centerY - WINDOW.height / 2
  const top = WINDOW.centerY + WINDOW.height / 2
  const zNear = WINDOW.centerZ - WINDOW.width / 2
  const zFar = WINDOW.centerZ + WINDOW.width / 2
  const pieces: { z: number; y: number; w: number; h: number }[] = [
    { z: 0, y: bottom / 2, w: D, h: bottom },
    { z: 0, y: (top + H) / 2, w: D, h: H - top },
    { z: (-D / 2 + zNear) / 2, y: WINDOW.centerY, w: zNear + D / 2, h: WINDOW.height },
    { z: (zFar + D / 2) / 2, y: WINDOW.centerY, w: D / 2 - zFar, h: WINDOW.height },
  ]
  return (
    <group>
      {pieces.map((piece, index) => (
        <mesh key={index} position={[x, piece.y, piece.z]} rotation-y={Math.PI / 2} material={m.wall} receiveShadow>
          <planeGeometry args={[piece.w, piece.h]} />
        </mesh>
      ))}
      <mesh position={[x - 0.05, WINDOW.centerY, WINDOW.centerZ]} rotation-y={Math.PI / 2} material={m.window}>
        <planeGeometry args={[WINDOW.width, WINDOW.height]} />
      </mesh>
      {[zNear, zFar].map((z) => (
        <mesh key={z} position={[x + 0.04, WINDOW.centerY, z]} material={m.darkWood}>
          <boxGeometry args={[0.08, WINDOW.height, 0.08]} />
        </mesh>
      ))}
      <mesh position={[x + 0.04, WINDOW.centerY, WINDOW.centerZ]} material={m.darkWood}>
        <boxGeometry args={[0.06, WINDOW.height, 0.05]} />
      </mesh>
      {[zNear - 0.3, zFar + 0.3].map((z) => (
        <mesh key={z} position={[x + 0.15, H / 2 - 0.1, z]} material={m.curtain} castShadow>
          <boxGeometry args={[0.12, H - 0.3, 0.7]} />
        </mesh>
      ))}
    </group>
  )
}

function CeilingCove() {
  const m = materials()
  const y = ROOM.height - 0.02
  const x0 = -3.6
  const x1 = 1.6
  const z0 = -5.2
  const z1 = 1.4
  const strips: { position: [number, number, number]; size: [number, number, number] }[] = [
    { position: [(x0 + x1) / 2, y, z0], size: [x1 - x0, 0.03, 0.05] },
    { position: [(x0 + x1) / 2, y, z1], size: [x1 - x0, 0.03, 0.05] },
    { position: [x0, y, (z0 + z1) / 2], size: [0.05, 0.03, z1 - z0] },
    { position: [x1, y, (z0 + z1) / 2], size: [0.05, 0.03, z1 - z0] },
  ]
  return (
    <group>
      {strips.map((strip, index) => (
        <mesh key={index} position={strip.position} material={m.warmGlow}>
          <boxGeometry args={strip.size} />
        </mesh>
      ))}
    </group>
  )
}

export function Room() {
  const m = materials()
  const { width: W, depth: D, height: H } = ROOM
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} material={m.floor} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[-1.0, 0.004, -1.8]} material={m.rug} receiveShadow>
        <planeGeometry args={[5.2, 7.4]} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-y={H} material={m.ceiling}>
        <planeGeometry args={[W, D]} />
      </mesh>
      <mesh position={[0, H / 2, -D / 2]} material={m.wall} receiveShadow>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[-1.0, 1.65, -D / 2 + 0.01]} material={m.wallPanel} receiveShadow>
        <planeGeometry args={[6.4, 3.0]} />
      </mesh>
      <mesh position={[0, H / 2, D / 2]} rotation-y={Math.PI} material={m.wall}>
        <planeGeometry args={[W, H]} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2} material={m.wall} receiveShadow>
        <planeGeometry args={[D, H]} />
      </mesh>
      <LeftWall />
      <CeilingCove />
    </group>
  )
}
