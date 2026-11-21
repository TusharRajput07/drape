import { createBrowserRouter, Navigate } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';
import {
  BuilderPage,
  ClosetPage,
  LikedPage,
  LoginPage,
  LookbooksPage,
  OutfitsPage,
  SettingsPage,
  SignupPage,
  StatsPage,
  WishlistPage,
} from './pages';

// All routes (03 §3). Details, filters, uploads and confirmations are sheets, not routes.
// Each page is lazy-loaded (app/pages.tsx).
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <ClosetPage /> },
          { path: '/outfits', element: <OutfitsPage /> },
          { path: '/liked', element: <LikedPage /> },
          { path: '/wishlist', element: <WishlistPage /> },
          { path: '/lookbooks', element: <LookbooksPage /> },
          { path: '/stats', element: <StatsPage /> },
          { path: '/settings', element: <SettingsPage /> },
        ],
      },
      // The builder is full screen: no bottom nav.
      { path: '/outfits/new', element: <BuilderPage /> },
      { path: '/outfits/:id/edit', element: <BuilderPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
