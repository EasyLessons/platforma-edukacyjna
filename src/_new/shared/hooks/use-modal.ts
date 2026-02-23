/**
 * USE MODAL HOOK
 *
 * Hook który obsługuje standardowe zachowania modala:
 * - Focus na pierwszym input przy otwarciu
 * - Zamknięcie przy ESC
 * - Zamknięcie przy kliknięciu poza modal
 * - Blokada scroll na body
 *
 */

import { useEffect, RefObject } from 'react';

interface UseModalOptions {
  isOpen: boolean;
  onClose: () => void;
  modalRef: RefObject<HTMLElement | null>;
  focusRef?: RefObject<HTMLInputElement | HTMLButtonElement | null>;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  preventCloseWhen?: () => boolean;
  blockScroll?: boolean;
}

export function useModal({
  isOpen,
  onClose,
  modalRef,
  focusRef,
  closeOnEscape = true,
  closeOnClickOutside = true,
  preventCloseWhen = () => false,
  blockScroll = true,
}: UseModalOptions) {
  // Block scroll
  useEffect(() => {
    if (!isOpen || !blockScroll) return;

    // Zapisz poprzednie wartości
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Oblicz szerokość scrollbara
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    // Blokuj scroll i dodaj padding żeby nie było "skoku"
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen, blockScroll]);

  // Auto focus
  useEffect(() => {
    if (isOpen && focusRef?.current) {
      // Opóźnienie żeby modal się zdążył wyrenderować
      const timeoutId = setTimeout(() => {
        focusRef.current?.focus();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen, focusRef]);

  // Close on escape
   useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !preventCloseWhen()) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose, preventCloseWhen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen || !closeOnClickOutside) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node) &&
        !preventCloseWhen()
      ) {
        onClose();
      }
    };

    // Małe opóźnienie żeby nie zamknąć modala od razu po otwarciu
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeOnClickOutside, modalRef, onClose, preventCloseWhen]);
}
