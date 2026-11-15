import type { DriveTarget, IFamilyDriveRepository } from '../domain/FamilyDrive';

export class FamilyDriveService {
  constructor(private readonly drives: IFamilyDriveRepository) {}

  listForEvent(eventId: string) {
    return this.drives.listForEvent(eventId);
  }

  getEventDrive(eventId: string) {
    return this.drives.getEventDrive(eventId);
  }

  getConnectUrl(target: DriveTarget) {
    return this.drives.getConnectUrl(target);
  }

  disconnect(target: DriveTarget) {
    return this.drives.disconnect(target);
  }
}
