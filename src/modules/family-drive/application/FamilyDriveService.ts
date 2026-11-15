import type { IFamilyDriveRepository } from '../domain/FamilyDrive';

export class FamilyDriveService {
  constructor(private readonly drives: IFamilyDriveRepository) {}

  listForEvent(eventId: string) {
    return this.drives.listForEvent(eventId);
  }

  getConnectUrl(familyId: string) {
    return this.drives.getConnectUrl(familyId);
  }

  disconnect(familyId: string) {
    return this.drives.disconnect(familyId);
  }
}
