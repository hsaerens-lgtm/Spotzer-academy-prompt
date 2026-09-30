/** Brand colours for three.js materials. Must mirror src/brand/*.css (see brand.test.ts). */
export const brand = {
  ink: '#0B0D0E',
  surface1: '#121517',
  surface2: '#181C1F',
  surface3: '#1F2429',
  lime: '#58FC73',
  limeHover: '#42E063',
  mint: '#4DDBB8',
  nearBlack: '#0E0E0F',
  blueGrey: '#2F4858',
  onDark: '#F4F6F5',
  warn: '#FF9500',
  danger: '#EF4444',
} as const

export type BrandColor = keyof typeof brand

export const brandCssVars = {
  ink: '--at-ink',
  surface1: '--at-surface-1',
  surface2: '--at-surface-2',
  surface3: '--at-surface-3',
  lime: '--oe-lime',
  limeHover: '--oe-lime-hover',
  mint: '--oe-lime-mint',
  nearBlack: '--oe-near-black',
  blueGrey: '--oe-blue-grey',
  onDark: '--at-on-dark',
  warn: '--oe-warn',
  danger: '--oe-danger',
} as const satisfies Record<BrandColor, string>
