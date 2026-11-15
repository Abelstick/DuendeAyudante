import { Check, MessageCircle, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { useChecklistItems, useChecklistProgress } from '@/modules/checklist/presentation/hooks';
import { displayName, type Member } from '@/modules/members/domain/Participant';
import { useResponsibilities } from '@/modules/responsibilities/presentation/hooks';
import { useEventWishlist } from '@/modules/wishlist/presentation/hooks';
import { eventAppLink } from '@/shared/lib/appLink';
import { whatsappShareUrl } from '@/shared/lib/whatsapp';
import { buttonClasses, Spinner } from '@/shared/ui/Button';
import { EmptyState, Pill } from '@/shared/ui/Card';
import { buildReminders, groupReminderMessage, personalReminderMessage, type PendingKind } from '../domain/Reminders';

const KIND_EMOJI: Record<PendingKind, string> = { wishlist: '🎁', checklist: '✅', responsibility: '📌' };

/**
 * Para quien organiza: a quién le falta algo (regalos, checklist, aportes y
 * tareas) y un botón para mandarle el recordatorio por WhatsApp. Marca en
 * esta visita a quién ya se le escribió.
 */
export function RemindersPanel({ members }: { members: Member[] }) {
  const { event } = useEventScope();
  const wishlist = useEventWishlist(event.id);
  const items = useChecklistItems(event.id);
  const progress = useChecklistProgress(event.id);
  const responsibilities = useResponsibilities(event.id);
  const [sent, setSent] = useState<Set<string>>(() => new Set());
  const [showAll, setShowAll] = useState(false);

  const reminders = useMemo(() => {
    if (!wishlist.data || !items.data || !progress.data || !responsibilities.data) return null;
    const counts = new Map<string, number>();
    for (const w of wishlist.data) counts.set(w.participantId, (counts.get(w.participantId) ?? 0) + 1);
    return buildReminders({
      members,
      wishCount: (id) => counts.get(id) ?? 0,
      checklistItems: items.data,
      progress: progress.data,
      responsibilities: responsibilities.data,
    });
  }, [members, wishlist.data, items.data, progress.data, responsibilities.data]);

  if (!reminders) return <Spinner label="Revisando qué falta…" />;

  const link = eventAppLink(event.id);
  const withoutGifts = members.filter((m) => m.status === 'active' && !(wishlist.data ?? []).some((w) => w.participantId === m.id));
  const groupText = groupReminderMessage({
    eventName: event.name,
    appLink: link,
    withoutGifts,
    pendingResponsibilities: (responsibilities.data ?? []).filter((r) => r.status !== 'done'),
  });
  const visible = showAll ? reminders : reminders.slice(0, 6);

  return (
    <div className="space-y-4">
      <p className="text-base text-ink-700">
        Toca <strong>«Recordar»</strong> y se abre WhatsApp con el mensaje listo: solo eliges el contacto. También puedes mandar un resumen al grupo de la familia.
      </p>

      <a href={whatsappShareUrl(groupText)} target="_blank" rel="noopener noreferrer" className={buttonClasses('whatsapp', 'md')}>
        <Users className="size-5" aria-hidden />
        Mandar resumen al grupo
      </a>

      {reminders.length === 0 ? (
        <EmptyState emoji="🎉" title="¡A nadie le falta nada!">
          Todos agregaron sus regalos y cumplieron sus tareas.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {visible.map((r) => {
            const done = sent.has(r.member.id);
            return (
              <li key={r.member.id} className={`space-y-2 rounded-2xl border-2 p-3 ${done ? 'border-pine-600/30 bg-pine-50' : 'border-mist-300 bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-ink-900">{displayName(r.member)}</p>
                  <Pill tone={done ? 'success' : 'gold'}>
                    {done ? 'Recordado' : `Le ${r.pending.length === 1 ? 'falta 1 cosa' : `faltan ${r.pending.length} cosas`}`}
                  </Pill>
                </div>
                <ul className="space-y-0.5 text-sm text-ink-700">
                  {r.pending.map((p, i) => (
                    <li key={i}>
                      <span aria-hidden>{KIND_EMOJI[p.kind]}</span> {p.text}
                    </li>
                  ))}
                </ul>
                <a
                  href={whatsappShareUrl(personalReminderMessage(r, event.name, link))}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setSent((prev) => new Set(prev).add(r.member.id))}
                  className={buttonClasses(done ? 'secondary' : 'whatsapp', 'md')}
                >
                  {done ? <Check className="size-5" aria-hidden /> : <MessageCircle className="size-5" aria-hidden />}
                  {done ? 'Recordar otra vez' : 'Recordar'}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {reminders.length > 6 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className={buttonClasses('ghost', 'md')}>
          {showAll ? 'Ver menos' : `Ver a las ${reminders.length} personas`}
        </button>
      )}
    </div>
  );
}
