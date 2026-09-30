import { createSound, installSoundUnlock, shouldBlip } from './sound'

class FakeParam {
  value = 0
  setValueAtTime() {
    return this
  }
  exponentialRampToValueAtTime() {
    return this
  }
}
class FakeNode {
  connect<T>(node: T) {
    return node
  }
  disconnect() {}
}
class FakeOscillator extends FakeNode {
  type = 'sine'
  frequency = new FakeParam()
  start = vi.fn()
  stop = vi.fn()
}
class FakeGain extends FakeNode {
  gain = new FakeParam()
}
class FakeFilter extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam()
}
class FakeSource extends FakeNode {
  buffer: unknown = null
  loop = false
  start = vi.fn()
  stop = vi.fn()
}
class FakeContext {
  currentTime = 0
  sampleRate = 8000
  destination = new FakeNode()
  oscillators: FakeOscillator[] = []
  sources: FakeSource[] = []
  createOscillator() {
    const oscillator = new FakeOscillator()
    this.oscillators.push(oscillator)
    return oscillator
  }
  createGain() {
    return new FakeGain()
  }
  createBiquadFilter() {
    return new FakeFilter()
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) }
  }
  createBufferSource() {
    const source = new FakeSource()
    this.sources.push(source)
    return source
  }
  resume() {
    return Promise.resolve()
  }
}

let created: FakeContext[] = []
const Ctor = class extends FakeContext {
  constructor() {
    super()
    created.push(this)
  }
} as unknown as typeof AudioContext

beforeEach(() => {
  created = []
})

test('blips on every other letter or digit, never on spaces or punctuation', () => {
  expect(shouldBlip('a', 0)).toBe(true)
  expect(shouldBlip('a', 1)).toBe(false)
  expect(shouldBlip('7', 2)).toBe(true)
  expect(shouldBlip(' ', 0)).toBe(false)
  expect(shouldBlip('.', 0)).toBe(false)
})

test('stays silent until the first user gesture, then starts the ambience', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.blip('a', 0)
  expect(created).toHaveLength(0)
  engine.unlock()
  expect(engine.unlocked).toBe(true)
  expect(created[0].sources).toHaveLength(1)
  expect(created[0].sources[0].loop).toBe(true)
  engine.blip('a', 0)
  expect(created[0].oscillators).toHaveLength(1)
})

test('does not stack blips at the same instant', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.unlock()
  engine.blip('a', 0)
  engine.blip('b', 2)
  expect(created[0].oscillators).toHaveLength(1)
  created[0].currentTime = 0.1
  engine.blip('c', 4)
  expect(created[0].oscillators).toHaveLength(2)
})

test('muting stops the ambience and the blips; unmuting restarts the ambience', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.unlock()
  engine.setEnabled(false)
  expect(created[0].sources[0].stop).toHaveBeenCalled()
  engine.blip('a', 0)
  expect(created[0].oscillators).toHaveLength(0)
  engine.setEnabled(true)
  expect(created[0].sources).toHaveLength(2)
})

test('a muted engine does not start the ambience on unlock', () => {
  const engine = createSound(Ctor, () => 0.5)
  engine.setEnabled(false)
  engine.unlock()
  expect(created[0].sources).toHaveLength(0)
})

test('works without Web Audio', () => {
  const engine = createSound(undefined)
  expect(() => {
    engine.unlock()
    engine.blip('a', 0)
    engine.setEnabled(false)
  }).not.toThrow()
  expect(engine.unlocked).toBe(false)
})

test('the first pointer or key press unlocks the audio once', () => {
  const engine = { unlocked: false, unlock: vi.fn(), setEnabled: vi.fn(), blip: vi.fn() }
  installSoundUnlock(engine)
  window.dispatchEvent(new Event('pointerdown'))
  window.dispatchEvent(new Event('keydown'))
  expect(engine.unlock).toHaveBeenCalledTimes(1)
})
