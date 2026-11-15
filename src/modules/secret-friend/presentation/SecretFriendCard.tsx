import { Eye, EyeOff, Gift, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useEventScope } from '@/app/layout/EventLayout';
import { PasswordGateModal } from '@/modules/accounts/presentation/PasswordGateModal';
import { actingParticipants } from '@/modules/events/domain/Event';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { formatMoney } from '@/shared/lib/money';
import { playSound } from '@/shared/lib/sound';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Pill } from '@/shared/ui/Card';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { GiftBox } from '@/shared/ui/illustrations';
import { chipClasses } from '@/shared/ui/Tabs';
import { errorMessage } from '@/shared/ui/errorMessages';
import { useToast } from '@/shared/ui/Toast';
import { toTitleCase } from '@/shared/validation/names';
import { useMySecretFriends, useSecretFriendMutations } from './hooks';
import { SecretFriendPickerModal } from './SecretFriendPickerModal';

/**
 * Amigo secreto OPCIONAL: cada persona puede anotar a quién le regala para
 * tener su lista a mano. El nombre queda oculto y, para verlo, se pide la
 * contraseña de la cuenta CADA VEZ (no se recuerda): así nadie lo ve por
 * tener el celular a la mano. Mientras está oculto tampoco se ofrecen las
 * acciones que lo delatarían (ver su lista, cambiarlo).
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
  const [askingPassword, setAskingPassword] = useState(false);
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
    <CollapsibleCard id="inicio:amigo-secreto" icon={<Gift className="size-6" />} tone="berry" title="Amigo secreto" action={<Pill tone="neutral">🔒 Privado</Pill>}>

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
              className={chipClasses(giver.id === p.id)}
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
          <Button variant="secondary" onClick={() => setPicking(true)} icon={<Gift className="size-5" aria-hidden />}>
            Anotar amigo secreto
          </Button>
        </>
      ) : (
        <>
          {/* El nombre queda dentro del regalo hasta que la persona decide abrirlo */}
          <div className={`flex items-center gap-4 rounded-xl border-2 border-night-900 p-4 transition-colors ${revealed ? 'bg-gold-100' : 'bg-sky-100'}`}>
            <GiftBox tone="berry" open={revealed} className={`w-16 shrink-0 ${revealed ? '' : 'motion-safe:animate-float'}`} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold text-ink-700">{forName ? `${forName} le regala a:` : 'Le regalas a:'}</p>
              {revealed ? (
                <div className="animate-pop-in space-y-1">
                  <p className="text-xl font-black leading-tight text-ink-900">{displayName(receiver)}</p>
                  <FamilyBadge family={families.data?.find((f) => f.id === receiver.familyId)} />
                </div>
              ) : (
                <p className="text-lg font-extrabold text-berry-700" aria-label="Nombre oculto">
                  Está guardado en secreto 🤫
                </p>
              )}
            </div>
          </div>
          <Button
            variant={revealed ? 'ghost' : 'secondary'}
            onClick={() => {
              if (revealed) {
                setRevealed(false);
                setConfirmingClear(false);
              } else setAskingPassword(true);
            }}
            aria-pressed={revealed}
            icon={revealed ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          >
            {revealed ? 'Ocultar el nombre' : 'Mostrar el nombre'}
          </Button>
          {!revealed && <p className="text-sm text-ink-700">🔒 Para verlo te pediremos tu contraseña, cada vez.</p>}

          {budget != null && (
            <p className="text-base text-ink-700">
              💰 Presupuesto: <strong className="text-ink-900">{formatMoney(budget, event.currency)}</strong>
            </p>
          )}

          {revealed && (
            <ButtonLink to={`/e/${event.id}/regalos/persona/${receiver.id}`} state={{ secretFriendUnlocked: true }} icon={<Gift className="size-5" aria-hidden />}>
              Ver qué le gustaría recibir
            </ButtonLink>
          )}

          {!revealed ? null : confirmingClear ? (
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

      {askingPassword && (
        <PasswordGateModal
          title="Ver el amigo secreto"
          confirmLabel="Mostrar el nombre"
          onClose={() => setAskingPassword(false)}
          onVerified={() => {
            setAskingPassword(false);
            setRevealed(true);
            playSound('reveal');
          }}
        >
          {forName ? `Para ver a quién le regala ${forName}, escribe tu contraseña.` : 'Para ver a quién le regalas, escribe tu contraseña.'} Es la misma con la
          que entras a la aplicación.
        </PasswordGateModal>
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
    </CollapsibleCard>
  );
}
