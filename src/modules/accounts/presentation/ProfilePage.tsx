import { ChevronRight, KeyRound, LogOut, Type, UserRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { useEventScope } from '@/app/layout/EventLayout';
import { ROLE_LABELS } from '@/modules/events/domain/Event';
import { useMyEvents } from '@/modules/events/presentation/hooks';
import { FAMILY_COLORS } from '@/modules/families/domain/Family';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card, CardTitle, PageTitle, Pill } from '@/shared/ui/Card';
import { applyTextSize, getTextSize, type TextSize } from '@/shared/ui/textSize';
import { ChangePasswordForm } from './ChangePasswordForm';

export function ProfilePage() {
  const { event, context } = useEventScope();
  const { user } = useAuth();
  const { auth } = useServices();
  const navigate = useNavigate();
  const families = useFamilies(event.id);
  const myEvents = useMyEvents();
  const [textSize, setTextSize] = useState<TextSize>(getTextSize);
  const [changing, setChanging] = useState(false);

  const me = context.me;
  const family = families.data?.find((f) => f.id === me?.familyId);

  const chooseSize = (size: TextSize) => {
    setTextSize(size);
    applyTextSize(size);
  };

  const signOut = async () => {
    await auth.signOut();
    navigate('/', { replace: true });
  };

  return (
    <div className="space-y-5">
      <PageTitle icon={<UserRound className="size-8" aria-hidden />} title="Mi perfil" />

      <Card className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar
            name={me?.fullName ?? event.organizerName}
            size="lg"
            colors={family && { bg: FAMILY_COLORS[family.color].soft, fg: FAMILY_COLORS[family.color].text }}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-xl font-black leading-tight text-ink-900">{me ? displayName(me) : 'Organizador'}</p>
            <Pill tone={context.role === 'participant' ? 'neutral' : 'gold'}>{ROLE_LABELS[context.role]}</Pill>
          </div>
        </div>
        {me && <FamilyBadge family={family} showColorName />}
        <dl className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-2xl bg-mist-100 px-4 py-3">
            <dt className="text-sm font-bold text-ink-500">Código de tu Navidad</dt>
            <dd className="text-lg font-black tracking-wider text-ink-900">{event.joinCode}</dd>
          </div>
          <div className="rounded-2xl bg-mist-100 px-4 py-3">
            <dt className="text-sm font-bold text-ink-500">Tu usuario</dt>
            <dd className="break-all text-lg font-black text-ink-900">{user?.loginName}</dd>
          </div>
        </dl>
        {context.wards.length > 0 && (
          <p className="text-base text-ink-700">
            <strong className="text-ink-900">A tu cargo:</strong> {context.wards.map((w) => displayName(w)).join(', ')}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <CardTitle icon={<Type className="size-6" />} tone="night">
          Tamaño de la letra
        </CardTitle>
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Tamaño de la letra">
          {(
            [
              ['normal', 'Normal'],
              ['large', 'Grande'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={textSize === value}
              onClick={() => chooseSize(value)}
              className={`min-h-14 rounded-2xl border-2 font-extrabold transition-colors ${
                textSize === value ? 'border-brand bg-brand text-white' : 'border-mist-300 bg-white text-ink-900 hover:border-brand'
              } ${value === 'large' ? 'text-xl' : 'text-base'}`}
            >
              {textSize === value ? '✓ ' : ''}
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle icon={<KeyRound className="size-6" />} tone="night">
          Mi contraseña
        </CardTitle>
        {changing ? (
          <ChangePasswordForm onDone={() => setChanging(false)} />
        ) : (
          <>
            <p className="text-base text-ink-700">Si quieres, puedes cambiar la contraseña que te enviaron. No es obligatorio.</p>
            <Button variant="secondary" onClick={() => setChanging(true)}>
              Cambiar mi contraseña
            </Button>
          </>
        )}
      </Card>

      {(myEvents.data?.length ?? 0) > 1 && (
        <Link
          to="/mis-navidades"
          className="tap-card flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-mist-200 bg-white px-5 text-lg font-bold text-brand shadow-card"
        >
          Ver mis otras Navidades
          <ChevronRight className="size-6" aria-hidden />
        </Link>
      )}

      <Button variant="secondary" size="lg" onClick={signOut} icon={<LogOut className="size-6" aria-hidden />} className="text-berry-700!">
        Cerrar sesión
      </Button>
    </div>
  );
}
