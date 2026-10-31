import {
  Bookmark,
  Camera,
  Heart,
  House,
  Link as LinkIcon,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { HangerIcon } from '@/components/HangerIcon';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const TABS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/outfits', label: 'Outfits', icon: HangerIcon },
  { to: '/liked', label: 'Liked', icon: Heart },
  { to: '/wishlist', label: 'Wishlist', icon: Bookmark },
];

function Tab({ to, label, icon: Icon }: (typeof TABS)[number]) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-[3px] py-1.5 text-[11px] text-muted',
          isActive && 'font-semibold text-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-[22px]" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden />
          {label}
        </>
      )}
    </NavLink>
  );
}

type Action = { icon: LucideIcon; title: string; text: string; onSelect: () => void };

function ActionRow({ icon: Icon, title, text, onSelect }: Action) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3.5 rounded-2xl border border-border p-3.5 text-left hover:border-foreground"
    >
      <span className="grid size-11 flex-none place-items-center rounded-full bg-soft">
        <Icon className="size-[22px]" strokeWidth={1.8} aria-hidden />
      </span>
      <span>
        <b className="block font-medium">{title}</b>
        <small className="text-[13px] text-muted">{text}</small>
      </span>
    </button>
  );
}

// Fixed bottom nav with the raised "+" that opens the Add sheet (03 §3).
export function BottomNav({ onUpload }: { onUpload: () => void }) {
  const [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const go = (to: string) => () => {
    setAdding(false);
    navigate(to);
  };

  const actions: Action[] = [
    {
      icon: Camera,
      title: 'Upload clothes',
      text: 'Add a photo from your gallery. The background is removed for you.',
      onSelect: () => {
        setAdding(false);
        onUpload();
      },
    },
    {
      icon: HangerIcon,
      title: 'Create outfit',
      text: 'Scroll through your tops, bottoms and shoes to find a combination.',
      onSelect: go('/outfits/new'),
    },
    {
      icon: LinkIcon,
      title: 'Add to wishlist',
      text: 'Save a product link from any shopping site.',
      onSelect: go('/wishlist'),
    },
  ];

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/94 pr-[max(8px,env(safe-area-inset-right,0px))] pb-[env(safe-area-inset-bottom,0px)] pl-[max(8px,env(safe-area-inset-left,0px))] backdrop-blur-md"
      >
        <div className="mx-auto grid h-nav max-w-[560px] grid-cols-5 items-center">
          {TABS.slice(0, 2).map((tab) => (
            <Tab key={tab.to} {...tab} />
          ))}
          <button
            type="button"
            aria-label="Add"
            onClick={() => setAdding(true)}
            className="-mt-[18px] grid size-[52px] place-items-center justify-self-center rounded-full bg-accent text-accent-foreground shadow-[0_0_0_5px_var(--background)]"
          >
            <Plus className="size-6" strokeWidth={2.2} aria-hidden />
          </button>
          {TABS.slice(2).map((tab) => (
            <Tab key={tab.to} {...tab} />
          ))}
        </div>
      </nav>

      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent>
          <SheetTitle>Add</SheetTitle>
          <SheetDescription>What do you want to do?</SheetDescription>
          <div className="grid gap-2">
            {actions.map((action) => (
              <ActionRow key={action.title} {...action} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
