import { Bell, ChevronRight, KeyRound, LogOut, MonitorSmartphone, Moon, Sun, SunMoon, Type, UserRound, UserRoundX, Volume2, VolumeX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { useServices } from '@/app/ContainerContext';
import { useEventScope } from '@/app/layout/EventLayout';
import { ROLE_LABELS } from '@/modules/events/domain/Event';
import { useMyEvents } from '@/modules/events/presentation/hooks';
import { FAMILY_COLORS } from '@/modules/families/presentation/familyTheme';
import { FamilyBadge } from '@/modules/families/presentation/FamilyBadge';
import { useFamilies } from '@/modules/families/presentation/hooks';
import { displayName } from '@/modules/members/domain/Participant';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Card, CardTitle, PageTitle, Pill } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { useSoundEnabled } from '@/shared/ui/SoundToggle';
import { applyColorScheme, getColorScheme, type ColorSchemePreference } from '@/shared/ui/colorScheme';
import { applyTextSize, getTextSize, type TextSize } from '@/shared/ui/textSize';
import { ChangePasswordForm } from './ChangePasswordForm';
import { DisableAccountModal } from './DisableAccountModal';

export function ProfilePage() {
  const { event, context } = useEventScope();
  const { user } = useAuth();
  const { auth } = useServices();
  const navigate = useNavigate();
  const families = useFamilies(event.id);
  const myEvents = useMyEvents();
  const [textSize, setTextSize] = useState<TextSize>(getTextSize);
  const [colorScheme, setColorScheme] = useState<ColorSchemePreference>(getColorScheme);
  const [changing, setChanging] = useState(false);
  const [disablingAccount, setDisablingAccount] = useState(false);
  const [soundOn, setSoundOn] = useSoundEnabled();

  const me = context.me;
  const family = families.data?.find((f) => f.id === me?.familyId);

  const chooseSize = (size: TextSize) => {
    setTextSize(size);
    applyTextSize(size);
  };

  const chooseColorScheme = (preference: ColorSchemePreference) => {
    setColorScheme(preference);
    applyColorScheme(preference);
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
        <CardTitle icon={<SunMoon className="size-6" />} tone="night">
          Modo de color
        </CardTitle>
        <p className="text-base text-ink-700">El modo oscuro descansa la vista de noche. «Según el dispositivo» cambia solo, igual que tu celular o computadora.</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Modo de color">
          {(
            [
              ['light', 'Claro', Sun],
              ['dark', 'Oscuro', Moon],
              ['system', 'Según el dispositivo', MonitorSmartphone],
            ] as const
          ).map(([value, label, Icon]) => (
            <ChoiceTile key={value} selected={colorScheme === value} onSelect={() => chooseColorScheme(value)} label={label}>
              <Icon className="size-6" aria-hidden />
            </ChoiceTile>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle icon={<Type className="size-6" />} tone="night">
          Tamaño de la letra
        </CardTitle>
        <p className="text-base text-ink-700">Si ya agrandaste la letra en tu celular y aquí se ve muy grande, elige «Compacta».</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tamaño de la letra">
          {(
            [
              ['compact', 'Compacta', 'text-sm'],
              ['normal', 'Normal', 'text-base'],
              ['large', 'Grande', 'text-xl'],
            ] as const
          ).map(([value, label, size]) => (
            <ChoiceTile key={value} selected={textSize === value} onSelect={() => chooseSize(value)} label={label}>
              {/* Muestra de cómo se ve cada tamaño */}
              <span className={`${size} leading-none`} aria-hidden>
                Aa
              </span>
            </ChoiceTile>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle icon={<Bell className="size-6" />} tone="gold">
          Sonidos
        </CardTitle>
        <p className="text-base text-ink-700">Campanitas al completar una tarea, guardar un regalo o girar la ruleta.</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Sonidos">
          {(
            [
              [true, 'Con sonido', Volume2],
              [false, 'Sin sonido', VolumeX],
            ] as const
          ).map(([value, label, Icon]) => (
            <ChoiceTile key={label} selected={soundOn === value} onSelect={() => setSoundOn(value)} label={label}>
              <Icon className="size-6" aria-hidden />
            </ChoiceTile>
          ))}
        </div>
      </Card>

      <Card className="space-y-3">
        <CardTitle icon={<KeyRound className="size-6" />} tone="night">
          Mi contraseña
        </CardTitle>
        <p className="text-base text-ink-700">Si quieres, puedes cambiar la contraseña que te enviaron. No es obligatorio.</p>
        <Button variant="secondary" onClick={() => setChanging(true)}>
          Cambiar mi contraseña
        </Button>
        {changing && (
          <Modal open title="Cambiar mi contraseña" onClose={() => setChanging(false)}>
            <ChangePasswordForm onDone={() => setChanging(false)} />
          </Modal>
        )}
      </Card>

      {(myEvents.data?.length ?? 0) > 1 && (
        <Link
          to="/mis-navidades"
          className="tap-card flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-mist-300 bg-surface px-5 text-lg font-bold text-brand-ink shadow-card"
        >
          Ver mis otras Navidades
          <ChevronRight className="size-6" aria-hidden />
        </Link>
      )}

      <Button variant="secondary" size="lg" onClick={signOut} icon={<LogOut className="size-6" aria-hidden />} className="text-berry-700!">
        Cerrar sesión
      </Button>

      <section className="space-y-2 rounded-xl border-2 border-dashed border-berry-600/50 p-4" aria-labelledby="disable-account-title">
        <h2 id="disable-account-title" className="text-lg font-extrabold text-berry-700">
          Inhabilitar mi cuenta
        </h2>
        <p className="text-base text-ink-700">Dejas de poder entrar, pero no se borra nada. Quien organiza puede reactivarla cuando quieras volver.</p>
        <Button variant="ghost" onClick={() => setDisablingAccount(true)} icon={<UserRoundX className="size-5" aria-hidden />} className="text-berry-700!">
          Inhabilitar mi cuenta
        </Button>
      </section>
      {disablingAccount && <DisableAccountModal onClose={() => setDisablingAccount(false)} />}
    </div>
  );
}

/**
 * Opción de una preferencia (modo de color, letra, sonido): ficha con relieve, muestra arriba y
 * nombre abajo. La elegida toma el color de la familia y lleva ✓ (no depende solo del color).
 */
function ChoiceTile({ selected, onSelect, label, children }: { selected: boolean; onSelect: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`btn-3d font-display flex min-h-18 flex-col items-center justify-center gap-1 rounded-xl border-2 border-line px-1 py-2 text-center font-bold ${
        selected ? 'bg-brand text-white' : 'bg-surface text-heading hover:bg-brand-soft'
      }`}
    >
      {children}
      <span className="text-sm leading-tight">
        {selected ? '✓ ' : ''}
        {label}
      </span>
    </button>
  );
}
