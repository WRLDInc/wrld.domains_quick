import type { CSSProperties } from 'react';

interface LockupProps {
  /** Sub-brand label to the right of the wordmark, e.g. "DOMAINS". Uppercase per the lockup recipe. */
  sub?: string;
  /** Wordmark font size in px. The mark scales with it (×1.7), as in the design system. */
  size?: number;
  className?: string;
}

/**
 * The WRLD lockup: the authentic starburst mark plus the Montserrat wordmark
 * and an optional sub-brand label. The mark is the design system's raster
 * artwork applied as a CSS mask and tinted with the `--logo` token, so it
 * flips between the dark and light versions with the theme.
 */
export function Lockup({ sub, size = 18, className = '' }: LockupProps) {
  const style = {
    '--lockup-size': `${size}px`,
    '--lockup-mark': `${Math.round(size * 1.7)}px`,
  } as CSSProperties;

  return (
    <span
      className={`lockup ${className}`.trim()}
      role="img"
      aria-label={sub ? `WRLD ${sub}` : 'WRLD'}
      style={style}
    >
      <span className="lockup-mark" aria-hidden="true" />
      <span className="lockup-text" aria-hidden="true">
        <span className="lockup-word">WRLD</span>
        {sub ? <span className="lockup-sub">{sub}</span> : null}
      </span>
    </span>
  );
}
