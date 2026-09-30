export interface SoundEngine {
  readonly unlocked: boolean
  unlock(): void
  setEnabled(on: boolean): void
  blip(char: string, index: number): void
}

export const BASE_PITCH = 620
const MIN_GAP_SECONDS = 0.045

export function shouldBlip(char: string, index: number): boolean {
  return /[\p{L}\p{N}]/u.test(char) && index % 2 === 0
}

type AudioCtor = new () => AudioContext

/** Ada's voice: short synthesized blips, plus a very quiet room tone. No audio files. */
export function createSound(
  Ctor: AudioCtor | undefined = globalThis.AudioContext,
  rand: () => number = Math.random,
): SoundEngine {
  let ctx: AudioContext | null = null
  let enabled = true
  let ambience: AudioBufferSourceNode | null = null
  let lastBlip = -Infinity

  function startAmbience() {
    if (!ctx || ambience) return
    const length = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let last = 0
    for (let i = 0; i < length; i++) {
      last = (last + 0.02 * (rand() * 2 - 1)) / 1.02 // brown noise
      data[i] = last * 3.5
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420
    const gain = ctx.createGain()
    gain.gain.value = 0.035
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start()
    ambience = source
  }

  function stopAmbience() {
    ambience?.stop()
    ambience?.disconnect()
    ambience = null
  }

  return {
    get unlocked() {
      return ctx !== null
    },
    unlock() {
      if (ctx || !Ctor) return
      try {
        ctx = new Ctor()
      } catch {
        ctx = null
        return
      }
      if (enabled) startAmbience()
    },
    setEnabled(on) {
      enabled = on
      if (!ctx) return
      if (on) {
        void ctx.resume()
        startAmbience()
      } else stopAmbience()
    },
    blip(char, index) {
      if (!ctx || !enabled || !shouldBlip(char, index)) return
      const now = ctx.currentTime
      if (now - lastBlip < MIN_GAP_SECONDS) return
      lastBlip = now
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'square'
      oscillator.frequency.value = BASE_PITCH * (0.9 + rand() * 0.25)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(now)
      oscillator.stop(now + 0.07)
    },
  }
}

export const sound = createSound()

/** Browsers only allow audio after a user gesture: unlock on the first pointer or key press. */
export function installSoundUnlock(engine: SoundEngine, win: Window = window) {
  const handler = () => {
    engine.unlock()
    win.removeEventListener('pointerdown', handler)
    win.removeEventListener('keydown', handler)
  }
  win.addEventListener('pointerdown', handler)
  win.addEventListener('keydown', handler)
}
