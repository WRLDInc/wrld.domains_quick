import type { AnchorHTMLAttributes } from 'react';
import { Link } from 'wouter';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

export type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string };

/** Client-side navigation for in-app paths, a plain anchor for everything else. */
export function Anchor({ href, ...rest }: AnchorProps) {
  if (EXTERNAL.test(href)) {
    return <a href={href} {...rest} />;
  }
  return <Link href={href} {...rest} />;
}
