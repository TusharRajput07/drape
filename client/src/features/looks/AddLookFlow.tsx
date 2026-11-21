import { useState } from 'react';
import { toast } from 'sonner';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { uploadImage } from '@/lib/cloudinary';
import { fieldErrors, toastError } from '@/lib/errors';
import { useCreateLook } from './looks.api';
import { TagPicker } from './TagPicker';
import { saveLabel, useTags } from './use-tags';

// The picked photo, already compressed, and an object URL for showing it.
export type LookPhoto = { blob: Blob; url: string };

type Props = { photo: LookPhoto | null; onClose: () => void };

// New look: the photo, optional tags, then upload and POST /looks (03 §6.9). The background is kept.
export function AddLookFlow({ photo, onClose }: Props) {
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open={!!photo} onOpenChange={(open) => !open && !saving && onClose()}>
      <SheetContent>
        <SheetTitle>New look</SheetTitle>
        <SheetDescription>
          Tap the clothes you're wearing in this photo. You can skip this.
        </SheetDescription>
        {photo && (
          <NewLook key={photo.url} photo={photo} onClose={onClose} onSavingChange={setSaving} />
        )}
      </SheetContent>
    </Sheet>
  );
}

type NewLookProps = {
  photo: LookPhoto;
  onClose: () => void;
  onSavingChange: (saving: boolean) => void;
};

function NewLook({ photo, onClose, onSavingChange }: NewLookProps) {
  const tags = useTags([]);
  const createLook = useCreateLook();
  const [progress, setProgress] = useState<number | null>(null);
  const saving = progress !== null;

  const save = async () => {
    setProgress(0);
    onSavingChange(true);
    try {
      const publicId = await uploadImage(photo.blob, 'look', setProgress);
      await createLook.mutateAsync({ publicId, itemIds: tags.ids });
      onClose();
      toast('Look added');
    } catch (err) {
      // A tagged piece that was deleted meanwhile comes back as a field message.
      const tagError = fieldErrors(err).itemIds;
      if (tagError) toast(tagError);
      else toastError(err);
    } finally {
      setProgress(null);
      onSavingChange(false);
    }
  };

  return (
    <>
      <div className="grid place-items-center overflow-hidden rounded-[18px] bg-soft">
        <img src={photo.url} alt="Your photo" className="max-h-[34dvh] w-full object-contain" />
      </div>

      <TagPicker tags={tags} disabled={saving} />

      {progress !== null && (
        <div className="mt-4">
          <ProgressBar fraction={progress} label="Upload progress" />
        </div>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button variant="ghost" className="flex-1" disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button
          className="flex-1"
          // Picks show once the closet loads; if it can't load, the look can still be saved untagged.
          disabled={saving || tags.all.isPending}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : saveLabel(tags.ids.length)}
        </Button>
      </div>
    </>
  );
}
