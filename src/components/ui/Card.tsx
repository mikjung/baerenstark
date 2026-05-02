import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-2xl border border-baerenstark-sand bg-white/70 p-6 shadow-soft',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
