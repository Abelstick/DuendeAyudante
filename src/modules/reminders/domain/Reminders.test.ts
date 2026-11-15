import { describe, expect, it } from 'vitest';
import type { ChecklistItem } from '@/modules/checklist/domain/Checklist';
import type { Member } from '@/modules/members/domain/Participant';
import type { Responsibility } from '@/modules/responsibilities/domain/Responsibility';
import { formatDateOnly } from '@/shared/lib/datetime';
import { buildReminders, groupReminderMessage, personalReminderMessage, responsibilityReminderMessage } from './Reminders';

const member = (id: string, firstName: string, extra: Partial<Member> = {}): Member => ({
  id,
  eventId: 'e',
  familyId: null,
  hasAccount: true,
  firstName,
  paternalSurname: 'GARCÍA',
  maternalSurname: null,
  fullName: `${firstName} GARCÍA`,
  distinguishingNote: null,
  username: firstName.toLowerCase(),
  role: 'participant',
  guardianIds: [],
  status: 'active',
  ...extra,
});

const rosa = member('rosa', 'ROSA', { familyId: 'fam' });
const juan = member('juan', 'JUAN', { familyId: 'fam' });
const nino = member('nino', 'PEDRITO', { hasAccount: false, guardianIds: ['juan'], familyId: 'fam' });
const listo = member('listo', 'ANA');

const due = formatDateOnly('2026-12-23');
const item: ChecklistItem = { id: 'c1', eventId: 'e', title: 'Confirma tu asistencia', description: null, scope: 'all', familyId: null, participantId: null, sortOrder: 0 };
const pavo: Responsibility = {
  id: 'r1',
  eventId: 'e',
  kind: 'contribution',
  category: 'food',
  title: 'Pavo',
  description: null,
  dueDate: '2026-12-23',
  status: 'pending',
  notes: 'Para 20 personas',
  participantIds: [],
  familyIds: ['fam'],
};

describe('recordatorios', () => {
  const reminders = buildReminders({
    members: [rosa, juan, nino, listo],
    wishCount: (id) => (id === 'rosa' || id === 'listo' ? 2 : 0),
    checklistItems: [item],
    progress: [{ itemId: 'c1', participantId: 'listo' }],
    responsibilities: [pavo],
  });

  it('dice qué le falta a cada uno; lo del niño se le recuerda a su tutor', () => {
    const juanR = reminders.find((r) => r.member.id === 'juan')!;
    expect(juanR.pending.map((p) => p.text)).toEqual([
      'Agregar tus opciones de regalo',
      'Confirma tu asistencia',
      `Pavo (para el ${due})`,
      'Agregar los regalos de Pedrito',
      'Confirma tu asistencia (de Pedrito)',
    ]);
    expect(reminders.find((r) => r.member.id === 'nino')).toBeUndefined();
  });

  it('quien tiene todo listo no aparece; los demás van de más a menos pendientes', () => {
    expect(reminders.map((r) => r.member.id)).toEqual(['juan', 'rosa']);
  });

  it('arma el mensaje personal con el enlace', () => {
    const text = personalReminderMessage(reminders[1]!, 'Navidad García', 'https://app/e/1');
    expect(text).toContain('¡Hola Rosa! 🎄');
    expect(text).toContain('• Confirma tu asistencia');
    expect(text.endsWith('¡Gracias! 🎁')).toBe(true);
    expect(text).toContain('https://app/e/1');
  });

  it('arma el mensaje para el grupo', () => {
    const text = groupReminderMessage({ eventName: 'Navidad García', appLink: 'https://app', withoutGifts: [juan], pendingResponsibilities: [pavo] });
    expect(text).toContain('• Juan');
    expect(text).toContain(`• Pavo (para el ${due})`);
    const empty = groupReminderMessage({ eventName: 'X', appLink: 'https://app', withoutGifts: [], pendingResponsibilities: [] });
    expect(empty).toContain('¡Todo está listo!');
  });

  it('arma el recordatorio de un aporte', () => {
    const text = responsibilityReminderMessage(pavo, ['Familia García'], 'Navidad García', 'https://app');
    expect(text).toContain(`llevar «Pavo» para el ${due}`);
    expect(text).toContain('📝 Para 20 personas');
  });
});
