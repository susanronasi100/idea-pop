import React from 'react';

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  size?: LogoSize;
  /** The colourful IDEA POP lettering. */
  showWordmark?: boolean;
  /** The round tree-in-a-bulb badge. The designs show the lettering alone in the
   *  app's top-right corner, so that spot turns the badge off. */
  showBadge?: boolean;
}

const sizeMap: Record<LogoSize, { badge: string; text: string }> = {
  sm: { badge: 'h-9 w-9', text: 'h-6' },
  md: { badge: 'h-12 w-12', text: 'h-8' },
  lg: { badge: 'h-16 w-16', text: 'h-10' },
};

/**
 * The one Idea Pop logo, the same artwork as the landing page: the tree-in-a-bulb
 * badge (public/landing/idea-pop-logo.png) and the colourful IDEA POP lettering
 * (public/landing/idea-pop-text.svg).
 */
export default function Logo({ size = 'md', showWordmark = true, showBadge = true }: LogoProps) {
  const { badge, text } = sizeMap[size];

  return (
    <div className="inline-flex items-center gap-2" data-testid="logo">
      {showBadge && (
        // eslint-disable-next-line @next/next/no-img-element -- small static brand art
        <img
          src="/landing/idea-pop-logo.png"
          alt={showWordmark ? '' : 'Idea Pop'}
          aria-hidden={showWordmark ? true : undefined}
          width={160}
          height={160}
          className={`${badge} shrink-0 object-contain`}
        />
      )}
      {showWordmark && (
        // eslint-disable-next-line @next/next/no-img-element -- small static brand art
        <img src="/landing/idea-pop-text.svg" alt="IDEA POP" width={156} height={41} className={`${text} w-auto`} />
      )}
    </div>
  );
}
