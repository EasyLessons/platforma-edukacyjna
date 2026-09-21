'use client';

import { useEffect, useMemo, useState } from 'react';

const BREAKPOINTS = {
  mobileMax: 760,
  onlineUsersCompactMax: 1299,
  compactHeaderMin: 1300,
  fullHeaderMin: 1641,
  /** Telefon w poziomie: dotyk i niski ekran (szerokosc bywa > mobileMax). */
  phoneLandscapeMaxHeight: 500,
};

/**
 * Pozycja od krawedzi z uwzglednieniem wyciecia/paska iOS (safe area).
 * Na desktopie i bez `viewport-fit=cover` env() daje 0, wiec wynik jest
 * identyczny jak sama liczba pikseli.
 */
export function safeInset(px: number, side: 'top' | 'right' | 'bottom' | 'left'): string {
  return `calc(${px}px + env(safe-area-inset-${side}, 0px))`;
}

const BASE_SPACING = {
  top: 16,
  side: 16,
  controlHeight: 56,
  gap: 10,
};

export interface WhiteboardUiMetrics {
  windowWidth: number;
  windowHeight: number;
  isMobile: boolean;
  /** Urzadzenie dotykowe (pointer: coarse) - telefon/tablet. */
  isTouchDevice: boolean;
  /**
   * Uklad telefonu: dotyk + waski ekran (pion) albo niski ekran (poziom).
   * Tylko tu zmienia sie uklad kontrolek - desktop (bez dotyku) zostaje bez zmian.
   */
  isPhoneLayout: boolean;
  isPhonePortrait: boolean;
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

/**
 * Nakladka "Zbyt maly obszar roboczy". Ma sens tylko dla okna przegladarki
 * na komputerze - na telefonie blokowala cala tablice w poziomie (wysokosc
 * zawsze < 600 px) i na malych iPhone'ach takze w pionie.
 */
export function shouldShowTooSmallOverlay(
  windowWidth: number,
  windowHeight: number,
  isTouchDevice: boolean
): boolean {
  if (windowWidth <= 0 || isTouchDevice) return false;
  return windowWidth <= 320 || windowHeight <= 600;
}

export function getWhiteboardUiMetrics(
  windowWidth: number,
  windowHeight = 0,
  isTouchDevice = false
): WhiteboardUiMetrics {
  const isNarrow = windowWidth > 0 && windowWidth <= BREAKPOINTS.mobileMax;
  // Orientacja z proporcji, nie z szerokosci: iPhone 13 w poziomie ma 750 px,
  // czyli mniej niz mobileMax, a to nadal uklad poziomy.
  const isPhoneLandscape =
    isTouchDevice &&
    windowHeight > 0 &&
    windowHeight <= BREAKPOINTS.phoneLandscapeMaxHeight &&
    windowWidth > windowHeight;
  const isMobile = isNarrow || isPhoneLandscape;
  const isPhoneLayout = isTouchDevice && isMobile;
  const isPhonePortrait = isPhoneLayout && !isPhoneLandscape;
  const isOnlineUsersCompact = windowWidth > 0 && windowWidth <= BREAKPOINTS.onlineUsersCompactMax;
  const showFullHeader = windowWidth >= BREAKPOINTS.fullHeaderMin;
  const showCompactHeader =
    windowWidth >= BREAKPOINTS.compactHeaderMin && windowWidth < BREAKPOINTS.fullHeaderMin;
  const isCompactHeader = !showFullHeader;

  return {
    windowWidth,
    windowHeight,
    isMobile,
    isTouchDevice,
    isPhoneLayout,
    isPhonePortrait,
    isCompactHeader,
    showCompactHeader,
    showFullHeader,
    spacing: BASE_SPACING,
    boardHeader: {
      fallbackStackVertical: isNarrow && !isPhoneLandscape,
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
  const [windowHeight, setWindowHeight] = useState(0);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const coarse =
      typeof window.matchMedia === 'function' ? window.matchMedia('(pointer: coarse)') : null;
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
      setIsTouchDevice(!!coarse?.matches);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    coarse?.addEventListener?.('change', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      coarse?.removeEventListener?.('change', handleResize);
    };
  }, []);

  return useMemo(
    () => getWhiteboardUiMetrics(windowWidth, windowHeight, isTouchDevice),
    [windowWidth, windowHeight, isTouchDevice]
  );
}
