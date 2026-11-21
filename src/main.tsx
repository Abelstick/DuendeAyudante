import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/app/AuthContext';
import { createContainer } from '@/app/container';
import { ContainerProvider } from '@/app/ContainerContext';
import { router } from '@/app/router';
import { env } from '@/shared/config/env';
import { PhotoQueueRunner } from '@/modules/wishlist/presentation/photoQueue';
import { InstallPrompt } from '@/shared/pwa/InstallPrompt';
import { setupPwa } from '@/shared/pwa/install';
import { installKeyboardTracking } from '@/shared/lib/virtualKeyboard';
import { ToastProvider } from '@/shared/ui/Toast';
import { applyTextSize, getTextSize } from '@/shared/ui/textSize';
import { applyColorScheme, getColorScheme } from '@/shared/ui/colorScheme';
import { installFamilyPalette } from '@/modules/families/presentation/familyTheme';
import './index.css';

applyTextSize(getTextSize());
applyColorScheme(getColorScheme());
installFamilyPalette();
setupPwa();
installKeyboardTracking();

const root = createRoot(document.getElementById('root')!);

if (!env.isConfigured) {
  root.render(
    <main style={{ maxWidth: 560, margin: '40px auto', padding: 16, fontSize: 18 }}>
      <h1>🎄 Falta configurar la aplicación</h1>
      <p>
        Crea el archivo <code>.env.local</code> copiando <code>.env.example</code> y completa <code>VITE_SUPABASE_URL</code> y{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. Luego reinicia <code>npm run dev</code>.
      </p>
    </main>,
  );
} else {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true },
    },
  });

  root.render(
    <StrictMode>
      <ContainerProvider container={createContainer()}>
        <QueryClientProvider client={queryClient}>
          <MotionConfig reducedMotion="user">
            <ToastProvider>
              <AuthProvider>
                <RouterProvider router={router} />
                <InstallPrompt />
                {/* Sube en segundo plano las fotos de los regalos (sigue aunque se cierre el formulario) */}
                <PhotoQueueRunner />
              </AuthProvider>
            </ToastProvider>
          </MotionConfig>
        </QueryClientProvider>
      </ContainerProvider>
    </StrictMode>,
  );
}
