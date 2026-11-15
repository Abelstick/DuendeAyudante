import { Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { isSoundEnabled, onSoundChange, setSoundEnabled } from '@/shared/lib/sound';

/** Estado de los sonidos (compartido entre el menú y el perfil). */
export function useSoundEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(isSoundEnabled);
  useEffect(() => onSoundChange(setEnabled), []);
  return [enabled, setSoundEnabled];
}

/** Botón para apagar o prender los sonidos; siempre con texto, no solo el icono. */
export function SoundToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const [enabled, set] = useSoundEnabled();
  const Icon = enabled ? Volume2 : VolumeX;
  return (
    <button type="button" aria-pressed={enabled} onClick={() => set(!enabled)} className={className}>
      <Icon className={compact ? 'size-6' : 'size-6 shrink-0'} aria-hidden />
      {enabled ? 'Sonido: sí' : 'Sonido: no'}
    </button>
  );
}
