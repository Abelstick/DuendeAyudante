import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp' | 'gold';
type Size = 'md' | 'lg';

const base =
  'font-display [&>svg]:shrink-0 inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-wide select-none text-center disabled:opacity-55 disabled:cursor-not-allowed';

/**
 * Jerarquía de acciones:
 *  · primary   → la acción principal de la pantalla (una sola por bloque).
 *  · secondary → acciones complementarias.
 *  · ghost     → acciones menores (editar, volver, cancelar).
 *  · danger    → quitar / borrar (siempre con confirmación).
 *  · gold      → momentos especiales (ruleta, sorteos, premios).
 */
const variants: Record<Variant, string> = {
  primary: 'btn-3d border-2 border-night-900 bg-brand text-white hover:bg-brand-strong',
  secondary: 'btn-3d border-2 border-night-900 bg-white text-night-900 hover:bg-brand-soft',
  danger: 'btn-3d border-2 border-night-900 bg-berry-600 text-white hover:bg-berry-700',
  ghost: 'bg-transparent text-brand underline decoration-2 underline-offset-4 hover:bg-brand-soft active:bg-brand-soft transition-colors',
  whatsapp: 'btn-3d border-2 border-night-900 bg-[#1f8f4e] text-white hover:bg-[#187540]',
  gold: 'btn-3d border-2 border-night-900 bg-gold-400 text-night-900 hover:bg-gold-300',
};

// Áreas táctiles de 48 px o más
const sizes: Record<Size, string> = {
  md: 'min-h-12 px-4 py-2 text-lg',
  lg: 'min-h-14 px-6 py-3 text-xl w-full',
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
    <button type={type} className={buttonClasses(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
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
