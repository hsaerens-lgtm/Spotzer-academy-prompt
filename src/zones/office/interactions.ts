import { appStore, type HoverTarget } from '../../core/store'

/** What each clickable object does. Shared by 3D clicks and the dev test API. */
export const objectActions: Record<HoverTarget, () => void> = {
  laptop: () => appStore.getState().requestZone('workshop', 'laptop'),
  tv: () => appStore.getState().requestZone('dungeon', 'tv'),
  ada: () => appStore.getState().pokeAda(),
  clock: () => appStore.getState().advancePhase(),
}

/** i18n key of the tooltip shown next to the pointer while an object is hovered. */
export const labelKey = {
  laptop: 'objects.laptop',
  tv: 'objects.tv',
  ada: 'objects.ada',
  clock: 'objects.clock',
} as const satisfies Record<HoverTarget, string>
