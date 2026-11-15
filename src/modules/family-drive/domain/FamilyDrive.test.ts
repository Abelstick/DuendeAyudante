import { describe, expect, it } from 'vitest';
import { photoUploadStatus, type FamilyDrive } from './FamilyDrive';

const drive = (familyId: string, needsReconnect = false): FamilyDrive => ({ familyId, googleEmail: null, needsReconnect, connectedAt: new Date() });

describe('photoUploadStatus', () => {
  it('sin familia no se puede subir', () => {
    expect(photoUploadStatus(null, [drive('a')])).toBe('no-family');
  });
  it('depende del Drive de SU familia', () => {
    expect(photoUploadStatus('b', [drive('a')])).toBe('no-drive');
    expect(photoUploadStatus('a', [drive('a')])).toBe('ready');
  });
  it('si Google quitó el acceso, hay que volver a conectar', () => {
    expect(photoUploadStatus('a', [drive('a', true)])).toBe('reconnect');
  });
});
