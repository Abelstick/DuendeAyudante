import { ChevronRight, Settings, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEventScope } from '@/app/layout/EventLayout';
import { AnnouncementsHomeCard } from '@/modules/announcements/presentation/AnnouncementsHomeCard';
import { ChecklistCard } from '@/modules/checklist/presentation/ChecklistCard';
import { FAMILY_COLORS } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { GamesTeaserCard } from '@/modules/games/presentation/GamesTeaserCard';
import { useParticipants } from '@/modules/members/presentation/hooks';
import { MyResponsibilitiesCard } from '@/modules/responsibilities/presentation/MyResponsibilitiesCard';
import { NowNextCard } from '@/modules/schedule/presentation/NowNextCard';
import { SecretFriendCard } from '@/modules/secret-friend/presentation/SecretFriendCard';
import { formatMoney } from '@/shared/lib/money';
import { Avatar } from '@/shared/ui/Avatar';
import { ButtonLink } from '@/shared/ui/Button';
import { Card, CardTitle } from '@/shared/ui/Card';
import { toTitleCase } from '@/shared/validation/names';
import { canManageEvent, ROLE_LABELS } from '../domain/Event';
import { Countdown } from './Countdown';
import { QuickAccessGrid } from './QuickAccessGrid';

/**
 * Inicio: de arriba hacia abajo responde "¿quién soy?", "¿cuánto falta?",
 * "¿qué hay de nuevo?", "¿a dónde puedo ir?" y "¿qué me toca hacer?".
 */
export function HomePage() {
  const { event, context } = useEventScope();
  const families = useFamilies(event.id);
  const participants = useParticipants(event.id);

  const base = `/e/${event.id}`;
  const me = context.me;
  const myFamily = families.data?.find((f) => f.id === me?.familyId);
  const familyColor = myFamily ? FAMILY_COLORS[myFamily.color] : undefined;
  const isManager = canManageEvent(context.role);
  const budget = event.giftExchange?.budgetMax;
  const familyCount = families.data?.length;

  return (
    <div className="space-y-5">
      {/* 1 · Saludo y perfil */}
      <header>
        <Link to={`${base}/perfil`} className="tap-card flex min-h-16 items-center gap-3 rounded-2xl" aria-label="Ver mi perfil">
          <Avatar name={me?.fullName ?? event.organizerName} colors={familyColor && { bg: familyColor.soft, fg: familyColor.text }} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-black leading-tight text-ink-900">¡Hola{me ? `, ${toTitleCase(me.firstName)}` : ''}! 👋</h1>
            <span className="flex items-center gap-0.5 text-base font-bold text-brand">
              Ver mi perfil
              <ChevronRight className="size-5 shrink-0" aria-hidden />
            </span>
          </div>
        </Link>
        {myFamily && (
          <p className="mt-2">
            <FamilyBadge family={myFamily} />
            {context.role !== 'participant' && <span className="ml-2 text-sm font-bold text-ink-700">· {ROLE_LABELS[context.role]}</span>}
          </p>
        )}
      </header>

      {/* 2 · Banner con la cuenta regresiva */}
      <Countdown target={event.celebrationAt} timezone={event.timezone} title={event.name} description={event.description} />

      <NowNextCard />

      {/* 3 · Anuncios */}
      <AnnouncementsHomeCard />

      {/* 4 · Accesos rápidos */}
      <QuickAccessGrid />

      <GamesTeaserCard />

      {/* 5 · Mi participación */}
      <ChecklistCard />

      <SecretFriendCard />

      <MyResponsibilitiesCard />

      {/* Mi familia y el grupo */}
      <Card className="space-y-3">
        <CardTitle icon={<Users className="size-6" />}>{myFamily ? 'Mi familia' : 'Nuestra Navidad'}</CardTitle>
        {myFamily && familyColor && (
          <div className="rounded-2xl p-4" style={{ backgroundColor: familyColor.soft, color: familyColor.text }}>
            <p className="flex items-center gap-2 text-lg font-extrabold">
              <span className="size-5 rounded-full border-2 border-white shadow-card" style={{ backgroundColor: familyColor.swatch }} aria-hidden />
              Familia {myFamily.name}
            </p>
            <p className="text-base">
              Su color es el <strong>{familyColor.label.toLowerCase()}</strong>
              {myFamily.dressCodeNote ? ` · 👕 ${myFamily.dressCodeNote}` : ''}
            </p>
          </div>
        )}
        <p className="text-base text-ink-700">
          Somos <strong className="text-ink-900">{participants.data?.length ?? '…'}</strong> integrantes en{' '}
          <strong className="text-ink-900">{familyCount ?? '…'}</strong> {familyCount === 1 ? 'familia' : 'familias'}.
          {budget != null && (
            <>
              {' '}
              Presupuesto del intercambio: <strong className="text-ink-900">{formatMoney(budget, event.currency)}</strong>.
            </>
          )}
        </p>
        <ButtonLink to={`${base}/celebracion?vista=familias`} variant="secondary" icon={<ChevronRight className="size-5" aria-hidden />}>
          Ver las familias
        </ButtonLink>
      </Card>

      {/* Solo para quien administra */}
      {isManager && (
        <Card className="space-y-3 border-2 border-gold-400! bg-gold-50">
          <CardTitle icon={<Settings className="size-6" />} tone="gold">
            Organizar la Navidad
          </CardTitle>
          <p className="text-base text-ink-700">Agrega familias e integrantes y envíales su acceso por WhatsApp.</p>
          <ButtonLink to={`${base}/organizar`} variant="gold" icon={<Settings className="size-5" aria-hidden />}>
            Ir a Organizar
          </ButtonLink>
        </Card>
      )}
    </div>
  );
}
