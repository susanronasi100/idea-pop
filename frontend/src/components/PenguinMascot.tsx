'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import PopiAvatar from './PopiAvatar';

export interface PenguinMascotProps {
  label?: string;
  onClick?: () => void;
  className?: string;
}

export default function PenguinMascot({
  label,
  onClick,
  className = '',
}: PenguinMascotProps) {
  const t = useTranslations('mascot');
  const text = label ?? t('ask_me');
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={text}
      className={[
        'flex items-center gap-2 rounded-full bg-challenge text-white shadow-lg',
        'py-1.5 pe-4 ps-1.5 font-body font-semibold text-sm',
        'hover:brightness-110 active:scale-95 transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-challenge focus-visible:ring-offset-2',
        className,
      ].join(' ')}
    >
      <span className="flex h-11 w-11 items-end justify-center overflow-hidden rounded-full bg-white" aria-hidden="true">
        <PopiAvatar size={44} />
      </span>
      <span>{text}</span>
    </button>
  );
}
