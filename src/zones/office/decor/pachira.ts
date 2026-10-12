/**
 * The money tree of the back corner: the clay planter scaled up, the tree scaled to its height and standing on the planter's
 * soil line. `offset` (x, z) moves the tree after its model was centred on its whole box, leaves included, so that its
 * trunk base stands on the planter's axis. `soil` is the dark disc the trunk is seated in: its top is the soil line.
 */
export const PACHIRA = {
  potScale: 1.6,
  height: 1.55,
  base: 0.325,
  offset: [0.02, 0.189],
  soil: { radius: 0.16, thickness: 0.04 },
} as const
