export function CheckIcon({ label }: { label: string }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" role="img" aria-label={label}>
      <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function DeepIcon({ label }: { label: string }) {
  return (
    <svg className="icon" viewBox="0 0 16 16" role="img" aria-label={label}>
      <path d="M4 5l4 4 4-4M4 9l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
