import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp';
type Size = 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed select-none text-center';

const variants: Record<Variant, string> = {
  primary: 'bg-pine-700 text-white hover:bg-pine-800 active:bg-pine-900 shadow-sm',
  secondary: 'bg-white text-pine-800 border-2 border-pine-700 hover:bg-pine-50',
  danger: 'bg-berry-600 text-white hover:bg-berry-700',
  ghost: 'bg-transparent text-pine-800 hover:bg-pine-50 underline-offset-4',
  whatsapp: 'bg-[#1f8f4e] text-white hover:bg-[#187540] shadow-sm',
};

// Áreas táctiles de 48 px o más
const sizes: Record<Size, string> = {
  md: 'min-h-12 px-4 py-2 text-base',
  lg: 'min-h-14 px-6 py-3 text-lg w-full',
};

export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', extra = '') {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export function Button({ variant, size, icon, loading, children, className = '', disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      <span>{loading ? 'Un momento…' : children}</span>
    </button>
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function ButtonLink({ variant, size, icon, children, className = '', ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2">
      <span className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">Cargando</span>}
    </span>
  );
}
