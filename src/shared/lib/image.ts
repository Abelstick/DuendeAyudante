import { AppError } from '@/shared/domain/errors';

/** Tamaño para que el lado más largo no pase de `max` (sin agrandar las pequeñas). */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const PASSTHROUGH = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Achica la foto antes de subirla (las del celular pesan 3–8 MB): lado
 * mayor de `maxSide` px, en JPEG. Respeta la orientación de la cámara.
 * Si el navegador no puede abrirla, sube el original cuando es un formato
 * conocido; si no, avisa.
 */
export async function prepareImageForUpload(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const size = fitWithin(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('sin canvas');
    ctx.fillStyle = '#fff'; // PNG con transparencia → fondo blanco en JPEG
    ctx.fillRect(0, 0, size.width, size.height);
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (!blob) throw new Error('sin blob');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    if (PASSTHROUGH.has(file.type)) return file;
    throw new AppError('PHOTO_READ_FAILED');
  }
}
