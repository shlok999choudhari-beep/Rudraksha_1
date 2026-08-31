'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const COLLAPSE_KEY = 'veriguard.ui.sidebar-collapsed';

/**
 * Chrome for every authenticated route: rail on the left, header on top,
 * scrolling content in the middle.
 *
 * The rail is a permanent fixture on desktop and a drawer below `lg`. The
 * collapsed preference is remembered because officers work a whole shift in this
 * console and should not have to re-collapse it on every navigation.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Read after mount only: localStorage does not exist during the server render.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === 'true');
  }, []);

  // A drawer left open over the new page would hide it.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden lg:flex">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fade-in bg-background/80 backdrop-blur-sm"
            aria-label="Close navigation"
          />
          <div className="relative animate-fade-in">
            <Sidebar collapsed={false} onToggle={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onToggleSidebar={() => setDrawerOpen(true)} />
        {/* Faint top-lit wash so content sits in a console, not on a flat page. */}
        <main className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-radial-fade opacity-70"
            aria-hidden
          />
          <div className="relative">{children}</div>
        </main>
      </div>
    </div>
  );
}
