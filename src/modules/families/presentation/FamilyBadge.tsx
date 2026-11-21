import { type Family } from '../domain/Family';
import { FAMILY_COLORS } from './familyTheme';

/** Etiqueta de familia: color + nombre + nombre del color (no depende solo del color). */
export function FamilyBadge({ family, showColorName = false }: { family: Family | undefined; showColorName?: boolean }) {
  if (!family) return <span className="text-sm text-ink-500">Sin familia</span>;
  const c = FAMILY_COLORS[family.color];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold"
      style={{ backgroundColor: c.soft, color: c.text }}
    >
      <span className="size-3 rounded-full border border-black/25" style={{ backgroundColor: c.swatch }} aria-hidden />
      Familia {family.name}
      {showColorName && <span className="font-normal">· {c.label}</span>}
    </span>
  );
}
