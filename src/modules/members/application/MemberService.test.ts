import { describe, expect, it, vi } from 'vitest';
import { MemberService } from './MemberService';

function setup() {
  const accounts = { createMember: vi.fn().mockResolvedValue({ participantId: 'p', fullName: 'ROSA GARCÍA', username: 'rosa' }), resetPassword: vi.fn() };
  const participants = { listActive: vi.fn(), listMembers: vi.fn(), updateFamily: vi.fn(), updateDetails: vi.fn() };
  return { accounts, participants, service: new MemberService(participants, accounts) };
}

describe('mensaje de acceso por WhatsApp', () => {
  it('incluye enlace con código y usuario ya puestos, el código, el usuario y la contraseña', () => {
    const { service } = setup();
    const msg = service.buildAccessMessage({
      firstName: 'Rosa',
      eventName: 'Navidad García',
      joinCode: 'GARCIA25',
      appUrl: 'https://navidad.app',
      username: 'rosa',
      password: 'estrella4821',
    });
    expect(msg).toContain('https://navidad.app/entrar?c=GARCIA25&u=rosa');
    expect(msg).toContain('Código de tu Navidad: GARCIA25');
    expect(msg).toContain('Tu usuario: rosa');
    expect(msg).toContain('Tu contraseña: estrella4821');
  });

  it('al reenviar el acceso no incluye la contraseña', () => {
    const { service } = setup();
    const msg = service.buildAccessMessage({ firstName: 'Rosa', eventName: 'X', joinCode: 'ABCD', appUrl: 'https://a', username: 'rosa', password: null });
    expect(msg).not.toContain('Tu contraseña:');
    expect(msg).toContain('pídeme una nueva');
  });
});

describe('agregar familiar', () => {
  it('normaliza el usuario antes de enviarlo', async () => {
    const { service, accounts } = setup();
    await service.addMember({
      eventId: 'e',
      firstName: 'Rosa',
      paternalSurname: 'García',
      maternalSurname: '  ',
      distinguishingNote: null,
      familyId: null,
      role: 'participant',
      account: { username: ' Rosa ', password: 'estrella4821', autoSuffix: true },
      guardianParticipantIds: [],
    });
    expect(accounts.createMember).toHaveBeenCalledWith(
      expect.objectContaining({ maternalSurname: null, account: expect.objectContaining({ username: 'rosa' }) }),
    );
  });

  it('exige usuario propio para editores y administradores', async () => {
    const { service } = setup();
    await expect(
      service.addMember({
        eventId: 'e',
        firstName: 'Ana',
        paternalSurname: 'Díaz',
        maternalSurname: null,
        distinguishingNote: null,
        familyId: null,
        role: 'editor',
        account: null,
        guardianParticipantIds: [],
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_REQUIRED_FOR_ROLE' });
  });
});

describe('editar familiar', () => {
  const details = { firstName: ' Rosa ', paternalSurname: 'García', maternalSurname: '  ', distinguishingNote: ' hija ', familyId: '' };

  it('limpia espacios, deja vacíos como null y guarda', async () => {
    const { participants, service } = setup();
    await service.updateMember('p1', details);
    expect(participants.updateDetails).toHaveBeenCalledWith('p1', {
      firstName: 'Rosa',
      paternalSurname: 'García',
      maternalSurname: null,
      distinguishingNote: 'hija',
      familyId: null,
    });
  });

  it('rechaza nombres inválidos sin llamar a la base de datos', async () => {
    const { participants, service } = setup();
    await expect(service.updateMember('p1', { ...details, firstName: 'R0sa' })).rejects.toMatchObject({ code: 'FIRST_NAME_INVALID' });
    await expect(service.updateMember('p1', { ...details, paternalSurname: '' })).rejects.toMatchObject({ code: 'PATERNAL_SURNAME_INVALID' });
    await expect(service.updateMember('p1', { ...details, distinguishingNote: 'x'.repeat(41) })).rejects.toMatchObject({ code: 'DISTINGUISHING_NOTE_INVALID' });
    expect(participants.updateDetails).not.toHaveBeenCalled();
  });
});
