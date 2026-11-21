import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/EmptyState';
import { InfiniteSentinel } from '@/components/InfiniteSentinel';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { ItemDetailSheet } from '@/features/closet/ItemDetailSheet';
import type { Item, Look } from '@/lib/api-types';
import { compress, decodeToCanvas } from '@/lib/image';
import { AddLookFlow, type LookPhoto } from './AddLookFlow';
import { LookDetailSheet } from './LookDetailSheet';
import { useLooks } from './looks.api';

// Look photos keep their background and are saved at most 1600 px on the long side (03 §6.9).
const MAX = 1600;

const LOOK_GRID =
  'grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] md:gap-3.5';

// Photos of the user wearing their clothes, each with its tagged pieces (03 §6.9).
export function LookbooksPage() {
  const list = useLooks();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<LookPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [openLook, setOpenLook] = useState<Look | null>(null);
  const [openItem, setOpenItem] = useState<Item | null>(null);

  const looks = list.data?.pages.flatMap((p) => p.data) ?? [];

  const pickPhoto = () => {
    if (fileInput.current) {
      fileInput.current.value = '';
      fileInput.current.click();
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    try {
      const blob = await compress(await decodeToCanvas(file, MAX), MAX);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (err) {
      // HEIC and other formats the browser can't decode.
      console.error(err);
      toast("Couldn't open that photo. Try a JPG or PNG.");
    } finally {
      setPreparing(false);
    }
  };

  // The preview's object URL is freed when the New look sheet closes or the page goes away.
  useEffect(() => {
    if (!photo) return;
    return () => URL.revokeObjectURL(photo.url);
  }, [photo]);

  const closeAdd = () => setPhoto(null);

  const addButton = (label: string) => (
    <Button size="sm" disabled={preparing} onClick={pickPhoto}>
      <Plus strokeWidth={1.8} aria-hidden /> {label}
    </Button>
  );

  return (
    <section className="wrap">
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <PageHeader title="Lookbooks" back="/" action={addButton('Add look')} />
      <p className="mb-3.5 max-w-[60ch] text-muted">
        Photos of you wearing your clothes. Tag the pieces in each photo.
      </p>

      {list.isPending ? (
        <div className={LOOK_GRID} role="status" aria-label="Loading">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-soft" />
          ))}
        </div>
      ) : list.isError ? (
        <EmptyState
          title="Couldn't load your looks"
          text="Check your connection and try again."
          action={
            <Button variant="ghost" onClick={() => void list.refetch()}>
              Try again
            </Button>
          }
        />
      ) : looks.length ? (
        <>
          <div className={LOOK_GRID}>
            {looks.map((look) => (
              <button
                key={look.id}
                type="button"
                onClick={() => setOpenLook(look)}
                aria-label={
                  look.items.length
                    ? `Look with ${look.items.length} tagged ${look.items.length === 1 ? 'piece' : 'pieces'}, open details`
                    : 'Look, open details'
                }
                className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-soft"
              >
                <img
                  src={look.image.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                {look.items.length > 0 && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-background/92 px-2 py-[3px] text-[11.5px] font-medium">
                    {look.items.length} tagged
                  </span>
                )}
              </button>
            ))}
          </div>
          <InfiniteSentinel
            hasMore={!!list.hasNextPage}
            loading={list.isFetchingNextPage}
            onMore={() => void list.fetchNextPage()}
          />
        </>
      ) : (
        <EmptyState
          title="Your lookbook is empty"
          text="Add a photo of you in an outfit you love."
          action={
            <Button disabled={preparing} onClick={pickPhoto}>
              Add your first look
            </Button>
          }
        />
      )}

      <AddLookFlow photo={photo} onClose={closeAdd} />
      <LookDetailSheet
        look={openLook}
        onClose={() => setOpenLook(null)}
        onOpenItem={(item) => {
          setOpenLook(null);
          setOpenItem(item);
        }}
      />
      <ItemDetailSheet item={openItem} onClose={() => setOpenItem(null)} />
    </section>
  );
}
