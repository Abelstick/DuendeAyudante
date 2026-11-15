import { ImageOff, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { photoFallbackUrl, photoUrl } from '../domain/WishlistPhoto';

interface Props {
  driveFileId: string;
  alt: string;
  /** Ancho pedido a Drive (px). */
  width?: number;
  /** Tamaño y forma del recuadro (p. ej. "size-20 rounded-xl"). */
  className?: string;
  /** contain = foto completa (visor) · cover = recortada para llenar (miniaturas). */
  fit?: 'cover' | 'contain';
}

/**
 * Foto guardada en Google Drive. Mientras carga muestra un brillo animado;
 * al llegar aparece con un fundido. Si la dirección principal falla, prueba la de respaldo.
 */
export function DrivePhoto({ driveFileId, alt, width = 600, className = '', fit = 'cover' }: Props) {
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);
  const [loaded, setLoaded] = useState(false);
  const small = width <= 240;

  if (attempt === 2) {
    return (
      <span className={`flex items-center justify-center bg-mist-200 text-ink-500 ${className}`} role="img" aria-label={`${alt} (no se pudo cargar)`}>
        <ImageOff className="size-6" aria-hidden />
      </span>
    );
  }

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {!loaded && (
        <span className="photo-shimmer absolute inset-0 flex items-center justify-center bg-mist-200" aria-hidden>
          <Loader2 className={`${small ? 'size-5' : 'size-8'} text-ink-500 motion-safe:animate-spin`} />
        </span>
      )}
      <img
        key={attempt}
        src={attempt === 0 ? photoUrl(driveFileId, width) : photoFallbackUrl(driveFileId, width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
        className={`size-full ${fit === 'cover' ? 'object-cover' : 'object-contain'} motion-safe:transition-opacity motion-safe:duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
      />
    </span>
  );
}
