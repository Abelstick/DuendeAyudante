/** Google Drive conectado a una familia: ahí se guardan las fotos de sus regalos. */
export interface FamilyDrive {
  familyId: string;
  /** Cuenta de Google conectada. Solo la ve quien administra (null para los demás). */
  googleEmail: string | null;
  /** Google rechazó el acceso (lo quitaron desde la cuenta): hay que volver a conectar. */
  needsReconnect: boolean;
  connectedAt: Date;
}

export interface IFamilyDriveRepository {
  listForEvent(eventId: string): Promise<FamilyDrive[]>;
  /** Enlace de Google para conectar la cuenta (organizador/administradores). */
  getConnectUrl(familyId: string): Promise<string>;
  disconnect(familyId: string): Promise<void>;
}

/**
 * ¿Puede esta persona subir fotos?
 *  · ready      → su familia tiene Drive conectado
 *  · no-family  → no pertenece a ninguna familia
 *  · no-drive   → su familia todavía no conecta un Drive
 *  · reconnect  → el Drive de su familia perdió el acceso
 */
export type PhotoUploadStatus = 'ready' | 'no-family' | 'no-drive' | 'reconnect';

export function photoUploadStatus(familyId: string | null | undefined, drives: readonly FamilyDrive[]): PhotoUploadStatus {
  if (!familyId) return 'no-family';
  const drive = drives.find((d) => d.familyId === familyId);
  if (!drive) return 'no-drive';
  return drive.needsReconnect ? 'reconnect' : 'ready';
}
