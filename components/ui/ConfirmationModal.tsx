'use client';

import { ReactNode } from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmDisabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  error?: string | null;
  variant?: 'danger' | 'warning' | 'default';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmDisabled = false,
  isLoading = false,
  loadingText = 'Loading...',
  error = null,
  variant = 'danger',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const confirmButtonStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    default: 'bg-primary text-white hover:bg-primary-dark',
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-lg max-w-md w-full p-6 pb-[calc(theme(spacing.6)+env(safe-area-inset-bottom))]">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          {title}
        </h3>

        <div className="mb-4">{children}</div>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-warning/10 border border-warning/30 text-warning rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border border-border text-muted rounded-lg font-medium hover:bg-surface-elevated transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
            className={`px-4 py-2 text-white rounded-lg font-medium transition-colors disabled:opacity-50 ${confirmButtonStyles[variant]}`}
          >
            {isLoading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
