/**
 * CONFIRMATION MODAL
 *
 * Uniwersalny modal "Czy na pewno?" używany w całej aplikacji.
 *
 */

'use client';

import { ReactNode, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'primary' | 'destructive' | 'dark';
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Potwierdź',
  cancelText = 'Anuluj',
  confirmVariant = 'primary',
  loading = false,
}: ConfirmationModalProps) {
  // REFS
  // ================================

  const modalRef = useRef<HTMLDivElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // EFFECTS
  // ================================

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, loading, onClose]);

  // Focus trap & auto-focus
  useEffect(() => {
    if (!isOpen) return;

    // Auto-focus na przycisk potwierdzenia
    confirmButtonRef.current?.focus();

    // Block scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // HANDLERS
  // ================================

  const handleConfirm = async () => {
    await onConfirm();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !loading) {
      onClose();
    }
  };

  // RENDER
  // ================================

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-description"
      >
        {/* Icon & Title */}
        <div className="flex items-start gap-3 mb-4">
          <h3 id="confirmation-modal-title" className="text-lg font-bold text-gray-900">
            {title}
          </h3>
        </div>

        {/* Message */}
        <div
          id="confirmation-modal-description"
          className="text-gray-600 mb-6 text-sm leading-relaxed"
        >
          {message}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="flex-1">
            {cancelText}
          </Button>

          <Button
            ref={confirmButtonRef}
            variant={confirmVariant}
            onClick={handleConfirm}
            loading={loading}
            disabled={loading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
