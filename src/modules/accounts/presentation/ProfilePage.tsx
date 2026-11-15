import { LogOut, Type } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { useEventScope } from '@/app/layout/EventLayout';
import { ROLE_LABELS } from '@/modules/events/domain/Event';
import { useMyEvents } from '@/modules/events/presentation/hooks';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { Button } from '@/shared/ui/Button';
import { Card, PageTitle, SectionTitle } from '@/shared/ui/Card';
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
      <PageTitle title="Mi perfil" />

      <Card className="space-y-2">
        <p className="text-xl font-bold text-brand">{me ? displayName(me) : 'Organizador'}</p>
        {me && <FamilyBadge family={family} showColorName />}
        <p className="text-base text-ink-700">
          Código de tu Navidad: <strong className="tracking-wider">{event.joinCode}</strong>
        </p>
        <p className="text-base text-ink-700">
          Tu usuario: <strong>{user?.loginName}</strong> · {ROLE_LABELS[context.role]}
        </p>
        {context.wards.length > 0 && (
          <p className="text-base text-ink-700">A tu cargo: {context.wards.map((w) => displayName(w)).join(', ')}</p>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>
          <span className="flex items-center gap-2">
            <Type className="size-6" aria-hidden /> Tamaño de la letra
          </span>
        </SectionTitle>
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
              className={`min-h-14 rounded-2xl border-2 font-semibold ${
                textSize === value ? 'border-brand bg-brand text-white' : 'border-cream-200 bg-white text-ink-900'
              } ${value === 'large' ? 'text-xl' : 'text-base'}`}
            >
              {textSize === value ? '✓ ' : ''}
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>Mi contraseña</SectionTitle>
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
        <Link to="/mis-navidades" className="block min-h-12 text-lg font-semibold text-brand underline">
          Ver mis otras Navidades
        </Link>
      )}

      <Button variant="secondary" size="lg" onClick={signOut} icon={<LogOut className="size-6" aria-hidden />}>
        Cerrar sesión
      </Button>
    </div>
  );
}
