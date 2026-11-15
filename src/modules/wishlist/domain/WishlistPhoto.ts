/** Foto de referencia de un regalo. El archivo vive en el Google Drive de la familia. */
export interface WishlistPhoto {
  id: string;
  driveFileId: string;
}

export const MAX_PHOTOS_PER_ITEM = 6;

/**
 * Dirección de la imagen en Drive (el archivo está compartido como
 * "cualquiera con el enlace"). `width` pide una versión de ese ancho.
 */
export function photoUrl(driveFileId: string, width = 800): string {
  return `https://lh3.googleusercontent.com/d/${encodeURIComponent(driveFileId)}=w${width}`;
}

/** Respaldo si la dirección principal falla. */
export function photoFallbackUrl(driveFileId: string, width = 800): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(driveFileId)}&sz=w${width}`;
}
