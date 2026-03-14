'use client';

import { useEffect, useMemo, useState } from 'react';

const BREAKPOINTS = {
  mobileMax: 760,
  onlineUsersCompactMax: 1299,
  compactHeaderMin: 1300,
  fullHeaderMin: 1641,
};

const BASE_SPACING = {
  top: 16,
  side: 16,
  controlHeight: 56,
  gap: 10,
};

export interface WhiteboardUiMetrics {
  windowWidth: number;
  isMobile: boolean;
  isCompactHeader: boolean;
  showCompactHeader: boolean;
  showFullHeader: boolean;
  spacing: {
    top: number;
    side: number;
    controlHeight: number;
    gap: number;
  };
  boardHeader: {
    fallbackStackVertical: boolean;
    fallbackButtonSize: number;
    fallbackIconSize: number;
  };
  smartSearch: {
    showOutsideBrowseButton: boolean;
    collapsedWidth: number;
    mobileExpandedWidth: string;
    mobileMaxWidth: string;
    disableExpandAnimation: boolean;
  };
  onlineUsers: {
    topOffset: number;
    stripHeight: number;
    stripPaddingX: number;
    showClock: boolean;
    compactButtons: boolean;
  };
}

function getWhiteboardUiMetrics(windowWidth: number): WhiteboardUiMetrics {
  const isMobile = windowWidth > 0 && windowWidth <= BREAKPOINTS.mobileMax;
  const isOnlineUsersCompact =
    windowWidth > 0 && windowWidth <= BREAKPOINTS.onlineUsersCompactMax;
  const showFullHeader = windowWidth >= BREAKPOINTS.fullHeaderMin;
  const showCompactHeader =
    windowWidth >= BREAKPOINTS.compactHeaderMin && windowWidth < BREAKPOINTS.fullHeaderMin;
  const isCompactHeader = !showFullHeader;

  return {
    windowWidth,
    isMobile,
    isCompactHeader,
    showCompactHeader,
    showFullHeader,
    spacing: BASE_SPACING,
    boardHeader: {
      fallbackStackVertical: isMobile,
      fallbackButtonSize: 56,
      fallbackIconSize: 20,
    },
    smartSearch: {
      showOutsideBrowseButton: !isMobile,
      collapsedWidth: isMobile ? 52 : 56,
      mobileExpandedWidth: '90vw',
      mobileMaxWidth: '500px',
      disableExpandAnimation: windowWidth > BREAKPOINTS.mobileMax && isCompactHeader,
    },
    onlineUsers: {
      topOffset: BASE_SPACING.top,
      stripHeight: 56,
      stripPaddingX: isMobile ? 12 : 20,
      showClock: !isOnlineUsersCompact,
      compactButtons: isOnlineUsersCompact,
    },
  };
}

export function useWhiteboardUiMetrics(): WhiteboardUiMetrics {
  const [windowWidth, setWindowWidth] = useState(0);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => getWhiteboardUiMetrics(windowWidth), [windowWidth]);
}
