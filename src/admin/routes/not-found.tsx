import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState, Page, usePageTitle } from '@/admin/components/common';
import { FullScreenMessage } from '@/admin/components/shell';
import { Button } from '@/admin/components/ui/button';

export function NotFoundPage({ outside = false }: Readonly<{ outside?: boolean }>) {
  usePageTitle('Page not found');
  const body = (
    <EmptyState
      icon={Compass}
      title="This admin page doesn’t exist"
      description="The link may be out of date."
      action={
        <Button asChild variant="outline">
          <Link to="/admin">Go to the overview</Link>
        </Button>
      }
    />
  );
  return outside ? <FullScreenMessage>{body}</FullScreenMessage> : <Page width="narrow">{body}</Page>;
}
