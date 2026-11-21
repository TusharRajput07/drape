import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useIsAuthed } from '@/features/auth/auth.api';
import { api, endSession } from '@/lib/api';
import type { Me, Success } from '@/lib/api-types';
import { uploadImage } from '@/lib/cloudinary';

// The profile, settings and account (02 §8.3). Every answer is the fresh `Me`, which replaces ['me'].

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<unknown, Success<Me>>('/me').then((res) => res.data),
    enabled: useIsAuthed(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name?: string; username?: string }) =>
      api.patch<unknown, Success<Me>>('/me', body).then((res) => res.data),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

export type SettingsBody = Partial<Me['settings']>;

const SETTINGS_KEY = ['me', 'settings'];

type InstantSettings = Omit<Me['settings'], 'cityName'>;

// Accent, °C/°F and the location switch change on screen at once (the accent recolours the app);
// a city waits for the server, which looks it up. Several quick changes can be in flight together:
// - a failed one puts back only its own fields, and only those no later change has replaced;
// - while others are still running, an answer isn't written over the newer on-screen values;
// - when the last one settles, ['me'] is fetched again, so the screen ends on what the server saved
//   (answers can arrive in a different order from the one the server saved them in).
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const isLast = () => queryClient.isMutating({ mutationKey: SETTINGS_KEY }) <= 1;
  return useMutation({
    mutationKey: SETTINGS_KEY,
    mutationFn: (body: SettingsBody) =>
      api.patch<unknown, Success<Me>>('/me/settings', body).then((res) => res.data),
    onMutate: async (body) => {
      const { cityName: _city, ...instant } = body;
      await queryClient.cancelQueries({ queryKey: ['me'], exact: true });
      const current = queryClient.getQueryData<Me>(['me']);
      const keys = Object.keys(instant) as (keyof InstantSettings)[];
      if (!current || !keys.length) return { undo: {} as Partial<InstantSettings> };
      const undo: Partial<InstantSettings> = {};
      for (const key of keys) Object.assign(undo, { [key]: current.settings[key] });
      queryClient.setQueryData<Me>(['me'], {
        ...current,
        settings: { ...current.settings, ...instant },
      });
      return { undo };
    },
    onError: (_err, body, context) => {
      const current = queryClient.getQueryData<Me>(['me']);
      if (!current || !context) return;
      const settings = { ...current.settings };
      for (const key of Object.keys(context.undo) as (keyof InstantSettings)[]) {
        if (settings[key] === body[key]) Object.assign(settings, { [key]: context.undo[key] });
      }
      queryClient.setQueryData<Me>(['me'], { ...current, settings });
    },
    onSuccess: (me) => {
      if (isLast()) queryClient.setQueryData(['me'], me);
    },
    onSettled: () => {
      if (isLast()) void queryClient.invalidateQueries({ queryKey: ['me'], exact: true });
    },
  });
}

export type ProfileSlot = 'avatar' | 'cover';

// Upload straight to Cloudinary (kind avatar/cover), then point the profile at it (02 §8.12).
export function useSetProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      slot,
      photo,
      onProgress,
    }: {
      slot: ProfileSlot;
      photo: Blob;
      onProgress?: (fraction: number) => void;
    }) => {
      const publicId = await uploadImage(photo, slot, onProgress);
      return api.put<unknown, Success<Me>>(`/me/${slot}`, { publicId }).then((res) => res.data);
    },
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

export function useRemoveProfilePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (slot: ProfileSlot) =>
      api.delete<unknown, Success<Me>>(`/me/${slot}`).then((res) => res.data),
    onSuccess: (me) => queryClient.setQueryData(['me'], me),
  });
}

// Deletes everything, photos included (02 §8.3); the session ends and the app goes to /login.
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: string) => api.delete('/me', { data: { confirm } }),
    onSuccess: () => {
      endSession();
      // Here rather than in the caller: the page unmounts as soon as the session ends.
      toast('Your account was deleted.');
    },
  });
}
