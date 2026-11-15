import { Dices, Gift, LogIn, PartyPopper, Sparkles } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/app/AuthContext';
import { FullPageSpinner } from '@/app/layout/FullPageSpinner';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { useMyEvents } from '@/modules/events/presentation/hooks';
import { ButtonLink } from '@/shared/ui/Button';
import { Card, Notice } from '@/shared/ui/Card';
import { errorMessage } from '@/shared/ui/errorMessages';

/** "/" — sin sesión muestra la bienvenida; con sesión lleva a su Navidad. */
export function WelcomePage() {
  const { user, loading } = useAuth();
  const events = useMyEvents(Boolean(user));

  if (loading || (user && events.isLoading)) return <FullPageSpinner />;

  if (user) {
    if (events.error) {
      return (
        <PublicLayout>
          <Notice tone="error">{errorMessage(events.error)}</Notice>
        </PublicLayout>
      );
    }
    const list = events.data ?? [];
    if (list.length === 1 && list[0]) return <Navigate to={`/e/${list[0].event.id}`} replace />;
    if (list.length > 1) return <Navigate to="/mis-navidades" replace />;
    return <Navigate to="/crear" replace />;
  }

  return (
    <PublicLayout>
      <Card className="space-y-4 text-center">
        <h1 className="text-3xl font-black text-ink-900">¡Bienvenido! 🎁</h1>
        <p className="text-lg text-ink-700">
          Aquí tu familia registra los regalos que le gustaría recibir y se organiza para celebrar la Navidad juntos.
        </p>
        <ul className="grid grid-cols-3 gap-2 text-sm font-bold" aria-label="Qué puedes hacer">
          <li className="flex flex-col items-center gap-1 rounded-xl border-2 border-night-900 bg-berry-50 px-1 py-3 text-berry-700">
            <Gift className="size-7" aria-hidden /> Regalos
          </li>
          <li className="flex flex-col items-center gap-1 rounded-xl border-2 border-night-900 bg-night-50 px-1 py-3 text-night-700">
            <Dices className="size-7" aria-hidden /> Juegos
          </li>
          <li className="flex flex-col items-center gap-1 rounded-xl border-2 border-night-900 bg-pine-100 px-1 py-3 text-pine-700">
            <PartyPopper className="size-7" aria-hidden /> Celebración
          </li>
        </ul>
        <ButtonLink to="/entrar" size="lg" icon={<LogIn className="size-6" aria-hidden />}>
          Entrar
        </ButtonLink>
        <p className="text-base text-ink-700">¿Te enviaron un usuario y una contraseña por WhatsApp? Toca «Entrar».</p>
      </Card>

      <div className="mt-8 space-y-3 text-center">
        <p className="text-base text-ink-700">¿Quieres organizar la Navidad de tu familia?</p>
        <ButtonLink to="/registro" variant="secondary" size="lg" icon={<Sparkles className="size-6" aria-hidden />}>
          Crear mi Navidad
        </ButtonLink>
      </div>
    </PublicLayout>
  );
}
