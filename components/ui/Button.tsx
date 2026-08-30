import React from 'react';
import Link from 'next/link';

/**
 * `custom` supplies no colours at all, for the handful of buttons that carry
 * their own background and text colour through `className`.
 *
 * It exists because this component concatenates its variant classes with the
 * caller's `className` without merging them. Two utilities setting the same
 * property therefore both land in the class attribute, and the generated
 * stylesheet's ordering decides the winner rather than the caller. That was
 * invisible while every variant used `text-white` (the overrides agreed with
 * it by accident) and became a real conflict the moment `primary` started
 * using the theme-aware `text-on-primary`.
 */
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'custom';
type ButtonSize = 'sm' | 'md' | 'lg';

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children?: React.ReactNode;
  className?: string;
}

interface ButtonAsButtonProps extends BaseButtonProps, React.ButtonHTMLAttributes<HTMLButtonElement> {
  href?: never;
}

interface ButtonAsLinkProps extends BaseButtonProps {
  href: string;
  onClick?: never;
  type?: never;
  disabled?: never;
}

type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary min-h-11 sm:min-h-0';

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-dark shadow-sm hover:shadow-md active:translate-y-px active:shadow-sm',
  secondary: 'border border-border bg-surface text-muted hover:bg-surface-elevated',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm hover:shadow-md active:translate-y-px active:shadow-sm',
  ghost: 'text-muted hover:bg-surface-elevated',
  custom: '',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const disabledStyles = 'disabled:opacity-50 disabled:cursor-not-allowed';

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  href,
  ...props
}: ButtonProps) {
  const classes = [
    baseStyles,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'w-full' : '',
    disabledStyles,
    className,
  ].filter(Boolean).join(' ');

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  );
}
