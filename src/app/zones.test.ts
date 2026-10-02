import { createZoneLoader, type ZoneModule } from './zones'

const workshopModule: ZoneModule = { id: 'workshop' }
const dungeonModule: ZoneModule = { id: 'dungeon' }

function setup(workshop: () => Promise<ZoneModule>) {
  const dungeon = vi.fn(() => Promise.resolve(dungeonModule))
  return { load: createZoneLoader({ workshop, dungeon }), dungeon }
}

test('a zone is imported once and then served from the cache', async () => {
  const workshop = vi.fn(() => Promise.resolve(workshopModule))
  const { load } = setup(workshop)
  const first = load('workshop')
  expect(load('workshop')).toBe(first)
  await expect(first).resolves.toBe(workshopModule)
  expect(workshop).toHaveBeenCalledTimes(1)
})

// A stale tab after a redeploy: the chunk is gone. The failure must not stay cached forever.
test('a failed import is dropped from the cache, so the next attempt retries', async () => {
  const workshop = vi
    .fn<() => Promise<ZoneModule>>()
    .mockRejectedValueOnce(new Error('Failed to fetch dynamically imported module'))
    .mockResolvedValue(workshopModule)
  const { load } = setup(workshop)
  await expect(load('workshop')).rejects.toThrow('Failed to fetch')
  const retry = load('workshop')
  await expect(retry).resolves.toBe(workshopModule)
  expect(workshop).toHaveBeenCalledTimes(2)
  // The successful retry is cached like any other import.
  expect(load('workshop')).toBe(retry)
  expect(workshop).toHaveBeenCalledTimes(2)
})

test('a late failure never evicts a newer cache entry, and other zones are unaffected', async () => {
  const workshop = vi
    .fn<() => Promise<ZoneModule>>()
    .mockRejectedValueOnce(new Error('boom'))
    .mockResolvedValue(workshopModule)
  const { load, dungeon } = setup(workshop)
  await expect(load('workshop')).rejects.toThrow('boom')
  const retry = load('workshop')
  await Promise.resolve()
  expect(load('workshop')).toBe(retry)
  await load('dungeon')
  expect(dungeon).toHaveBeenCalledTimes(1)
})
