export type MegaMenuKey = 'product' | 'courses' | 'news' | 'pricing';

export interface MegaMenuProps {
  isOpen: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClose: () => void;
}
