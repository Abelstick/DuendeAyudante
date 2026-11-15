/** Estado de un Google Drive conectado (sin secretos). */
export interface DriveConnection {
  /** Cuenta de Google conectada. Solo la ve quien administra (null para los demás). */
  googleEmail: string | null;
  /** Google rechazó el acceso (lo quitaron desde la cuenta): hay que volver a conectar. */
  needsReconnect: boolean;
  connectedAt: Date;
}

/** Google Drive propio de una familia: reemplaza al general para esa familia. */
export interface FamilyDrive extends DriveConnection {
  familyId: string;
}

/** Dónde conectar: el Drive general de la celebración o el de una familia. */
export type DriveTarget = { eventId: string } | { familyId: string };

export interface IFamilyDriveRepository {
  listForEvent(eventId: string): Promise<FamilyDrive[]>;
  /** Drive general de la celebración (para todas las familias), si hay. */
  getEventDrive(eventId: string): Promise<DriveConnection | null>;
  /** Enlace de Google para conectar la cuenta (organizador/administradores). */
  getConnectUrl(target: DriveTarget): Promise<string>;
  disconnect(target: DriveTarget): Promise<void>;
}

/**
 * ¿Puede esta persona subir fotos?
 *  · ready      → hay un Drive que funciona (el de su familia o, si no, el general)
 *  · no-drive   → no hay ningún Drive conectado para ella
 *  · reconnect  → hay Drive, pero perdió el acceso y no hay otro que lo reemplace
 */
export type PhotoUploadStatus = 'ready' | 'no-drive' | 'reconnect';

/** Igual que la Edge Function: primero el Drive de la familia, si no, el general. */
export function photoUploadStatus(
  familyId: string | null | undefined,
  familyDrives: readonly FamilyDrive[],
  eventDrive: DriveConnection | null | undefined,
): PhotoUploadStatus {
  const own = familyId ? familyDrives.find((d) => d.familyId === familyId) : undefined;
  if (own && !own.needsReconnect) return 'ready';
  if (eventDrive && !eventDrive.needsReconnect) return 'ready';
  return own || eventDrive ? 'reconnect' : 'no-drive';
}
