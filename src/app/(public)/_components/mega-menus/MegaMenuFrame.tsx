import type { ReactNode } from 'react';

import type { MegaMenuProps } from './types';

interface MegaMenuFrameProps extends MegaMenuProps {
  children: ReactNode;
}

export default function MegaMenuFrame({
  isOpen,
  onMouseEnter,
  onMouseLeave,
  onClose,
  children,
}: MegaMenuFrameProps) {
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
        style={{ top: '64px' }}
        onClick={onClose}
      />

      <div
        className="fixed left-0 right-0 top-16 z-50 mega-menu-extend"
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        {/* Invisible hover bridge: keeps pointer inside menu zone without creating a visual gap. */}
        <div className="absolute inset-x-0 -top-3 h-3" aria-hidden="true" />

        <div className="bg-white" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
          <div className="max-w-[1400px] mx-auto px-6 pb-8">{children}</div>
        </div>
      </div>
    </>
  );
}
