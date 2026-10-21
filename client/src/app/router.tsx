import { createBrowserRouter, Navigate } from 'react-router';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { BuilderPage } from '@/features/builder/BuilderPage';
import { ClosetPage } from '@/features/closet/ClosetPage';
import { LikedPage } from '@/features/liked/LikedPage';
import { LookbooksPage } from '@/features/looks/LookbooksPage';
import { OutfitsPage } from '@/features/outfits/OutfitsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { StatsPage } from '@/features/stats/StatsPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ProtectedRoute } from './layouts/ProtectedRoute';

// All routes (03 §3). Details, filters, uploads and confirmations are sheets, not routes.
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
