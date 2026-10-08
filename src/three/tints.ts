import { brand } from '../core/brand'

/** Material tints that are not brand colours. Brand colours come from core/brand.ts only. */
export const tints = {
  floor: '#c8a27a', wall: '#b9ad9c', ceiling: '#e6e0d6', skirting: '#8f8577', slats: '#c99a68', oak: '#d2a878', walnut: '#a8774f',
  chairFabric: '#7d7368', sofaFabric: brand.blueGrey, cushion: brand.lime, rug: '#b8aa96',
  blackMetal: '#2a2b2d', brushedMetal: '#b9bcc0', consoleShell: '#c9c6bd', consoleDark: '#3a3d40',
  porcelain: brand.onDark, visor: brand.nearBlack, glass: '#dfe8ee', warmLight: '#ffd29a', diffuser: '#857a6b', diffuserGlow: '#b8a58a', posterPaper: '#f1ece2',
  leafGreens: ['#30552c', '#3b6136', '#274525', '#446d3b', '#213d21', '#365730'], stem: '#4a6b3a', soil: '#241c15',
  potGlazes: { terracotta: '#a5613f', cream: '#d8cdb8', slate: '#555b5e', brass: '#8a6a34' },
  potDots: { terracotta: ['#7a3a1f', '#d88a5f', '#5a2a14'], cream: ['#8a857a', '#b8b2a6', '#5c574f'], slate: ['#2a2b2d', '#6d7275', '#3f4447'], brass: ['#5e4520', '#b08a4a', '#3d2c12'] },
  hangingGlazes: { white: '#ece8df', terracotta: '#b8663f', sage: '#8fa38c', charcoal: '#3a3b3d' },
  cord: '#dccdb0',
  bookCovers: ['#1f3b57', '#6b1f1f', '#2f4f3a', '#c9962b', '#ece6d8', '#2b2b2d', '#1f5e63', '#b4552d', '#d8cbb0', '#4f5d6b', '#d9b44a', '#c98f8f', '#f5f2ea', '#394a2c', '#7d3c5a', '#223a70', '#e24a2f', '#0f0f10', '#6d8a9c', '#a7b59a', '#5a3a22', '#8c1c1c', '#e9e2cf'],
  bookInks: ['#e8d9b0', '#e2c27a', '#e6d49c', '#1f1f1f', '#2a2a2a', '#d9c089', '#f1ead8', '#f6eee0', '#3a2f24', '#f0ebe0', '#2a2419', '#2e2020', '#b3462d', '#e3cf8e', '#f3e7ef', '#f2c14e', '#ffffff', '#15212a', '#2c3526', '#e8c98a', '#f0d9a0', '#1d3b5a'],
  bookPages: ['#efe6d2', '#e4d8bd', '#d8c9a8'],
  city: {
    brick: ['#9a5a44', '#8a4e3a', '#a8664c', '#7e4a3a', '#c9a36a', '#94604a'],
    glass: ['#3a4550', '#2e3a44', '#55606a', '#44505a'],
    concrete: ['#b8b4ac', '#a9a59e', '#c6c1b8', '#9d9a94'],
    plaster: ['#e8e0d0', '#f0ead8', '#d9cdb5', '#e6d6c0', '#d8dcd6'],
    roofUnit: '#9a9da0', waterTank: '#6d5a48', grass: '#6a8a4a', paving: '#8f8a82', asphalt: '#3a3c3f', gravel: '#c2b59c',
    trunk: '#5a4a3c', kerb: '#b8b3aa', hedge: '#3f5f32', laneMark: '#dedbd2', lampPole: '#2a2c2e', lampGlow: '#ffc47a',
    carBodies: ['#2c3e50', '#c0392b', '#ecf0f1', '#7f8c8d', '#1e1e1e', '#2e86c1', '#d4ac0d'], carCabin: '#1c2228',
    headlight: '#fff4dc', taillight: '#ff2a1a', bird: '#2a2c30',
  },
} as const
