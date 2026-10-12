/**
 * The money tree of the back corner: the clay planter scaled up, the tree scaled to its height and standing on the planter's
 * soil line. `offset` (x, z) moves the tree after its model was centred on its whole box, leaves included, so that its
 * trunk base stands on the planter's axis, which is the origin of the planter's group (pachira.test.ts measures both in
 * the frame of the scene). `soil` is the potting soil the trunk is seated in (soil.ts): its edge, `radius`, goes into the
 * clay wall, which at the soil line is 0.186 to 0.196 m from the axis and 1.2 cm thick at least; its middle rises `dome`
 * above the soil line, which is where the trunk stands.
 */
export const PACHIRA = {
  potScale: 1.6,
  height: 1.55,
  base: 0.325,
  offset: [0.0151, 0.1952],
  soil: { radius: 0.195, dome: 0.004, bump: 0.0015, drop: 0.003, seed: 29 },
} as const
