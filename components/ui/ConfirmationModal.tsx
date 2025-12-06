'use client';

import { ReactNode, useEffect, useRef } from 'react';

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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const variantStyles = {
    danger: 'btn-error',
    warning: 'btn-warning',
    default: 'btn-primary',
  };

  const variantIcon = {
    danger: 'icon-[tabler--alert-triangle]',
    warning: 'icon-[tabler--alert-circle]',
    default: 'icon-[tabler--info-circle]',
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
    >
      <div className="modal-box">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 ${variant === 'danger' ? 'text-error' : variant === 'warning' ? 'text-warning' : 'text-info'}`}>
            <span className={`${variantIcon[variant]} size-6`} />
          </div>
          <div className="flex-1">
            <h3 className="modal-title text-lg font-semibold">{title}</h3>
            <div className="mt-2 text-base-content/70">
              {children}
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-error mt-4">
            <span className="icon-[tabler--alert-circle] size-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-action">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn btn-outline"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || confirmDisabled}
            className={`btn ${variantStyles[variant]}`}
          >
            {isLoading && <span className="loading loading-spinner loading-sm" />}
            {isLoading ? loadingText : confirmText}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>close</button>
      </form>
    </dialog>
  );
}
