import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';

export function OutfitsPage() {
  return (
    <section className="wrap">
      <PageHeader
        title="My outfits"
        action={
          <Button asChild size="sm">
            <Link to="/outfits/new">
              <Plus strokeWidth={1.8} aria-hidden /> Create outfit
            </Link>
          </Button>
        }
      />
    </section>
  );
}
