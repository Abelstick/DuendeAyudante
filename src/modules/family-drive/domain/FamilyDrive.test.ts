import { describe, expect, it } from 'vitest';
import { photoUploadStatus, type DriveConnection, type FamilyDrive } from './FamilyDrive';

const conn = (needsReconnect = false): DriveConnection => ({ googleEmail: null, needsReconnect, connectedAt: new Date() });
const family = (familyId: string, needsReconnect = false): FamilyDrive => ({ familyId, ...conn(needsReconnect) });

describe('photoUploadStatus', () => {
  it('sin ningún Drive no se puede subir', () => {
    expect(photoUploadStatus('a', [], null)).toBe('no-drive');
    expect(photoUploadStatus(null, [family('a')], null)).toBe('no-drive');
  });

  it('usa el Drive de su familia', () => {
    expect(photoUploadStatus('a', [family('a')], null)).toBe('ready');
    expect(photoUploadStatus('b', [family('a')], null)).toBe('no-drive');
  });

  it('con el Drive general pueden subir todos, incluso quien no tiene familia', () => {
    expect(photoUploadStatus('b', [family('a')], conn())).toBe('ready');
    expect(photoUploadStatus(null, [], conn())).toBe('ready');
  });

  it('si el de su familia perdió el acceso, usa el general; si no hay otro, hay que volver a conectar', () => {
    expect(photoUploadStatus('a', [family('a', true)], conn())).toBe('ready');
    expect(photoUploadStatus('a', [family('a', true)], null)).toBe('reconnect');
    expect(photoUploadStatus(null, [], conn(true))).toBe('reconnect');
  });
});
