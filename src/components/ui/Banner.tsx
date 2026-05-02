import type { ReactNode } from 'react';

type Tone = 'info' | 'success' | 'warning' | 'error';

const TONE_CLASSES: Record<Tone, string> = {
  info: 'bg-blue-50 border-blue-300 text-blue-900',
  success: 'bg-green-50 border-green-300 text-green-900',
  warning: 'bg-amber-50 border-amber-400 text-amber-900',
  error: 'bg-red-50 border-red-400 text-red-900',
};

interface BannerProps {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  role?: 'alert' | 'status';
}

export function Banner({ tone = 'info', title, children, role = 'status' }: BannerProps) {
  return (
    <div
      role={role}
      aria-live={role === 'alert' ? 'assertive' : 'polite'}
      className={['rounded-lg border-l-4 p-4 text-sm', TONE_CLASSES[tone]].join(' ')}
    >
      {title && <p className="mb-1 font-semibold">{title}</p>}
      {children && <div>{children}</div>}
    </div>
  );
}
