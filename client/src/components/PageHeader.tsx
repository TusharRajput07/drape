import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  title: string;
  // Where the back arrow goes; sub-pages go back to the closet.
  back?: string;
  backLabel?: string;
  action?: ReactNode;
};

// The agreed header: title left, action button right (03 §2).
export function PageHeader({ title, back, backLabel = 'Back to closet', action }: Props) {
  return (
    <div className={cn('flex items-center gap-1.5 pt-3.5 pb-2', back && '-ml-2')}>
      {back && (
        <Button asChild variant="text" size="icon" className="text-foreground">
          <Link to={back} aria-label={backLabel}>
            <ChevronLeft className="size-[22px]" strokeWidth={1.8} />
          </Link>
        </Button>
      )}
      <h1 className="min-w-0 flex-1 text-[22px]">{title}</h1>
      {action}
    </div>
  );
}
