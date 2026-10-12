import type { ComponentPropsWithRef } from 'react'

export interface BevelButtonProps extends ComponentPropsWithRef<'button'> {
  tone?: 'primary' | 'plain'
  size?: 'md' | 'sm'
}

export function BevelButton({ tone = 'plain', size = 'md', className, type = 'button', ...rest }: BevelButtonProps) {
  const classes = ['ws-btn', `ws-btn--${tone}`, size === 'sm' ? 'ws-btn--sm' : '', className ?? ''].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
