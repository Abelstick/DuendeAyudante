import { Spinner } from '@/shared/ui/Button';

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center text-lg text-pine-800">
      <Spinner label={label} />
    </div>
  );
}
