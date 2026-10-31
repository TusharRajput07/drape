import { Camera, RotateCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CategoryImage } from '@/components/CategoryImage';
import { ColorDot, ColorGrid } from '@/components/ColorGrid';
import { SwitchRow } from '@/components/SwitchRow';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useCreateItem } from '@/features/closet/items.api';
import { useCategories, useColors } from '@/features/closet/lookups.api';
import { SubcategoryPicker } from '@/features/subcategories/SubcategoryPicker';
import type { CategorySlug } from '@/lib/api-types';
import { CATEGORY_SLUGS, LABEL } from '@/lib/categories';
import { uploadImage } from '@/lib/cloudinary';
import { detectColor } from '@/lib/color-detect';
import { toastError } from '@/lib/errors';
import { compress, decodeToCanvas, hasTransparency, rotateClockwise } from '@/lib/image';
import { cn } from '@/lib/utils';
import { closeUpload, useUploadStore } from './upload.store';
import {
  removeBackground,
  useBackgroundRemovalStatus,
  warmUpBackgroundRemoval,
} from './useBackgroundRemoval';

// Saved photos are at most 1200 px on the long side (03 §6.4), so the work happens at that size too.
const MAX = 1200;

type Step = 'category' | 'photo' | 'preview' | 'unreadable';

type Props = { onSaved: (category: CategorySlug) => void };

// The + sheet → Upload clothes: category → photo → preview → save (03 §6.4).
export function UploadFlow({ onSaved }: Props) {
  const { open, category, session } = useUploadStore();
  const [saving, setSaving] = useState(false);
  return (
    <Sheet open={open} onOpenChange={(o) => !o && !saving && closeUpload()}>
      <SheetContent>
        <Flow key={session} startCategory={category} onSaved={onSaved} onSavingChange={setSaving} />
      </SheetContent>
    </Sheet>
  );
}

type FlowProps = Props & {
  startCategory: CategorySlug | null;
  onSavingChange: (saving: boolean) => void;
};

// One opening of the flow; it starts on the photo step when a category was given.
function Flow({ startCategory, onSaved, onSavingChange }: FlowProps) {
  const [step, setStep] = useState<Step>(startCategory ? 'photo' : 'category');
  const [category, setCategory] = useState(startCategory);
  const [photo, setPhoto] = useState<HTMLCanvasElement | null>(null);
  // A new photo gets a fresh preview; a rotated one keeps its picks.
  const [photoKey, setPhotoKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  const pickPhoto = () => {
    if (fileInput.current) {
      fileInput.current.value = '';
      fileInput.current.click();
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPhoto(await decodeToCanvas(file, MAX));
      setPhotoKey((k) => k + 1);
      setStep('preview');
    } catch {
      // HEIC and other formats the browser can't decode (03 §6.4).
      setStep('unreadable');
    }
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {step === 'category' && (
        <>
          <SheetTitle>Upload clothes</SheetTitle>
          <SheetDescription>What are you adding?</SheetDescription>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_SLUGS.map((slug) => (
              <button
                key={slug}
                type="button"
                onClick={() => {
                  setCategory(slug);
                  setStep('photo');
                }}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-border px-3 py-4 hover:border-foreground"
              >
                <CategoryImage slug={slug} className="size-[72px]" />
                <b className="font-medium">{LABEL[slug]}</b>
              </button>
            ))}
          </div>
          <p className="mt-2.5 text-[12.5px] text-muted">Next, choose a photo from your gallery.</p>
        </>
      )}

      {step === 'photo' && category && (
        <>
          <Eyebrow>{LABEL[category]}</Eyebrow>
          <SheetTitle>Choose a photo</SheetTitle>
          <SheetDescription className="mb-3 text-[12.5px]">
            For the best cutout, lay it flat on a plain floor or sheet.
          </SheetDescription>
          <Button className="w-full" onClick={pickPhoto}>
            <Camera strokeWidth={1.8} aria-hidden /> Choose a photo
          </Button>
        </>
      )}

      {step === 'unreadable' && (
        <>
          <SheetTitle>Couldn't open that photo</SheetTitle>
          <SheetDescription>
            This format isn't supported here (iPhone HEIC photos often aren't). Try a JPG or PNG.
          </SheetDescription>
          <Button className="w-full" onClick={pickPhoto}>
            Choose another photo
          </Button>
        </>
      )}

      {step === 'preview' && category && photo && (
        <Preview
          key={photoKey}
          category={category}
          photo={photo}
          onRotate={() => setPhoto(rotateClockwise(photo))}
          onChooseAnother={pickPhoto}
          onSavingChange={onSavingChange}
          onSaved={() => {
            closeUpload();
            toast(`Added to ${LABEL[category]}`);
            onSaved(category);
          }}
        />
      )}
    </>
  );
}

type PreviewProps = {
  category: CategorySlug;
  photo: HTMLCanvasElement;
  onRotate: () => void;
  onChooseAnother: () => void;
  onSavingChange: (saving: boolean) => void;
  onSaved: () => void;
};

// Remove-background switch, rotate, checkered preview, subcategory and detected colour (03 §6.4).
function Preview({
  category,
  photo,
  onRotate,
  onChooseAnother,
  onSavingChange,
  onSaved,
}: PreviewProps) {
  const categoryId = useCategories().data?.find((c) => c.slug === category)?.id;
  const colors = useColors().data;
  const createItem = useCreateItem();
  const removal = useBackgroundRemovalStatus();

  const [hasAlpha] = useState(() => hasTransparency(photo));
  const [removeBg, setRemoveBg] = useState(!hasAlpha);
  // The last removal result and the photo it was made from (a rotate makes it stale).
  const [removed, setRemoved] = useState<{ from: HTMLCanvasElement; cutout: HTMLCanvasElement }>();
  const [pickedColorId, setPickedColorId] = useState<string | null>(null);
  const [showColors, setShowColors] = useState(false);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Load the remover as soon as the preview opens (it's lazy, 03 §9).
  useEffect(() => {
    if (!hasAlpha) warmUpBackgroundRemoval();
  }, [hasAlpha]);

  const cutout = removed?.from === photo ? removed.cutout : null;
  const removing = removeBg && !cutout;

  // Remove the background whenever the photo changes (a rotate) and the switch is on.
  useEffect(() => {
    if (!removing) return;
    let current = true;
    removeBackground(photo)
      .then((result) => current && setRemoved({ from: photo, cutout: result }))
      .catch((err: unknown) => {
        console.error(err);
        if (!current) return;
        setRemoveBg(false);
        toast("Couldn't remove the background. You can save the photo as it is.");
      });
    return () => {
      current = false;
    };
  }, [photo, removing]);

  const shown = removeBg ? cutout : photo;

  // Colour detection re-runs on what will be saved, unless picked by hand (03 §9).
  const detectedColorId = useMemo(
    () => (shown && colors ? detectColor(shown, colors) : null),
    [shown, colors],
  );
  const colorManual = pickedColorId !== null;
  const colorId = pickedColorId ?? detectedColorId;
  const color = colors?.find((c) => c.id === colorId);
  const saving = progress !== null;
  const canSave = !!shown && !!subcategoryId && !!colorId && !!categoryId && !saving;

  const save = async () => {
    if (!shown || !subcategoryId || !colorId || !categoryId) return;
    setProgress(0);
    onSavingChange(true);
    try {
      const file = await compress(shown, MAX);
      const publicId = await uploadImage(file, 'item', setProgress);
      await createItem.mutateAsync({ publicId, categoryId, subcategoryId, colorId });
      onSaved();
    } catch (err) {
      toastError(err);
    } finally {
      setProgress(null);
      onSavingChange(false);
    }
  };

  return (
    <>
      <Eyebrow>{LABEL[category]}</Eyebrow>
      <SheetTitle>Check the photo</SheetTitle>
      <SheetDescription>
        The checkered area is see-through. In the app it sits on white.
      </SheetDescription>

      <SwitchRow
        checked={removeBg}
        onChange={setRemoveBg}
        className="mb-3 border-t"
        label={<b className="font-medium">Remove background</b>}
        hint={
          hasAlpha
            ? 'Your photo already has a see-through background.'
            : 'Turn off to keep the photo exactly as it is.'
        }
      />

      <div
        className={cn(
          'relative grid aspect-square place-items-center overflow-hidden rounded-2xl border border-border',
          (removeBg || hasAlpha) && 'checker',
        )}
      >
        {shown ? (
          <CanvasView canvas={shown} />
        ) : (
          <div className="grid w-3/4 justify-items-center gap-2.5 text-center text-[13px] text-muted">
            <span className="size-[22px] animate-spin rounded-full border-2 border-border border-t-accent" />
            {removal.ready ? 'Removing background…' : 'Getting the background remover ready…'}
            {!removal.ready && removal.fraction > 0 && removal.fraction < 1 && (
              <Bar fraction={removal.fraction} label="Download progress" />
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onRotate}
          disabled={removing || saving}
          aria-label="Rotate photo"
          className="absolute right-2 bottom-2 grid size-10 place-items-center rounded-full bg-background/90 shadow-[0_0_0_1px_var(--border)] disabled:opacity-40"
        >
          <RotateCw className="size-5" strokeWidth={1.8} aria-hidden />
        </button>
      </div>

      <div className="mt-3.5 grid gap-1.5">
        <div className="flex justify-between text-[13px] font-medium">
          Subcategory <span className="font-normal text-muted">Required</span>
        </div>
        {categoryId && (
          <SubcategoryPicker
            categoryId={categoryId}
            selected={subcategoryId}
            onSelect={setSubcategoryId}
            disabled={saving}
          />
        )}
      </div>

      {color && (
        <button
          type="button"
          aria-expanded={showColors}
          onClick={() => setShowColors(!showColors)}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-full border border-border pr-3.5 pl-2 text-[13px] font-medium"
        >
          <ColorDot hex={color.hex} className="size-5" />
          {color.name}
          <em className="font-normal text-muted not-italic">
            {colorManual ? 'chosen by you' : 'detected'} · Change
          </em>
        </button>
      )}
      {showColors && colors && (
        <ColorGrid
          className="mt-3"
          colors={colors}
          isOn={(id) => id === colorId}
          onPick={(id) => {
            setPickedColorId(id);
            setShowColors(false);
          }}
        />
      )}

      {progress !== null && (
        <div className="mt-4">
          <Bar fraction={progress} label="Upload progress" />
        </div>
      )}

      <div className="mt-5 flex gap-2.5">
        <Button variant="ghost" className="flex-1" disabled={saving} onClick={onChooseAnother}>
          Choose another
        </Button>
        <Button className="flex-1" disabled={!canSave} onClick={() => void save()}>
          {saving ? 'Saving…' : subcategoryId ? `Save to ${LABEL[category]}` : 'Pick a subcategory'}
        </Button>
      </div>
    </>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-medium tracking-[.09em] text-muted uppercase">
      {children}
    </span>
  );
}

function Bar({ fraction, label }: { fraction: number; label: string }) {
  const pct = Math.round(fraction * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-1.5 w-full overflow-hidden rounded bg-soft"
    >
      <span
        className="block h-full rounded bg-accent transition-[width]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Shows a canvas by copying it into its own canvas (no re-encoding for the preview).
function CanvasView({ canvas }: { canvas: HTMLCanvasElement }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.width = canvas.width;
    el.height = canvas.height;
    el.getContext('2d')?.drawImage(canvas, 0, 0);
  }, [canvas]);
  return (
    <div className="grid size-[86%] place-items-center">
      <canvas
        ref={ref}
        role="img"
        aria-label="Preview of your photo"
        className="max-h-full max-w-full"
      />
    </div>
  );
}
