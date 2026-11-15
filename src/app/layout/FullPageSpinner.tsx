import { GiftBox } from '@/shared/ui/illustrations';

export function FullPageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" className="font-display flex min-h-dvh flex-col items-center justify-center gap-4 text-xl font-semibold text-night-900">
      <GiftBox tone="berry" className="w-16 motion-safe:animate-float" />
      <span>{label}</span>
    </div>
  );
}
