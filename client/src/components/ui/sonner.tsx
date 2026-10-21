import type * as React from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// The prototype's toast: a dark pill above the bottom nav.
const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    position="bottom-center"
    offset={{ bottom: 'calc(var(--nav-h) + 18px)' }}
    mobileOffset={{ bottom: 'calc(var(--nav-h) + 18px + env(safe-area-inset-bottom, 0px))' }}
    style={
      {
        '--normal-bg': 'var(--foreground)',
        '--normal-text': '#ffffff',
        '--normal-border': 'var(--foreground)',
        '--border-radius': '999px',
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
