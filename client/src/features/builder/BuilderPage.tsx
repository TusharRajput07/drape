import { useParams } from 'react-router';
import { PageHeader } from '@/components/PageHeader';

// Full screen, no bottom nav (03 §6.6). The rows come in phase 7.
export function BuilderPage() {
  const { id } = useParams();
  return (
    <section className="wrap">
      <PageHeader
        title={id ? 'Edit outfit' : 'Create outfit'}
        back="/outfits"
        backLabel="Back to outfits"
      />
    </section>
  );
}
