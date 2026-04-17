import React, { ReactNode } from 'react';

type TooltipPosition = 'top' | 'right' | 'bottom' | 'left';

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  position?: TooltipPosition;
  className?: string; // Optional class for the wrapper
  tooltipClassName?: string; // Optional extra classes for the tooltip itself
}

export function Tooltip({ 
  children, 
  content, 
  position = 'top', 
  className = '',
  tooltipClassName = '' 
}: TooltipProps) {
  const getPositionClasses = () => {
    switch (position) {
      case 'bottom':
        return 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2';
      case 'top':
        return 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2';
      case 'left':
        return 'right-[calc(100%+8px)] top-1/2 -translate-y-1/2';
      case 'right':
        return 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2';
      default:
        return 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'bottom':
        return 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-800 border-x-transparent border-t-transparent border-b-[6px] border-x-[6px] border-t-0';
      case 'top':
        return 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-x-transparent border-b-transparent border-t-[6px] border-x-[6px] border-b-0';
      case 'left':
        return 'left-full top-1/2 -translate-y-1/2 border-l-gray-800 border-y-transparent border-r-transparent border-l-[6px] border-y-[6px] border-r-0';
      case 'right':
        return 'right-full top-1/2 -translate-y-1/2 border-r-gray-800 border-y-transparent border-l-transparent border-r-[6px] border-y-[6px] border-l-0';
      default:
        return 'top-full left-1/2 -translate-x-1/2 border-t-gray-800 border-x-transparent border-b-transparent border-t-[6px] border-x-[6px] border-b-0';
    }
  };

  return (
    <div className={`relative group inline-flex items-center justify-center shrink-0 ${className}`}>
      {children}
      <div 
        className={`absolute ${getPositionClasses()} z-[1000] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${tooltipClassName}`}
      >
        <div className="bg-gray-800 text-white text-xs font-medium px-2.5 py-1.5 rounded shadow-lg whitespace-nowrap">
          {content}
        </div>
        <div className={`absolute w-0 h-0 border-solid ${getArrowClasses()}`} />
      </div>
    </div>
  );
}
