import { layout } from './layout'

export function Lights({ shadows = true }: { shadows?: boolean }) {
  const { hemisphere, key, fills, screenGlow } = layout.lights
  return (
    <>
      <hemisphereLight args={[hemisphere.sky, hemisphere.ground, hemisphere.intensity]} />
      <directionalLight
        position={key.position}
        intensity={key.intensity}
        color={key.color}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
      />
      {fills.map((fill, index) => (
        <pointLight key={index} position={fill.position} intensity={fill.intensity} distance={fill.distance} decay={2} color={fill.color} />
      ))}
      <pointLight position={screenGlow.position} intensity={screenGlow.intensity} distance={4} decay={2} color={screenGlow.color} />
    </>
  )
}
