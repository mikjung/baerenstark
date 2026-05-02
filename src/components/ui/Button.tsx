import { type ButtonHTMLAttributes, forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-baerenstark-wood text-baerenstark-cream hover:bg-baerenstark-bark active:bg-baerenstark-bark',
  secondary:
    'bg-baerenstark-sand text-baerenstark-bark hover:bg-baerenstark-accent hover:text-baerenstark-bark border border-baerenstark-wood/30',
  ghost:
    'bg-transparent text-baerenstark-bark hover:bg-baerenstark-sand/40 border border-baerenstark-wood/30',
  danger:
    'bg-red-700 text-white hover:bg-red-800 active:bg-red-900',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', isLoading = false, className = '', children, disabled, ...rest },
  ref,
) {
  const isDisabled = disabled || isLoading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-baerenstark-accent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {isLoading && (
        <span
          aria-hidden="true"
          className="spinner h-4 w-4"
          style={{ borderTopColor: 'currentColor' }}
        />
      )}
      <span>{children}</span>
    </button>
  );
});
