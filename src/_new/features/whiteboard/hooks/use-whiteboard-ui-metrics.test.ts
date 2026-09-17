import { describe, it, expect } from 'vitest';
import {
  getWhiteboardUiMetrics,
  safeInset,
  shouldShowTooSmallOverlay,
} from './use-whiteboard-ui-metrics';

describe('getWhiteboardUiMetrics - uklad telefonu', () => {
  it('iPhone w pionie (dotyk, 390x664): uklad telefonu, pion', () => {
    const m = getWhiteboardUiMetrics(390, 664, true);
    expect(m.isPhoneLayout).toBe(true);
    expect(m.isPhonePortrait).toBe(true);
    expect(m.isMobile).toBe(true);
    expect(m.boardHeader.fallbackStackVertical).toBe(true);
  });

  it('iPhone w poziomie (dotyk, 750x340): uklad telefonu, nie pion, wyszukiwarka zwinieta', () => {
    const m = getWhiteboardUiMetrics(750, 340, true);
    expect(m.isPhoneLayout).toBe(true);
    expect(m.isPhonePortrait).toBe(false);
    expect(m.isMobile).toBe(true);
    // W poziomie przyciski naglowka w rzedzie - w kolumnie wjechalyby na pasek narzedzi.
    expect(m.boardHeader.fallbackStackVertical).toBe(false);
  });

  it('Pixel 7 w poziomie (dotyk, 863x360, szerszy niz mobileMax) to tez telefon', () => {
    const m = getWhiteboardUiMetrics(863, 360, true);
    expect(m.isPhoneLayout).toBe(true);
    expect(m.isMobile).toBe(true);
  });

  it('tablet (dotyk, 1024x768) nie dostaje ukladu telefonu', () => {
    const m = getWhiteboardUiMetrics(1024, 768, true);
    expect(m.isPhoneLayout).toBe(false);
    expect(m.isMobile).toBe(false);
  });
});

describe('getWhiteboardUiMetrics - desktop bez zmian', () => {
  // Wzor sprzed zmiany: isMobile zalezal wylacznie od szerokosci.
  const legacyIsMobile = (w: number) => w > 0 && w <= 760;

  it.each([
    [1920, 1080],
    [1440, 900],
    [1280, 720],
    [1024, 400], // niskie okno na komputerze
    [700, 900], // waskie okno na komputerze
    [360, 500],
  ])('bez dotyku %ix%i: isMobile jak dawniej, nigdy uklad telefonu', (w, h) => {
    const m = getWhiteboardUiMetrics(w, h, false);
    expect(m.isMobile).toBe(legacyIsMobile(w));
    expect(m.isPhoneLayout).toBe(false);
    expect(m.isPhonePortrait).toBe(false);
    expect(m.boardHeader.fallbackStackVertical).toBe(legacyIsMobile(w));
  });

  it('domyslne argumenty (wywolanie tylko z szerokoscia) daja zachowanie desktopowe', () => {
    expect(getWhiteboardUiMetrics(390).isPhoneLayout).toBe(false);
    expect(getWhiteboardUiMetrics(390).isMobile).toBe(true);
  });
});

describe('shouldShowTooSmallOverlay', () => {
  it('telefon w poziomie NIE jest blokowany (wczesniej cala tablica byla zasloniona)', () => {
    expect(shouldShowTooSmallOverlay(844, 390, true)).toBe(false);
    expect(shouldShowTooSmallOverlay(750, 340, true)).toBe(false);
  });

  it('maly iPhone w pionie (375x553) NIE jest blokowany', () => {
    expect(shouldShowTooSmallOverlay(375, 553, true)).toBe(false);
  });

  it('za male okno na komputerze nadal pokazuje komunikat', () => {
    expect(shouldShowTooSmallOverlay(1200, 600, false)).toBe(true);
    expect(shouldShowTooSmallOverlay(320, 900, false)).toBe(true);
  });

  it('normalne okno na komputerze - bez komunikatu', () => {
    expect(shouldShowTooSmallOverlay(1440, 900, false)).toBe(false);
  });

  it('przed pierwszym pomiarem (szerokosc 0) - bez komunikatu', () => {
    expect(shouldShowTooSmallOverlay(0, 0, false)).toBe(false);
  });
});

describe('safeInset', () => {
  it('dokleja env(safe-area-inset-*) z domyslnym 0px', () => {
    expect(safeInset(16, 'top')).toBe('calc(16px + env(safe-area-inset-top, 0px))');
    expect(safeInset(20, 'right')).toBe('calc(20px + env(safe-area-inset-right, 0px))');
  });
});
