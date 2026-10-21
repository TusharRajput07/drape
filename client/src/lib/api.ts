import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { queryClient } from '@/app/query-client';
import { useAuthStore } from '@/features/auth/auth.store';
import { ApiError, type Failure, type Success } from './api-types';

// The one Axios instance (03 §5). Success resolves to the envelope; failure rejects with ApiError.

const baseURL = import.meta.env.VITE_API_URL;

export const api = axios.create({ baseURL, withCredentials: true });

type RetryConfig = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

export function toApiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const res = (err as AxiosError<Failure>).response;
  const body = res?.data?.error;
  if (res && body?.code) return new ApiError(res.status, body.code, body.message, body.details);
  if (res) return new ApiError(res.status, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
  return new ApiError(0, 'INTERNAL_ERROR', 'Something went wrong. Try again.');
}

// Single flight: every caller that needs a new token while one refresh is running waits for it.
let refreshing: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  refreshing ??= axios
    .post<Success<{ accessToken: string }>>(`${baseURL}/auth/refresh`, null, {
      withCredentials: true,
    })
    .then((res) => {
      const token = res.data.data.accessToken;
      useAuthStore.getState().signIn(token);
      return token;
    })
    .catch((err: unknown) => {
      throw toApiError(err);
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// The session is over: forget the token and every cached answer. ProtectedRoute then sends the user to /login.
export function endSession() {
  useAuthStore.getState().signOut();
  queryClient.clear();
}

api.interceptors.response.use(
  (res) => res.data,
  async (err: AxiosError<Failure>) => {
    const original = err.config as RetryConfig | undefined;
    const code = err.response?.data?.error?.code;

    if (code === 'TOKEN_EXPIRED' && original && !original._retried) {
      original._retried = true;
      try {
        await refreshAccessToken();
      } catch (refreshErr) {
        const apiErr = toApiError(refreshErr);
        if (!apiErr.isNetwork) endSession();
        throw apiErr;
      }
      return api(original);
    }

    if (code === 'SESSION_EXPIRED' || code === 'UNAUTHENTICATED') endSession();
    throw toApiError(err);
  },
);
