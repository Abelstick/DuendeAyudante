import { createBrowserRouter, Navigate } from 'react-router-dom';
import { LoginPage } from '@/modules/accounts/presentation/LoginPage';
import { NewPasswordPage } from '@/modules/accounts/presentation/NewPasswordPage';
import { ProfilePage } from '@/modules/accounts/presentation/ProfilePage';
import { RecoverPage } from '@/modules/accounts/presentation/RecoverPage';
import { SignUpPage } from '@/modules/accounts/presentation/SignUpPage';
import { WelcomePage } from '@/modules/accounts/presentation/WelcomePage';
import { OrganizePage } from '@/modules/admin/presentation/OrganizePage';
import { CreateEventPage } from '@/modules/events/presentation/CreateEventPage';
import { HomePage } from '@/modules/events/presentation/HomePage';
import { GamesPage } from '@/modules/games/presentation/GamesPage';
import { MyEventsPage } from '@/modules/events/presentation/MyEventsPage';
import { AnnouncementsPage } from '@/modules/announcements/presentation/AnnouncementsPage';
import { CelebrationPage } from '@/modules/events/presentation/CelebrationPage';
import { GiftsPage } from '@/modules/wishlist/presentation/GiftsPage';
import { PersonGiftsPage } from '@/modules/wishlist/presentation/PersonGiftsPage';
import { RequireAuth } from './AuthContext';
import { EventLayout } from './layout/EventLayout';

export const router = createBrowserRouter([
  { path: '/', element: <WelcomePage /> },
  { path: '/entrar', element: <LoginPage /> },
  { path: '/registro', element: <SignUpPage /> },
  { path: '/recuperar', element: <RecoverPage /> },
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
  {
    path: '/e/:eventId',
    element: (
      <RequireAuth>
        <EventLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'regalos', element: <GiftsPage /> },
      { path: 'regalos/persona/:participantId', element: <PersonGiftsPage /> },
      { path: 'juegos', element: <GamesPage /> },
      { path: 'celebracion', element: <CelebrationPage /> },
      { path: 'anuncios', element: <AnnouncementsPage /> },
      { path: 'organizar', element: <OrganizePage /> },
      { path: 'perfil', element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
