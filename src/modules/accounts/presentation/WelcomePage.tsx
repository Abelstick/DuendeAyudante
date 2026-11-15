import { LogIn, Sparkles } from 'lucide-react';
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
        <h1 className="text-2xl font-bold text-brand">¡Bienvenido! 🎁</h1>
        <p className="text-lg text-ink-700">
          Aquí tu familia registra los regalos que le gustaría recibir y se organiza para celebrar la Navidad juntos.
        </p>
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
