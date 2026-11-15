interface Props {
  percent: number;
  label: string;
  /** `gold` cuando ya se completó todo. */
  tone?: 'brand' | 'gold';
  size?: 'md' | 'lg';
}

export function ProgressBar({ percent, label, tone = 'brand', size = 'lg' }: Props) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div
      className={`overflow-hidden rounded-full bg-mist-200 ${size === 'lg' ? 'h-4' : 'h-3'}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-700 ease-out ${tone === 'gold' ? 'bg-gold-400' : 'bg-brand'}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
