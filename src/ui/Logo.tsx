/** The five-square brand mark. Dark squares use currentColor so the mark stays visible on dark surfaces. */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 60 78"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="0" y="0" width="28" height="28" fill="#4DDBB8" />
      <rect x="32" y="0" width="28" height="28" fill="currentColor" />
      <rect x="40" y="34" width="8" height="8" fill="currentColor" />
      <rect x="0" y="46" width="28" height="32" fill="#58FC73" />
      <rect x="32" y="46" width="28" height="32" fill="#58FC73" />
    </svg>
  )
}
