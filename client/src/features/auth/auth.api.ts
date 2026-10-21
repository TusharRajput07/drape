import { useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { queryClient } from '@/app/query-client';
import { api, endSession, refreshAccessToken } from '@/lib/api';
import { ApiError, type Me, type Success } from '@/lib/api-types';
import { useOnline } from '@/lib/use-online';
import { useAuthStore } from './auth.store';
import type { LoginInput, SignupInput } from './schemas';

type Session = { accessToken: string; user: Me };

function startSession({ accessToken, user }: Session) {
  queryClient.setQueryData(['me'], user);
  useAuthStore.getState().signIn(accessToken);
}

// App start: the refresh cookie decides whether we're logged in (03 §5). While the phone is offline the
// status stays 'unknown' (the offline screen shows) and the check runs again once it's back online.
async function restoreSession() {
  try {
    await refreshAccessToken();
  } catch (err) {
    if (err instanceof ApiError && err.isNetwork && !navigator.onLine) return;
    useAuthStore.getState().signOut();
  }
}

export function useSessionStatus() {
  const status = useAuthStore((s) => s.status);
  const online = useOnline();
  useEffect(() => {
    if (status === 'unknown' && online) void restoreSession();
  }, [status, online]);
  return status;
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<unknown, Success<Session>>('/auth/login', input).then((res) => res.data),
    onSuccess: startSession,
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (input: SignupInput) =>
      api.post<unknown, Success<Session>>('/auth/signup', input).then((res) => res.data),
    onSuccess: startSession,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: endSession,
  });
}

export function useIsAuthed() {
  return useAuthStore((s) => s.status === 'authed');
}
