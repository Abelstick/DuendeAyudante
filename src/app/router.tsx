import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router-dom';
import { WelcomePage } from '@/modules/accounts/presentation/WelcomePage';
import { HomePage } from '@/modules/events/presentation/HomePage';
import { FamilyLinkPage } from '@/modules/family-access/presentation/FamilyLinkPage';
import { RequireAuth } from './AuthContext';
import { EventLayout } from './layout/EventLayout';
import { FullPageSpinner } from './layout/FullPageSpinner';
import { clearStaleChunkReload, RouteErrorPage } from './layout/RouteErrorPage';

/**
 * Carga por partes: cada pantalla poco frecuente se descarga recién al abrirla,
 * así la primera visita (bienvenida, entrar, enlace de familia, inicio) pesa menos.
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return lazy(() =>
    load().then((m) => {
      clearStaleChunkReload(); // cargó bien: la próxima versión nueva puede recargar sola otra vez
      return { default: pick(m) };
    }),
  );
}

const LoginPage = page(() => import('@/modules/accounts/presentation/LoginPage'), (m) => m.LoginPage);
const SignUpPage = page(() => import('@/modules/accounts/presentation/SignUpPage'), (m) => m.SignUpPage);
const RecoverPage = page(() => import('@/modules/accounts/presentation/RecoverPage'), (m) => m.RecoverPage);
const NewPasswordPage = page(() => import('@/modules/accounts/presentation/NewPasswordPage'), (m) => m.NewPasswordPage);
const ProfilePage = page(() => import('@/modules/accounts/presentation/ProfilePage'), (m) => m.ProfilePage);
const CreateEventPage = page(() => import('@/modules/events/presentation/CreateEventPage'), (m) => m.CreateEventPage);
const MyEventsPage = page(() => import('@/modules/events/presentation/MyEventsPage'), (m) => m.MyEventsPage);
const CelebrationPage = page(() => import('@/modules/events/presentation/CelebrationPage'), (m) => m.CelebrationPage);
const RecapPage = page(() => import('@/modules/events/presentation/RecapPage'), (m) => m.RecapPage);
const TvPage = page(() => import('@/modules/events/presentation/TvPage'), (m) => m.TvPage);
const OrganizePage = page(() => import('@/modules/admin/presentation/OrganizePage'), (m) => m.OrganizePage);
const GamesPage = page(() => import('@/modules/games/presentation/GamesPage'), (m) => m.GamesPage);
const AnnouncementsPage = page(() => import('@/modules/announcements/presentation/AnnouncementsPage'), (m) => m.AnnouncementsPage);
const MessagesPage = page(() => import('@/modules/messages/presentation/MessagesPage'), (m) => m.MessagesPage);
const GiftsPage = page(() => import('@/modules/wishlist/presentation/GiftsPage'), (m) => m.GiftsPage);
const PersonGiftsPage = page(() => import('@/modules/wishlist/presentation/PersonGiftsPage'), (m) => m.PersonGiftsPage);

/**
 * Raíz: al entrar a otra sección se empieza desde arriba; con «Atrás» se vuelve a
 * donde estaba. Los cambios de pestaña dentro de una página (?vista=) no mueven el scroll.
 */
function RootLayout() {
  return (
    <>
      <ScrollRestoration />
      <Suspense fallback={<FullPageSpinner />}>
        <Outlet />
      </Suspense>
    </>
  );
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: '/', element: <WelcomePage /> },
      { path: '/entrar', element: <LoginPage /> },
      { path: '/registro', element: <SignUpPage /> },
      { path: '/recuperar', element: <RecoverPage /> },
      // Enlace de la familia: palabra secreta + elegir el nombre (sin usuario ni contraseña)
      { path: '/f/:token', element: <FamilyLinkPage /> },
      {
        path: '/nueva-contrasena',
        element: (
          <RequireAuth>
            <NewPasswordPage />
          </RequireAuth>
        ),
      },
      {
        path: '/crear',
        element: (
          <RequireAuth>
            <CreateEventPage />
          </RequireAuth>
        ),
      },
      {
        path: '/mis-navidades',
        element: (
          <RequireAuth>
            <MyEventsPage />
          </RequireAuth>
        ),
      },
      // Pantalla para la tele: a pantalla completa, sin menús
      {
        path: '/e/:eventId/tv',
        element: (
          <RequireAuth>
            <TvPage />
          </RequireAuth>
        ),
      },
      {
        path: '/e/:eventId',
        element: (
          <RequireAuth>
            <EventLayout />
          </RequireAuth>
        ),
        children: [
          {
            // Si una sección falla, el error se muestra con el menú alrededor
            errorElement: <RouteErrorPage />,
            children: [
              { index: true, element: <HomePage /> },
              { path: 'regalos', element: <GiftsPage /> },
              { path: 'regalos/persona/:participantId', element: <PersonGiftsPage /> },
              { path: 'juegos', element: <GamesPage /> },
              { path: 'celebracion', element: <CelebrationPage /> },
              { path: 'anuncios', element: <AnnouncementsPage /> },
              { path: 'mensajes', element: <MessagesPage /> },
              { path: 'recuerdos', element: <RecapPage /> },
              { path: 'organizar', element: <OrganizePage /> },
              { path: 'perfil', element: <ProfilePage /> },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
