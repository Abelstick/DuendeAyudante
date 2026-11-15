import { Spinner } from '@/shared/ui/Button';

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-lg font-bold text-brand">
      <span className="text-6xl motion-safe:animate-float" aria-hidden>
        🎄
      </span>
      <Spinner label={label} />
    </div>
  );
}
