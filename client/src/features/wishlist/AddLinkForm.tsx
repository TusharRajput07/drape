import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-types';
import { fieldErrors, toastError } from '@/lib/errors';
import { useAddToWishlist } from './wishlist.api';

const NOT_A_LINK =
  "That doesn't look like a link. Paste the full product address, for example https://www.myntra.com/…";

// What was pasted, as a full http(s) link, or null. A link without "https://" gets it added
// (shops' share buttons sometimes copy just "www.myntra.com/…").
function toLink(raw: string): string | null {
  const text = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.')) return null;
    return url.href;
  } catch {
    return null;
  }
}

// The link input + Add (03 §6.8). The input clears at once so another link can be pasted while
// the server fetches this one; a link that fails comes back into an empty input.
export function AddLinkForm() {
  const add = useAddToWishlist();
  const location = useLocation();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // The + sheet's "Add to wishlist" lands here ready to paste. The timer runs after the closing
  // sheet hands focus back to the + button (Radix does that on a zero timer too). The flag is then
  // cleared, so a reload or coming back to this page doesn't pop the keyboard up again.
  const focus = (location.state as { focusLink?: boolean } | null)?.focusLink;
  const { key, pathname } = location;
  useEffect(() => {
    if (!focus) return;
    const timer = setTimeout(() => {
      input.current?.focus();
      void navigate(pathname, { replace: true, state: null });
    }, 0);
    return () => clearTimeout(timer);
  }, [focus, key, pathname, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    if (!raw) {
      setError('Paste a product link first.');
      input.current?.focus();
      return;
    }
    const url = toLink(raw);
    if (!url) {
      setError(NOT_A_LINK);
      input.current?.focus();
      return;
    }
    setError(null);
    setValue('');
    try {
      const item = await add.mutateAsync(url);
      toast(`Added to wishlist from ${item.siteName}`);
    } catch (err) {
      setValue((v) => v || raw);
      if (err instanceof ApiError && err.code === 'WISHLIST_DUPLICATE') {
        setError('Already in your wishlist.');
      } else {
        const message = fieldErrors(err).url;
        if (message) setError(message);
        else toastError(err);
      }
    }
  };

  return (
    <>
      <form className="flex gap-2" noValidate onSubmit={(e) => void submit(e)}>
        <input
          ref={input}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="Paste a product link (Myntra, Amazon…)"
          aria-label="Product link"
          aria-invalid={!!error}
          aria-describedby={error ? 'wishlist-link-error' : undefined}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          className="h-[46px] min-w-0 flex-1 rounded-full border border-border bg-background px-[18px] text-base outline-none placeholder:text-muted focus-visible:border-transparent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent aria-invalid:border-danger"
        />
        <Button type="submit" className="h-[46px]">
          Add
        </Button>
      </form>
      {error && (
        <p id="wishlist-link-error" role="alert" className="mx-1 mt-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </>
  );
}
