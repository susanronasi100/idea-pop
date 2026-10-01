'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import PopiAvatar from '@/components/PopiAvatar';

export default function NotFound() {
  const t = useTranslations('not_found');

  return (
    <div
      data-testid="not-found"
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-tint-blush px-6 py-16 text-center font-body"
    >
      <PopiAvatar size={120} />
      <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{t('title')}</h1>
      <p className="max-w-md text-base text-ink/70">{t('body')}</p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center justify-center rounded-pill bg-explore px-8 py-3 font-display text-lg font-bold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-explore focus-visible:ring-offset-2"
      >
        {t('home')}
      </Link>
    </div>
  );
}
