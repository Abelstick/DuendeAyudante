import { Gift, Plus, Settings, Users } from 'lucide-react';
import { useEventScope } from '@/app/layout/EventLayout';
import { FAMILY_COLORS } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { useEventWishlist } from '@/modules/wishlist/presentation/hooks';
import { formatMoney } from '@/shared/lib/money';
import { ButtonLink } from '@/shared/ui/Button';
import { Card, SectionTitle } from '@/shared/ui/Card';
import { toTitleCase } from '@/shared/validation/names';
import { canManageEvent } from '../domain/Event';
import { ChecklistCard } from '@/modules/checklist/presentation/ChecklistCard';
import { Countdown } from './Countdown';

export function HomePage() {
  const { event, context } = useEventScope();
  const families = useFamilies(event.id);
  const participants = useParticipants(event.id);
  const wishlist = useEventWishlist(event.id);

  const base = `/e/${event.id}`;
  const me = context.me;
  const myFamily = families.data?.find((f) => f.id === me?.familyId);
  const myWishCount = (wishlist.data ?? []).filter((w) => w.participantId === me?.id).length;
  const isManager = canManageEvent(context.role);
  const budget = event.giftExchange?.budgetMax;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-brand">¡Hola{me ? `, ${toTitleCase(me.firstName)}` : ''}! 👋</h1>

      <Countdown target={event.celebrationAt} timezone={event.timezone} />

      <ChecklistCard />

      {/* Acción principal: registrar regalos */}
      <Card className="space-y-3">
        <SectionTitle>
          <span className="flex items-center gap-2">
            <Gift className="size-6 text-berry-600" aria-hidden /> Mis regalos
          </span>
        </SectionTitle>
        {myWishCount === 0 ? (
          <p className="text-lg">¡Cuéntanos qué regalos te gustaría recibir! 🎁</p>
        ) : (
          <p className="text-lg">
            Tienes <strong>{myWishCount}</strong> {myWishCount === 1 ? 'regalo guardado' : 'regalos guardados'}. ¡Puedes agregar más!
          </p>
        )}
        {budget != null && <p className="text-base text-ink-700">Presupuesto del intercambio: {formatMoney(budget, event.currency)}</p>}
        <ButtonLink to={`${base}/regalos?agregar=1`} size="lg" icon={<Plus className="size-6" aria-hidden />}>
          Agregar regalo
        </ButtonLink>
        {context.wards.length > 0 && (
          <p className="text-base text-ink-700">
            También puedes agregar los regalos de {context.wards.map((w) => toTitleCase(w.firstName)).join(' y ')}.
          </p>
        )}
      </Card>

      {myFamily && (
        <Card className="space-y-2" style={{ borderColor: FAMILY_COLORS[myFamily.color].swatch, borderWidth: 2 }}>
          <SectionTitle>Mi familia</SectionTitle>
          <FamilyBadge family={myFamily} showColorName />
          <p className="text-base text-ink-700">
            Color de tu familia: <strong>{FAMILY_COLORS[myFamily.color].label}</strong>
            {myFamily.dressCodeNote ? ` · ${myFamily.dressCodeNote}` : ''}
          </p>
        </Card>
      )}

      <Card className="flex items-center gap-4">
        <Users className="size-10 shrink-0 text-brand" aria-hidden />
        <p className="text-lg">
          <strong>{participants.data?.length ?? '…'}</strong> integrantes en <strong>{families.data?.length ?? '…'}</strong>{' '}
          {families.data?.length === 1 ? 'familia' : 'familias'}
        </p>
      </Card>

      {isManager && (
        <Card className="space-y-3 border-2 border-gold-400 bg-gold-100/40">
          <SectionTitle>Organizar</SectionTitle>
          <p className="text-base text-ink-700">Agrega familias e integrantes y envíales su acceso por WhatsApp.</p>
          <ButtonLink to={`${base}/organizar`} variant="secondary" icon={<Settings className="size-5" aria-hidden />}>
            Ir a Organizar
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
