import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { photoFallbackUrl, photoUrl } from '../domain/WishlistPhoto';

interface Props {
  driveFileId: string;
  alt: string;
  /** Ancho pedido a Drive (px). */
  width?: number;
  className?: string;
  /** contain = foto completa (visor) · cover = recortada para llenar (miniaturas). */
  fit?: 'cover' | 'contain';
}

/** Foto guardada en Google Drive. Si la dirección principal falla, prueba la de respaldo. */
export function DrivePhoto({ driveFileId, alt, width = 600, className = '', fit = 'cover' }: Props) {
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);
  const [loaded, setLoaded] = useState(false);

  if (attempt === 2) {
    return (
      <span className={`flex items-center justify-center bg-mist-200 text-ink-500 ${className}`} role="img" aria-label={`${alt} (no se pudo cargar)`}>
        <ImageOff className="size-6" aria-hidden />
      </span>
    );
  }

  return (
    <img
      key={attempt}
      src={attempt === 0 ? photoUrl(driveFileId, width) : photoFallbackUrl(driveFileId, width)}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onLoad={() => setLoaded(true)}
      onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
      className={`${fit === 'cover' ? 'object-cover' : 'object-contain'} ${loaded ? '' : 'animate-pulse bg-mist-200'} ${className}`}
    />
  );
}
