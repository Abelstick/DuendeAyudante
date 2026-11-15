import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/app/layout/PublicLayout';
import { Card } from '@/shared/ui/Card';
import { ChangePasswordForm } from './ChangePasswordForm';

/** Destino del enlace de recuperación por correo (organizadores). */
export function NewPasswordPage() {
  const navigate = useNavigate();
  return (
    <PublicLayout>
      <Card className="space-y-4">
        <h1 className="text-2xl font-bold text-pine-900">Crea tu nueva contraseña</h1>
        <ChangePasswordForm onDone={() => navigate('/', { replace: true })} />
      </Card>
    </PublicLayout>
  );
}
