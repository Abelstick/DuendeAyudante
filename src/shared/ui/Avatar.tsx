/** "ROSA GARCÍA LÓPEZ" → "RG" */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : '';
  return (first + second).toUpperCase() || '🎄';
}

interface Props {
  name: string;
  /** Colores de la familia; si no hay, usa el color de la interfaz. */
  colors?: { bg: string; fg: string };
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'size-10 text-sm', md: 'size-12 text-base', lg: 'size-16 text-xl' } as const;

/** Iniciales de la persona en un círculo con el color de su familia (decorativo: el nombre siempre va al lado). */
export function Avatar({ name, colors, size = 'md' }: Props) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-black ring-2 ring-white ${sizes[size]} ${colors ? '' : 'bg-brand-soft text-brand'}`}
      style={colors ? { backgroundColor: colors.bg, color: colors.fg } : undefined}
    >
      {initialsOf(name)}
    </span>
  );
}
