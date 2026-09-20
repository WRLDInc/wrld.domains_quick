import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { Anchor } from './Anchor';

/**
 * Port of ui_kits/wrld-tech/Button.jsx. Surfaces stay monochrome; the accent
 * shows up only on hover (see .btn-* in global.css). "warm" is for commerce
 * moments such as search → register.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'warm' | 'inverse' | 'ghost-inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

type LinkButtonProps = BaseProps & { href: string } & Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'href' | 'children' | 'className'
  >;

type NativeButtonProps = BaseProps & { href?: undefined } & Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    'children' | 'className'
  >;

export type ButtonProps = LinkButtonProps | NativeButtonProps;

function classes(variant: ButtonVariant, size: ButtonSize, className: string): string {
  return ['btn', `btn-${variant}`, size !== 'md' ? `btn-${size}` : '', className].filter(Boolean).join(' ');
}

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant = 'primary', size = 'md', className = '', children, ...rest } = props;
    return (
      <Anchor href={href} className={classes(variant, size, className)} {...rest}>
        {children}
      </Anchor>
    );
  }

  const { href, variant = 'primary', size = 'md', className = '', children, type = 'button', ...rest } = props;
  void href;
  return (
    <button type={type} className={classes(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
