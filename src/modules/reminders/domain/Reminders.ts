/**
 * Recordatorios por WhatsApp: qué le falta a cada persona y el mensaje listo
 * para enviar. No hay teléfonos guardados: WhatsApp se abre con el texto y
 * quien organiza elige el contacto.
 */
import { appliesTo, type ChecklistItem, type ChecklistProgress } from '@/modules/checklist/domain/Checklist';
import type { Member } from '@/modules/members/domain/Participant';
import { isAssignedTo, type Responsibility } from '@/modules/responsibilities/domain/Responsibility';
import { formatDateOnly } from '@/shared/lib/datetime';
import { toTitleCase } from '@/shared/validation/names';

export type PendingKind = 'wishlist' | 'checklist' | 'responsibility';

export interface PendingItem {
  kind: PendingKind;
  text: string;
}

export interface PersonReminder {
  /** A quién se le escribe (tiene usuario o es el tutor). */
  member: Member;
  pending: PendingItem[];
}

export interface ReminderInput {
  members: readonly Member[];
  wishCount: (participantId: string) => number;
  checklistItems: readonly ChecklistItem[];
  progress: readonly ChecklistProgress[];
  responsibilities: readonly Responsibility[];
}

const firstName = (m: Pick<Member, 'firstName'>) => toTitleCase(m.firstName);

/** Lo que le falta a una sola persona (sin contar a quienes tiene a cargo). */
function pendingOf(m: Member, input: ReminderInput, forWard: boolean): PendingItem[] {
  const suffix = forWard ? ` (de ${firstName(m)})` : '';
  const items: PendingItem[] = [];
  if (input.wishCount(m.id) === 0) {
    items.push({ kind: 'wishlist', text: forWard ? `Agregar los regalos de ${firstName(m)}` : 'Agregar tus opciones de regalo' });
  }
  const done = new Set(input.progress.filter((p) => p.participantId === m.id).map((p) => p.itemId));
  for (const item of input.checklistItems) {
    if (appliesTo(item, m) && !done.has(item.id)) items.push({ kind: 'checklist', text: `${item.title}${suffix}` });
  }
  // Las responsabilidades de familia se le recuerdan a cada integrante con usuario, no a los niños
  for (const r of input.responsibilities) {
    if (r.status === 'done') continue;
    const direct = r.participantIds.includes(m.id);
    const byFamily = !forWard && isAssignedTo(r, [m]);
    if (direct || byFamily) {
      items.push({ kind: 'responsibility', text: `${r.title}${r.dueDate ? ` (para el ${formatDateOnly(r.dueDate)})` : ''}${direct ? suffix : ''}` });
    }
  }
  return items;
}

/**
 * Personas a las que conviene escribirles y qué les falta. Lo de los niños
 * sin usuario se le recuerda a su tutor. Quien no tiene usuario ni tutor
 * también aparece (alguien puede avisarle igual).
 */
export function buildReminders(input: ReminderInput): PersonReminder[] {
  const active = input.members.filter((m) => m.status === 'active');
  const byId = new Map(active.map((m) => [m.id, m]));
  const out = new Map<string, PersonReminder>();
  const push = (target: Member, items: PendingItem[]) => {
    if (items.length === 0) return;
    const entry = out.get(target.id) ?? { member: target, pending: [] };
    entry.pending.push(...items);
    out.set(target.id, entry);
  };

  for (const m of active) {
    const guardians = m.hasAccount ? [] : m.guardianIds.map((id) => byId.get(id)).filter((g): g is Member => Boolean(g));
    if (guardians.length > 0) {
      for (const g of guardians) push(g, pendingOf(m, input, true));
    } else {
      push(m, pendingOf(m, input, false));
    }
  }

  return [...out.values()].sort((a, b) => b.pending.length - a.pending.length || a.member.fullName.localeCompare(b.member.fullName, 'es'));
}

/** Mensaje personal: saludo, lista de pendientes y enlace a la app. */
export function personalReminderMessage(reminder: PersonReminder, eventName: string, appLink: string): string {
  const lines = reminder.pending.map((p) => `• ${p.text}`);
  return [
    `¡Hola ${firstName(reminder.member)}! 🎄`,
    `Para nuestra Navidad «${eventName}» te falta:`,
    ...lines,
    '',
    `Entra aquí: ${appLink}`,
    '¡Gracias! 🎁',
  ].join('\n');
}

/** Mensaje para el grupo de la familia: quiénes aún no agregan regalos y qué falta llevar. */
export function groupReminderMessage(
  opts: { eventName: string; appLink: string; withoutGifts: readonly Member[]; pendingResponsibilities: readonly Responsibility[] },
): string {
  const parts = [`🎄 Recordatorio de «${opts.eventName}»`];
  if (opts.withoutGifts.length > 0) {
    parts.push('', '🎁 Falta que agreguen sus regalos:', ...opts.withoutGifts.map((m) => `• ${firstName(m)}`));
  }
  if (opts.pendingResponsibilities.length > 0) {
    parts.push('', '📌 Aún falta:', ...opts.pendingResponsibilities.map((r) => `• ${r.title}${r.dueDate ? ` (para el ${formatDateOnly(r.dueDate)})` : ''}`));
  }
  if (parts.length === 1) parts.push('', '¡Todo está listo! Gracias a todos. 🎉');
  parts.push('', `Entren aquí: ${opts.appLink}`);
  return parts.join('\n');
}

/** Recordatorio de una sola responsabilidad (aporte o tarea) para sus responsables. */
export function responsibilityReminderMessage(r: Responsibility, responsibleNames: readonly string[], eventName: string, appLink: string): string {
  const who = responsibleNames.length > 0 ? `¡Hola ${responsibleNames.join(', ')}! ` : '¡Hola! ';
  return [
    `${who}🎄`,
    `Para nuestra Navidad «${eventName}» les recuerdo: ${r.kind === 'contribution' ? 'llevar' : 'hacer'} «${r.title}»${r.dueDate ? ` para el ${formatDateOnly(r.dueDate)}` : ''}.`,
    r.notes ? `📝 ${r.notes}` : null,
    'Cuando esté listo, márquenlo en la app:',
    appLink,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
