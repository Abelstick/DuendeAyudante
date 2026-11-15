interface Props {
  percent: number;
  label: string;
  /** `gold` cuando ya se completó todo. */
  tone?: 'brand' | 'gold';
  size?: 'md' | 'lg';
}

/** Barra de progreso tipo "barra de energía": contorno de tinta y relleno a rayas de bloques. */
export function ProgressBar({ percent, label, tone = 'brand', size = 'lg' }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={`overflow-hidden rounded-lg border-2 border-night-900 bg-white ${size === 'lg' ? 'h-6' : 'h-5'}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div
        className={`h-full transition-[width] duration-700 ease-out ${tone === 'gold' ? 'bg-gold-400' : 'bg-brand'}`}
        style={{
          width: `${value}%`,
          backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 14px, rgb(15 30 56 / 0.35) 14px 16px), linear-gradient(rgb(255 255 255 / 0.35) 0 35%, transparent 35%)',
        }}
      />
    </div>
  );
}
