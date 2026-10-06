'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePathname } from '@/i18n/routing';
import Logo from './Logo';
import PenguinMascot from './PenguinMascot';
import LocaleSwitcher from './marketing/LocaleSwitcher';
import HelpPanel, { type HelpSection } from './HelpPanel';
import { AVATARS } from '@/lib/avatars';

export type Section = 'profile' | 'explore' | 'library' | 'challenge' | 'studio';
type Persona = 'kid' | 'parent' | 'teacher';

// ── Route → active section / persona (works on the server via usePathname) ──────

function sectionFromPath(path: string): Section | undefined {
  if (path.startsWith('/explore')) return 'explore';
  if (path.startsWith('/library')) return 'library';
  if (path.startsWith('/challenge')) return 'challenge';
  if (path.startsWith('/studio')) return 'studio';
  if (path.startsWith('/profile') || path.startsWith('/dashboard')) return 'profile';
  return undefined;
}

function personaFromPath(path: string): Persona {
  if (path.startsWith('/dashboard/parent')) return 'parent';
  if (path.startsWith('/dashboard/teacher')) return 'teacher';
  return 'kid';
}

// Which help blurb the floating penguin shows. A mission route (/challenges/:id)
// is distinct from the challenges LIST (/challenges).
function helpSectionFromPath(path: string): HelpSection {
  if (/^\/challenges\/[^/]+/.test(path)) return 'mission';
  return sectionFromPath(path) ?? 'default';
}

// ── Nav config per persona ──────────────────────────────────────────────────────

interface NavItem {
  id: Section | 'account';
  labelKey: string;
  href: string;
}

// Each section paints the whole shell in its own colour (TEMP rule 28): the page
// background, the sidebar outline, the active nav item and its notch, the dotted
// frame around the content, and the Upgrade card. See SECTION_THEME below.
const KID_NAV: NavItem[] = [
  { id: 'profile', labelKey: 'nav.profile', href: '/profile' },
  { id: 'explore', labelKey: 'nav.explore', href: '/explore' },
  { id: 'library', labelKey: 'nav.library', href: '/library' },
  { id: 'challenge', labelKey: 'nav.challenges', href: '/challenges' },
  { id: 'account', labelKey: 'shell.account', href: '/profile' },
];
// The Machine Trainer classifier is a TOOL, not a section: it's reachable from
// the Library tool card and the in-mission Build-step embed, not the main nav.
// /studio/* keeps its Section entry so the page shell still gets its tint.

const PARENT_NAV: NavItem[] = [
  { id: 'profile', labelKey: 'nav.profile', href: '/dashboard/parent' },
  { id: 'account', labelKey: 'shell.account', href: '/dashboard/parent#account' },
];

const TEACHER_NAV: NavItem[] = [
  { id: 'profile', labelKey: 'nav.profile', href: '/dashboard/teacher' },
  { id: 'explore', labelKey: 'nav.explore', href: '/explore' },
  { id: 'library', labelKey: 'nav.library', href: '/library' },
  { id: 'challenge', labelKey: 'nav.challenges', href: '/challenges' },
];

const NAV: Record<Persona, NavItem[]> = { kid: KID_NAV, parent: PARENT_NAV, teacher: TEACHER_NAV };

/**
 * Section colours, from the designer's four page designs (TEMP rule 28).
 * tint: the page background. line: outlines, the dotted frame, the notch.
 * text: the active nav label and icon (≥4.5:1 on white). strong: filled buttons
 * with white text (≥4.5:1 with white), so a few are a shade deeper than the mockups.
 */
const SECTION_THEME: Record<Section, { tint: string; line: string; text: string; strong: string; frame?: string }> = {
  // Sampled from the My profile Figma frame: lime outline, deep green text and dotted frame.
  profile: { tint: '#F3FFC2', line: '#D2EB6E', text: '#18785A', strong: '#18785A', frame: '#18785A' },
  explore: { tint: '#F9DED7', line: '#E5484D', text: '#C4363C', strong: '#C4363C' },
  library: { tint: '#FBF7D5', line: '#F2994A', text: '#A8550B', strong: '#A8550B' },
  challenge: { tint: '#C0F0FF', line: '#2D9CDB', text: '#1A6FA6', strong: '#1A6FA6' },
  studio: { tint: '#F1D8FB', line: '#B57BD9', text: '#7B3FA8', strong: '#7B3FA8' },
};

// ── Nav icons (from the designer's Figma export; stroke inherits currentColor
//    so the coral active / ink idle states keep working) ─────────────────────────

// Studio is a tool section with no nav entry, so it needs no icon.
type NavIconId = Exclude<NavItem['id'], 'studio'>;

const NAV_ICONS: Record<NavIconId, { viewBox: string; paths: string[] }> = {
  profile: {
    viewBox: '0 0 30 30',
    paths: [
      'M5 22.5C5 21.1739 5.52678 19.9021 6.46447 18.9645C7.40215 18.0268 8.67392 17.5 10 17.5H20C21.3261 17.5 22.5979 18.0268 23.5355 18.9645C24.4732 19.9021 25 21.1739 25 22.5C25 23.163 24.7366 23.7989 24.2678 24.2678C23.7989 24.7366 23.163 25 22.5 25H7.5C6.83696 25 6.20107 24.7366 5.73223 24.2678C5.26339 23.7989 5 23.163 5 22.5Z',
      'M15 12.5C17.0711 12.5 18.75 10.8211 18.75 8.75C18.75 6.67893 17.0711 5 15 5C12.9289 5 11.25 6.67893 11.25 8.75C11.25 10.8211 12.9289 12.5 15 12.5Z',
    ],
  },
  explore: {
    viewBox: '0 0 26 26',
    paths: [
      'M23.9489 15.9752H18.6168C17.9938 15.9752 17.3964 16.218 16.9559 16.65C16.5154 17.0821 16.2679 17.6681 16.2679 18.2791V23.509M6.87218 2.54346V4.4557C6.87218 5.37225 7.2434 6.25126 7.90416 6.89936C8.56493 7.54746 9.46111 7.91156 10.3956 7.91156C11.0185 7.91156 11.616 8.15429 12.0565 8.58636C12.497 9.01842 12.7445 9.60443 12.7445 10.2155C12.7445 11.4826 13.8015 12.5194 15.0934 12.5194C15.7164 12.5194 16.3139 12.2766 16.7544 11.8446C17.1949 11.4125 17.4424 10.8265 17.4424 10.2155C17.4424 8.94832 18.4994 7.91156 19.7913 7.91156H23.5143M11.57 23.9813V19.4311C11.57 18.8201 11.3226 18.234 10.8821 17.802C10.4415 17.3699 9.84408 17.1272 9.22111 17.1272C8.59814 17.1272 8.00068 16.8845 7.56017 16.4524C7.11966 16.0203 6.87218 15.4343 6.87218 14.8233V13.6713C6.87218 13.0603 6.62471 12.4743 6.1842 12.0422C5.74369 11.6102 5.14623 11.3674 4.52326 11.3674H1.05859',
      'M12.7446 24.0391C19.231 24.0391 24.4893 18.8816 24.4893 12.5195C24.4893 6.15747 19.231 1 12.7446 1C6.25825 1 1 6.15747 1 12.5195C1 18.8816 6.25825 24.0391 12.7446 24.0391Z',
    ],
  },
  library: {
    viewBox: '0 0 28 24',
    paths: [
      'M22.5662 2.17578L22.5141 6.46768M24.653 4.34737L20.4273 4.29609M5.48135 16.9923L5.45531 19.1383M6.52474 18.0781L4.41191 18.0525M11.7728 15.4589C11.683 15.0865 11.4965 14.7453 11.2328 14.4709C10.9692 14.1965 10.6379 13.9989 10.2734 13.8987L3.81295 12.1226C3.70276 12.0894 3.60626 12.0205 3.5381 11.9266C3.46993 11.8326 3.43381 11.7186 3.43523 11.6018C3.43665 11.4851 3.47552 11.372 3.54595 11.2797C3.61637 11.1874 3.71451 11.1209 3.82547 11.0904L10.3272 9.47051C10.6938 9.37924 11.0297 9.1899 11.3 8.92218C11.5702 8.65446 11.7649 8.31812 11.8639 7.94814L13.615 1.38573C13.6475 1.27336 13.7152 1.17483 13.8079 1.10519C13.9006 1.03554 14.0132 0.998602 14.1285 1C14.2437 1.0014 14.3554 1.04106 14.4464 1.11294C14.5374 1.18481 14.6027 1.28495 14.6324 1.39808L16.2227 8.00103C16.3125 8.3735 16.4989 8.71468 16.7626 8.98909C17.0263 9.26349 17.3576 9.46108 17.722 9.56131L24.1825 11.3363C24.2936 11.3689 24.3911 11.4376 24.46 11.5319C24.5289 11.6261 24.5654 11.7408 24.564 11.8582C24.5626 11.9756 24.5233 12.0894 24.4521 12.1819C24.3809 12.2745 24.2818 12.3408 24.17 12.3707L17.6683 13.9884C17.3016 14.0798 16.9656 14.2693 16.6953 14.5372C16.425 14.8051 16.2304 15.1417 16.1315 15.5118L14.3804 22.0742C14.348 22.1866 14.2803 22.2851 14.1876 22.3548C14.0949 22.4244 13.9823 22.4614 13.867 22.46C13.7517 22.4586 13.6401 22.4189 13.5491 22.347C13.4581 22.2752 13.3928 22.175 13.3631 22.0619L11.7728 15.4589Z',
    ],
  },
  challenge: {
    viewBox: '0 0 25 25',
    paths: [
      'M3.40033 17.647C1.63508 19.0936 0.999738 23.4435 0.999738 23.4435C0.999738 23.4435 5.36375 22.9139 6.8528 21.1843C7.69179 20.2158 7.69838 18.7128 6.78909 17.793C6.34152 17.3553 5.74808 17.0983 5.12265 17.0714C4.49722 17.0444 3.88388 17.2494 3.40033 17.647ZM12.1587 16.0056L8.70625 12.4683C9.34569 10.8675 10.145 9.33533 11.092 7.895C12.4757 5.74114 14.3875 3.9771 16.6454 2.77068C18.9034 1.56425 21.4324 0.955562 23.9921 1.0025C23.9536 4.17118 22.9774 9.72866 16.8468 13.7322C15.3639 14.6445 13.7933 15.4061 12.1587 16.0056Z',
      'M8.70579 12.4684L2.88101 12.3977C2.88101 12.3977 3.56457 8.87567 5.26747 7.76616C7.16996 6.53091 11.0923 7.83684 11.0923 7.83684M12.1583 16.0057L12.0876 21.8305C12.0876 21.8305 15.6252 21.2326 16.7757 19.5571C18.0567 17.6851 16.8464 13.7323 16.8464 13.7323',
    ],
  },
  account: {
    viewBox: '0 0 24 24',
    paths: [
      'M2 21.0002C2.00012 19.7412 2.29739 18.5 2.86766 17.3775C3.43792 16.255 4.26506 15.283 5.28182 14.5404C6.29858 13.7979 7.47624 13.3058 8.71904 13.1042C9.96183 12.9026 11.2347 12.9972 12.434 13.3802',
      'M10 13C12.7614 13 15 10.7614 15 8C15 5.23858 12.7614 3 10 3C7.23858 3 5 5.23858 5 8C5 10.7614 7.23858 13 10 13Z',
      'M18 21C19.6569 21 21 19.6569 21 18C21 16.3431 19.6569 15 18 15C16.3431 15 15 16.3431 15 18C15 19.6569 16.3431 21 18 21Z',
      'M19.4998 14.2998L19.0998 15.1998M16.8998 20.7998L16.4998 21.6998M21.6998 19.4998L20.7998 19.0998M15.1998 16.8998L14.2998 16.4998M21.6998 16.4998L20.7998 16.8998M15.1998 19.0998L14.2998 19.4998M19.4998 21.6998L19.0998 20.7998M16.8998 15.1998L16.4998 14.2998',
    ],
  },
};

function NavIcon({ id, className }: { id: NavItem['id']; className?: string }) {
  if (id === 'studio') return null;
  const icon = NAV_ICONS[id];
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox={icon.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      {icon.paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// The active nav item's indicator, matching the Figma: a white circle DOCKED
// in a notch cut into the panel's edge. The notch is a blush lens (the page
// background showing through the cut) with the coral border sweeping around
// it; the circle floats in the notch with a thin crescent gap, crossing the
// dashed seam into the content area. In RTL the whole thing mirrors.
function ActiveNotch({ id }: { id: NavItem['id'] }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 z-20 hidden -translate-y-1/2 md:block ltr:left-full ltr:-ml-7 rtl:right-full rtl:-mr-7 rtl:-scale-x-100"
    >
      <span className="relative block h-[120px] w-[120px]">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          className="absolute inset-0 overflow-visible"
        >
          {/* the notch: a blush lens cut into the panel (x=40 is the panel's
              edge; the fill overlaps to x=42 to cover the straight border) */}
          <path
            d="M40 16 C40 24 35 28 30.1 34 A34 34 0 0 0 30.1 86 C35 92 40 96 40 104 L42 104 L42 16 Z"
            fill="var(--sec-tint)"
          />
          {/* coral hairline: the panel border sweeping around the notch */}
          <path
            d="M40 16 C40 24 35 28 30.1 34 A34 34 0 0 0 30.1 86 C35 92 40 96 40 104"
            stroke="var(--sec-line)"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
        {/* the docked circle floating in the notch */}
        <span className="absolute left-[52px] top-[60px] flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[color:var(--sec-text)] shadow-[0_2px_8px_rgba(0,0,0,0.14)] rtl:-scale-x-100">
          <NavIcon id={id} className="h-6 w-6" />
        </span>
      </span>
    </span>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

function AppShellInner({
  section,
  children,
}: {
  section: Section;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [kid, setKid] = useState<{ nickname: string; avatar_id: string } | null>(null);

  const persona = personaFromPath(pathname);
  const activeSection = sectionFromPath(pathname) ?? section;
  const items = NAV[persona];
  const theme = SECTION_THEME[activeSection];
  const showUpgrade = persona === 'kid' || persona === 'parent';

  useEffect(() => {
    try {
      const raw = localStorage.getItem('kidProfile');
      if (raw) {
        const p = JSON.parse(raw) as { nickname?: string; avatar_id?: string };
        if (p.nickname) setKid({ nickname: p.nickname, avatar_id: p.avatar_id ?? '' });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const displayName =
    persona === 'kid'
      ? (kid?.nickname ?? t('shell.default_kid_name'))
      : persona === 'teacher'
        ? t('shell.teacher_name')
        : t('shell.parent_name');
  const avatar = kid ? AVATARS.find((a) => a.id === kid.avatar_id) : undefined;

  const sidebar = (
    <nav
      aria-label={t('shell.main_nav')}
      className="flex h-full flex-col gap-6 rounded-[1.75rem] border-[1.5px] border-[color:var(--sec-line)] bg-white px-3 py-6 shadow-md"
    >
      {/* Avatar — slim, gently-shimmering gradient ring around the avatar */}
      <div className="flex flex-col items-center gap-2.5 px-3">
        <span className="relative flex h-20 w-20 items-center justify-center" aria-hidden="true">
          <span className="avatar-ring absolute inset-0 rounded-full" />
          {/* 72px inner inside the 80px ring → a thin 4px ring */}
          <span
            className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full text-3xl"
            style={{ backgroundColor: avatar?.bg ?? '#FBF7D5' }}
          >
            {persona === 'kid' && avatar?.img ? (
              <Image src={avatar.img} alt="" width={72} height={72} className="h-full w-full object-contain" />
            ) : (
              <span>{persona === 'kid' ? (avatar?.emoji ?? '🐧') : persona === 'teacher' ? '🧑‍🏫' : '🧑'}</span>
            )}
          </span>
        </span>
        <span className="font-display text-lg font-bold text-ink">{displayName}</span>
      </div>

      {/* Nav */}
      <ul className="flex flex-1 flex-col gap-3" role="list">
        {items.map((item) => {
          const isActive = item.id !== 'account' && activeSection === item.id;
          return (
            <li key={`${item.id}-${item.href}`} className="relative">
              <a
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex items-center justify-between gap-3 rounded-card px-4 py-3.5 font-body text-[15px] font-bold transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  isActive
                    ? 'text-[color:var(--sec-text)] focus-visible:ring-[color:var(--sec-text)]'
                    : 'text-ink/70 hover:bg-[var(--sec-tint)] hover:text-ink focus-visible:ring-ink/20',
                ].join(' ')}
              >
                <span>{t(item.labelKey)}</span>
                {/* The scoop circle IS the active icon on md+ — hide the
                    inline one there so they don't overlap at the row edge. */}
                <NavIcon id={item.id} className={isActive ? 'shrink-0 md:opacity-0' : 'shrink-0'} />
              </a>
              {/* Active indicator: a circle cradled by a concave scoop carved
                  into the panel's right edge (the designer's signature curve). */}
              {isActive && <ActiveNotch id={item.id} />}
            </li>
          );
        })}
      </ul>

      {/* Upgrade card (kid + parent) */}
      {showUpgrade && (
        <a
          href={persona === 'parent' ? '/dashboard/parent#account' : '/profile'}
          className={`flex flex-col items-center gap-2 rounded-[1.25rem] p-3 text-center transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sec-text)] bg-[var(--sec-tint)]`}
        >
          <Image src="/kid/upgrade-girl.png" alt="" width={72} height={72} className="h-16 w-auto" aria-hidden="true" />
          <span className="font-body text-sm font-semibold text-ink/80">
            {t('shell.upgrade_body')}
          </span>
          <span className="rounded-pill bg-[var(--sec-strong)] px-6 py-2.5 font-body text-base font-extrabold text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.15),0_4px_4px_rgba(0,0,0,0.2)]">
            {t('shell.upgrade_cta')}
          </span>
        </a>
      )}

      {/* In-app language switch (all personas) — quiet footer, off the design
          but a needed feature; a hairline separates it from the nav. */}
      <div className="flex justify-center border-t border-ink/5 pt-3">
        <LocaleSwitcher variant="light" />
      </div>
    </nav>
  );

  return (
    <div
      className="app-typography h-screen overflow-hidden bg-[var(--sec-tint)] font-body"
      style={
        {
          '--sec-tint': theme.tint,
          '--sec-line': theme.line,
          '--sec-frame': theme.frame ?? theme.line,
          '--sec-text': theme.text,
          '--sec-strong': theme.strong,
        } as React.CSSProperties
      }
    >
      {/* Canonical desktop frame: the shell is capped at 1440px and centred, so
          content never stretches on wide monitors (only the blush background
          fills the overflow). Sidebar 256px + content ≈ 1150px at the cap. */}
      <div className="mx-auto flex h-full max-w-[90rem]">
      {/* Desktop sidebar — white panel floating on the blush background */}
      <aside className="hidden w-64 shrink-0 flex-col p-3 md:flex">{sidebar}</aside>

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-20 bg-ink/30 md:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed inset-y-0 z-30 flex w-64 flex-col bg-[var(--sec-tint)] px-3 pb-3 transition-transform duration-200 ltr:left-0 rtl:right-0 md:hidden',
          drawerOpen ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
        ].join(' ')}
        aria-label={t('shell.main_nav')}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="m-3 self-end rounded-full p-1.5 text-ink/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          aria-label={t('shell.close_nav')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        {sidebar}
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-ink/10 bg-white px-4 py-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('shell.open_nav')}
            className="rounded-card p-2 text-ink/60 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Logo size="sm" showWordmark />
        </header>

        {/* Scrollable content — a dotted frame in the section colour + top-right logo */}
        <main
          id="main-content"
          className="relative m-2 flex-1 overflow-y-auto rounded-[1.75rem] border-[1.5px] border-dotted border-[color:var(--sec-frame)] bg-[var(--sec-tint)] pb-20 md:m-3"
        >
          <div className="pointer-events-none absolute right-5 top-4 z-10 hidden md:block">
            <span className="pointer-events-auto">
              <Logo size="sm" showWordmark />
            </span>
          </div>
          {children}
        </main>
      </div>
      </div>

      {/* Floating penguin mascot (flips to the left in RTL) — opens the help panel */}
      <div className="fixed bottom-6 z-40 ltr:right-6 rtl:left-6">
        <PenguinMascot onClick={() => setHelpOpen(true)} />
      </div>

      {helpOpen && (
        <HelpPanel section={helpSectionFromPath(pathname)} onClose={() => setHelpOpen(false)} />
      )}
    </div>
  );
}

// ── Public component (keeps the `section` prop for callers) ──────────────────────

export interface AppShellProps {
  section?: Section;
  children: React.ReactNode;
}

export default function AppShell({ section = 'explore', children }: AppShellProps) {
  return <AppShellInner section={section}>{children}</AppShellInner>;
}
