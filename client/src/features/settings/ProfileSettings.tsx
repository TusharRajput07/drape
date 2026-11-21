import { zodResolver } from '@hookform/resolvers/zod';
import { Camera } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { FormField } from '@/components/FormField';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import {
  type ProfileSlot,
  useMe,
  useRemoveProfilePhoto,
  useSetProfilePhoto,
  useUpdateProfile,
} from '@/features/profile/me.api';
import { ApiError, type Me } from '@/lib/api-types';
import { fieldErrors, toastError } from '@/lib/errors';
import { compress, cropSquare, decodeToCanvas } from '@/lib/image';
import { profileSchema } from '@/lib/profile-rules';

// Profile photos: the avatar is the centre square at 512 px; the cover keeps its shape, at most
// 1600 px on the long side (the header crops it to fit). Both are compressed to WebP.
const AVATAR_PX = 512;
const COVER_PX = 1600;

async function preparePhoto(file: File, slot: ProfileSlot) {
  const decoded = await decodeToCanvas(file, COVER_PX);
  return slot === 'avatar'
    ? compress(cropSquare(decoded, AVATAR_PX), AVATAR_PX)
    : compress(decoded, COVER_PX);
}

const TEXT: Record<
  ProfileSlot,
  { label: string; empty: string; updated: string; removed: string }
> = {
  avatar: {
    label: 'Profile photo',
    empty: 'Your initials show until you add one.',
    updated: 'Profile photo updated',
    removed: 'Profile photo removed',
  },
  cover: {
    label: 'Cover photo',
    empty: 'A plain cover shows until you add one.',
    updated: 'Cover photo updated',
    removed: 'Cover photo removed',
  },
};

// Settings → Profile: name and username (in a sheet), profile photo, cover photo (03 §6.11).
export function ProfileSettings() {
  const me = useMe().data;
  const [editing, setEditing] = useState(false);
  if (!me) return <div className="my-3.5 h-28 animate-pulse rounded-xl bg-soft" />;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border py-3.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{me.name}</div>
          <div className="truncate text-[13px] text-muted">@{me.username}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <PhotoRow me={me} slot="avatar" />
      <PhotoRow me={me} slot="cover" />

      <Sheet open={editing} onOpenChange={setEditing}>
        <SheetContent>
          <SheetTitle>Edit profile</SheetTitle>
          <SheetDescription>Shown at the top of your closet.</SheetDescription>
          {editing && <ProfileForm me={me} onDone={() => setEditing(false)} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function PhotoRow({ me, slot }: { me: Me; slot: ProfileSlot }) {
  const input = useRef<HTMLInputElement>(null);
  const setPhoto = useSetProfilePhoto();
  const removePhoto = useRemoveProfilePhoto();
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const image = me[slot];
  const text = TEXT[slot];
  const busy = preparing || setPhoto.isPending || removePhoto.isPending;

  const pick = () => {
    if (!input.current) return;
    input.current.value = '';
    input.current.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    let photo: Blob;
    try {
      photo = await preparePhoto(file, slot);
    } catch (err) {
      // HEIC and other formats the browser can't decode.
      console.error(err);
      toast("Couldn't open that photo. Try a JPG or PNG.");
      return;
    } finally {
      setPreparing(false);
    }
    setProgress(0);
    setPhoto.mutate(
      { slot, photo, onProgress: setProgress },
      {
        onSuccess: () => toast(text.updated),
        onError: toastError,
        onSettled: () => setProgress(null),
      },
    );
  };

  return (
    <div className="border-b border-border py-3.5 last:border-b-0">
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <div className="flex items-center gap-3">
        <div
          className={
            slot === 'avatar'
              ? 'size-12 flex-none overflow-hidden rounded-full bg-accent-soft'
              : 'h-12 w-20 flex-none overflow-hidden rounded-xl bg-accent-soft'
          }
        >
          {image && <img src={image.url} alt="" className="size-full object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{text.label}</div>
          {!image && <div className="text-[12.5px] text-muted">{text.empty}</div>}
        </div>
      </div>
      {progress !== null && (
        <div className="mt-3">
          <ProgressBar fraction={progress} label={`${text.label} upload progress`} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={busy} onClick={pick}>
          <Camera strokeWidth={1.8} aria-hidden />
          {setPhoto.isPending ? 'Uploading…' : image ? 'Change' : 'Add'}
        </Button>
        {image && (
          <Button
            variant="ghost"
            size="sm"
            className="text-danger"
            disabled={busy}
            onClick={() =>
              removePhoto.mutate(slot, {
                onSuccess: () => toast(text.removed),
                onError: toastError,
              })
            }
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function ProfileForm({ me, onDone }: { me: Me; onDone: () => void }) {
  const update = useUpdateProfile();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: me.name, username: me.username },
  });

  const onSubmit = handleSubmit((values) => {
    // Only what changed goes to the server.
    const body: { name?: string; username?: string } = {};
    if (values.name !== me.name) body.name = values.name;
    if (values.username !== me.username) body.username = values.username;
    if (!Object.keys(body).length) return onDone();
    update.mutate(body, {
      onSuccess: () => {
        onDone();
        toast('Profile saved');
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === 'USERNAME_TAKEN') {
          return setError('username', { message: err.message }, { shouldFocus: true });
        }
        const fields = fieldErrors(err);
        if (fields.name) setError('name', { message: fields.name });
        if (fields.username) setError('username', { message: fields.username });
        if (!fields.name && !fields.username) toastError(err);
      },
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3.5">
      <FormField
        id="profile-name"
        label="Name"
        autoComplete="name"
        maxLength={60}
        error={errors.name?.message}
        {...register('name')}
      />
      <FormField
        id="profile-username"
        label="Username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={24}
        error={errors.username?.message}
        {...register('username')}
      />
      <Button type="submit" className="mt-1.5 w-full" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}
