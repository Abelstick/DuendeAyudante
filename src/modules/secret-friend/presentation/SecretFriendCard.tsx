import { Eye, EyeOff, Gift, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { actingParticipants } from '@/modules/events/domain/Event';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatMoney } from '@/shared/lib/money';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { toTitleCase } from '@/shared/validation/names';
import { useMySecretFriends, useSecretFriendMutations } from './hooks';
import { SecretFriendPickerModal } from './SecretFriendPickerModal';

/**
 * Amigo secreto OPCIONAL: cada persona puede anotar a quién le regala para
 * tener su lista a mano. El nombre queda oculto hasta tocar «Mostrar».
 */
export function SecretFriendCard() {
  const { event, context } = useEventScope();
  const notes = useMySecretFriends(event.id);
  const participants = useParticipants(event.id);
  const families = useFamilies(event.id);
  const { clear } = useSecretFriendMutations(event.id);
  const toast = useToast();
  const people = actingParticipants(context);
  const [giverId, setGiverId] = useState<string | null>(people[0]?.id ?? null);
  const [revealed, setRevealed] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const giver = people.find((p) => p.id === giverId) ?? people[0];
  if (!giver || !notes.data || !participants.data) return null;

  const isMe = giver.id === context.me?.id;
  const forName = isMe ? null : toTitleCase(giver.firstName);
  const note = notes.data.find((n) => n.giverId === giver.id);
  const receiver = note ? participants.data.find((p) => p.id === note.receiverId) : undefined;
  const budget = event.giftExchange?.budgetMax;

  const onClear = async () => {
    try {
      await clear.mutateAsync(giver.id);
      toast.success('Lo quitamos. Puedes volver a anotarlo cuando quieras.');
      setConfirmingClear(false);
      setRevealed(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-bold text-brand">
        <Gift className="size-6" aria-hidden /> Amigo secreto
      </h2>

      {people.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="De quién">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={giver.id === p.id}
              onClick={() => {
                setGiverId(p.id);
                setRevealed(false);
                setConfirmingClear(false);
              }}
              className={`min-h-12 rounded-full border-2 px-4 text-base font-semibold ${
                giver.id === p.id ? 'border-brand bg-brand text-white' : 'border-cream-200 bg-white'
              }`}
            >
              {p.id === context.me?.id ? 'El mío' : `El de ${toTitleCase(p.firstName)}`}
            </button>
          ))}
        </div>
      )}

      {!receiver ? (
        <>
          <p className="text-base">
            {forName ? `¿Ya sabes a quién le regala ${forName}?` : '¿Ya sabes a quién le regalas?'} Si quieres, anótalo aquí para tener su lista de regalos
            a mano.
          </p>
          <p className="text-sm text-ink-700">🔒 Es opcional y privado: nadie más lo verá, ni el organizador.</p>
          <Button variant="secondary" onClick={() => setPicking(true)}>
            Anotar amigo secreto
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft p-4">
            <div>
              <p className="text-sm text-ink-700">{forName ? `${forName} le regala a:` : 'Le regalas a:'}</p>
              {revealed ? (
                <div className="space-y-1">
                  <p className="text-xl font-bold text-brand">{displayName(receiver)}</p>
                  <FamilyBadge family={families.data?.find((f) => f.id === receiver.familyId)} />
                </div>
              ) : (
                <p className="text-xl font-bold tracking-widest text-ink-500" aria-label="Nombre oculto">
                  ● ● ● ● ● ●
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              onClick={() => setRevealed((v) => !v)}
              aria-pressed={revealed}
              icon={revealed ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
            >
              {revealed ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>

          {budget != null && <p className="text-base text-ink-700">💰 Presupuesto: {formatMoney(budget, event.currency)}</p>}

          <ButtonLink to={`/e/${event.id}/regalos/persona/${receiver.id}`} icon={<Gift className="size-5" aria-hidden />}>
            Ver qué le gustaría recibir
          </ButtonLink>

          {confirmingClear ? (
            <div className="space-y-2 rounded-xl bg-berry-50 p-3" role="alert">
              <p className="font-semibold text-berry-700">¿Quitar lo que anotaste?</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="danger" loading={clear.isPending} onClick={onClear}>
                  Sí, quitar
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingClear(false)}>
                  No
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setPicking(true)} icon={<Pencil className="size-5" aria-hidden />}>
                Cambiar
              </Button>
              <Button variant="ghost" onClick={() => setConfirmingClear(true)} icon={<Trash2 className="size-5" aria-hidden />}>
                Quitar
              </Button>
            </div>
          )}
        </>
      )}

      {picking && (
        <SecretFriendPickerModal
          eventId={event.id}
          giver={giver}
          forName={forName}
          currentReceiverId={note?.receiverId ?? null}
          participants={participants.data}
          families={families.data ?? []}
          onClose={() => setPicking(false)}
        />
      )}
    </Card>
  );
}
