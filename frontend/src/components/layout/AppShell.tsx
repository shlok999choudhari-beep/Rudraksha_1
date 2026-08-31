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
    <div className="relative flex min-h-screen bg-background overflow-x-hidden selection:bg-peach-500 selection:text-white">
      {/* Dynamic Ambient Peach & Alabaster Light Orbs (Frosted diffusion) */}
      <div className="pointer-events-none fixed -top-32 right-10 size-[32rem] rounded-full bg-gradient-to-br from-peach-300/20 to-peach-400/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none fixed top-1/2 -left-20 size-[28rem] rounded-full bg-gradient-to-tr from-peach-200/25 to-amber-200/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none fixed bottom-10 right-1/4 size-[24rem] rounded-full bg-gradient-to-t from-peach-300/15 to-rose-200/10 blur-3xl" aria-hidden />

      <div className="hidden lg:flex relative z-20">
        <Sidebar collapsed={collapsed} onToggle={toggleCollapsed} />
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 animate-fade-in bg-foreground/20 backdrop-blur-md"
            aria-label="Close navigation"
          />
          <div className="relative animate-fade-in z-10">
            <Sidebar collapsed={false} onToggle={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col z-10">
        <Header onToggleSidebar={() => setDrawerOpen(true)} />
        {/* Soft radial aura wash for content */}
        <main className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-radial-fade opacity-80"
            aria-hidden
          />
          <div className="relative z-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
