import type { ComponentPropsWithRef } from 'react'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: 'primary' | 'ghost' | 'solid'
  size?: 'md' | 'sm'
}

export function Button({ variant = 'ghost', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  const classes = ['at-btn', `at-btn--${variant}`, size === 'sm' ? 'at-btn--sm' : '', className ?? '']
    .filter(Boolean)
    .join(' ')
  return <button type={type} className={classes} {...rest} />
}
