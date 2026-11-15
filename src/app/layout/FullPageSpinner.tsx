import { Spinner } from '@/shared/ui/Button';

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-lg text-brand">
      <Spinner label={label} />
    </div>
  );
}
