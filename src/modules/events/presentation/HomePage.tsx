import { ChevronRight, LayoutGrid, Settings, Sparkles, Users } from 'lucide-react';
import { MessagesHomeCard } from '@/modules/messages/presentation/MessagesHomeCard';
import { AddressCard } from './AddressCard';
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
import { GiftsHomeCard } from '@/modules/wishlist/presentation/GiftsHomeCard';
import { SecretFriendCard } from '@/modules/secret-friend/presentation/SecretFriendCard';
import { formatMoney } from '@/shared/lib/money';
import { Avatar } from '@/shared/ui/Avatar';
import { ButtonLink } from '@/shared/ui/Button';
import { CollapsibleCard } from '@/shared/ui/CollapsibleCard';
import { TourButton } from '@/shared/ui/TourButton';
import type { TourStep } from '@/shared/tour/tour';
import { toTitleCase } from '@/shared/validation/names';
import { canManageEvent, ROLE_LABELS } from '../domain/Event';
import { Countdown } from './Countdown';
import { QuickAccessGrid } from './QuickAccessGrid';

/** Guía del inicio: solo se abre si la persona toca «¿No sabes cómo empezar?». */
const HOME_TOUR: TourStep[] = [
  {
    title: '¡Te damos la bienvenida! 🎄',
    text: 'En menos de un minuto te mostramos lo principal. Toca «Siguiente» para avanzar, o la ✕ para salir cuando quieras.',
  },
  {
    target: 'inicio-cuenta',
    title: 'Cuánto falta',
    text: 'Aquí ves cuántos días faltan para la celebración y la fecha del encuentro.',
  },
  {
    target: 'inicio-direccion',
    title: '¿Dónde es?',
    text: 'Aquí está de quién es la casa y la dirección. Al abrir la tarjeta verás botones para llegar con Google Maps o Waze.',
  },
  {
    target: 'inicio-accesos',
    title: 'Accesos rápidos',
    text: 'Las tarjetas como esta se abren y se cierran tocando su título. Dentro de esta hay botones grandes para ir a regalos, juegos, tareas y horarios.',
  },
  {
    target: 'inicio-regalos',
    title: 'Tu lista de regalos',
    text: 'Lo primero que te conviene hacer: abre esta tarjeta y agrega lo que te gustaría recibir. También puedes ver qué quieren los demás.',
  },
  {
    target: 'inicio-preparacion',
    title: 'Tu preparación',
    text: 'Una lista corta de lo que te falta hacer antes de la celebración. Se va marcando a medida que avanzas.',
  },
  {
    target: 'menu',
    title: 'El menú',
    text: 'Con este menú vas a cada parte: Inicio, Regalos, Juegos, Celebración y tu Perfil. Siempre está a la vista.',
  },
  {
    title: '¡Eso es todo!',
    text: 'En Regalos y en Juegos también hay un botón de ayuda como este, que te explica cada pantalla paso a paso.',
  },
];

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

      {/* Ayuda opcional: la guía solo empieza si la persona la pide */}
      <TourButton label="¿No sabes cómo empezar? Toca aquí y te guiamos" steps={HOME_TOUR} />

      {/* 2 · Banner con la cuenta regresiva */}
      <div data-tour="inicio-cuenta">
        <Countdown target={event.celebrationAt} timezone={event.timezone} title={event.name} description={event.description} budget={budget} currency={event.currency} />
      </div>

      {/* Ya empezó la celebración: los recuerdos del año */}
      {event.celebrationAt.getTime() <= Date.now() && (
        <Link
          to={`${base}/recuerdos`}
          className="tap-card flex items-center gap-3 rounded-2xl border-2 border-night-900 bg-gold-50 p-4 shadow-block active:shadow-none"
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-night-900 bg-gold-400 text-night-900" aria-hidden>
            <Sparkles className="size-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold text-ink-900">Recuerdos de esta Navidad</span>
            <span className="block text-sm font-semibold text-ink-700">Cuántos fuimos, el juego favorito y más, para compartir</span>
          </span>
          <ChevronRight className="size-6 shrink-0 text-brand" aria-hidden />
        </Link>
      )}

      <NowNextCard />

      <AddressCard />

      {/* 3 · Anuncios */}
      <AnnouncementsHomeCard />

      {/* 4 · Accesos rápidos (Regalos, Juegos, Aportes y tareas, Cronograma), contraídos para que el inicio sea corto */}
      <CollapsibleCard id="inicio:accesos" tourId="inicio-accesos" icon={<LayoutGrid className="size-6" />} tone="gold" title="Accesos rápidos" action={<span className="text-sm font-semibold text-ink-700">Regalos, juegos, tareas y horarios</span>}>
        <QuickAccessGrid />
      </CollapsibleCard>

      {/* Regalos a la mano: mi lista y las de los demás */}
      <GiftsHomeCard />

      <GamesTeaserCard />

      {/* 5 · Mi participación */}
      <ChecklistCard />

      <SecretFriendCard />

      <MessagesHomeCard />

      <MyResponsibilitiesCard />

      {/* Mi familia y el grupo */}
      <CollapsibleCard id="inicio:familia" icon={<Users className="size-6" />} title={myFamily ? 'Mi familia' : 'Nuestra Navidad'}>
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
      </CollapsibleCard>

      {/* Solo para quien administra */}
      {isManager && (
        <CollapsibleCard id="inicio:organizar" icon={<Settings className="size-6" />} tone="gold" title="Organizar la Navidad" className="border-gold-400! bg-gold-50">
          <p className="text-base text-ink-700">Agrega familias e integrantes y envíales su acceso por WhatsApp.</p>
          <ButtonLink to={`${base}/organizar`} variant="gold" icon={<Settings className="size-5" aria-hidden />}>
            Ir a Organizar
          </ButtonLink>
        </CollapsibleCard>
      )}
    </div>
  );
}
