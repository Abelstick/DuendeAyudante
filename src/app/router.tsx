import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, ScrollRestoration } from 'react-router-dom';
import { LoginPage } from '@/modules/accounts/presentation/LoginPage';
import { ProfilePage } from '@/modules/accounts/presentation/ProfilePage';
import { WelcomePage } from '@/modules/accounts/presentation/WelcomePage';
import { CelebrationPage } from '@/modules/events/presentation/CelebrationPage';
import { HomePage } from '@/modules/events/presentation/HomePage';
import { FamilyLinkPage } from '@/modules/family-access/presentation/FamilyLinkPage';
import { GamesPage } from '@/modules/games/presentation/GamesPage';
import { GiftsPage } from '@/modules/wishlist/presentation/GiftsPage';
import { PersonGiftsPage } from '@/modules/wishlist/presentation/PersonGiftsPage';
import { RequireAuth } from './AuthContext';
import { EventLayout } from './layout/EventLayout';
import { FullPageSpinner } from './layout/FullPageSpinner';
import { clearStaleChunkReload, RouteErrorPage } from './layout/RouteErrorPage';
import { RARE_PAGES } from './prefetch';

/**
 * Las pantallas de todos los días (entrar, inicio y las del menú de abajo) vienen en
 * la carga inicial: abren al instante. Solo las poco frecuentes se descargan aparte
 * (y se adelantan en segundo plano, ver prefetch.ts).
 */
function page<M>(load: () => Promise<M>, pick: (m: M) => ComponentType) {
  return lazy(() =>
    load().then((m) => {
      clearStaleChunkReload(); // cargó bien: la próxima versión nueva puede recargar sola otra vez
      return { default: pick(m) };
    }),
  );
}

const SignUpPage = page(RARE_PAGES.signUp, (m) => m.SignUpPage);
const RecoverPage = page(RARE_PAGES.recover, (m) => m.RecoverPage);
const NewPasswordPage = page(RARE_PAGES.newPassword, (m) => m.NewPasswordPage);
const CreateEventPage = page(RARE_PAGES.createEvent, (m) => m.CreateEventPage);
const MyEventsPage = page(RARE_PAGES.myEvents, (m) => m.MyEventsPage);
const RecapPage = page(RARE_PAGES.recap, (m) => m.RecapPage);
const TvPage = page(RARE_PAGES.tv, (m) => m.TvPage);
const OrganizePage = page(RARE_PAGES.organize, (m) => m.OrganizePage);
const AnnouncementsPage = page(RARE_PAGES.announcements, (m) => m.AnnouncementsPage);
const MessagesPage = page(RARE_PAGES.messages, (m) => m.MessagesPage);

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
