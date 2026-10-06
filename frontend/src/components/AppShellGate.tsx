'use client';

import AppShell from '@/components/AppShell';
import { usePathname } from '@/i18n/routing';

/** One persistent app shell for every (app) page, so the menu's circle slides between sections
 *  instead of the whole shell reloading. The public /challenges experience (signed out) is a
 *  marketing page and goes without it. */
export default function AppShellGate({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  if (!signedIn && pathname === '/challenges') return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
