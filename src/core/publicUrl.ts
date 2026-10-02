/**
 * URL of a file served from `public/` (for example `publicUrl('models/sofa.glb')`).
 * Built from Vite's base, so it works when the site is hosted in a subfolder: never start such a URL with `/`.
 */
export function publicUrl(path: string, base: string = import.meta.env.BASE_URL): string {
  const root = base === '' ? './' : base.endsWith('/') ? base : `${base}/`
  return `${root}${path.replace(/^\/+/, '')}`
}
