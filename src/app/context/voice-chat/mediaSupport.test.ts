import { describe, it, expect, afterEach } from 'vitest';
import { getVoiceSupportIssue, isInAppBrowser, mapGetUserMediaError } from './mediaSupport';

const UA = {
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  messengerIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/470.0.0.40.108;FBBV/123]',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/AP2A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.40.108;]',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 340.0.0.0 (iPhone14,5; iOS 17_5; pl_PL)',
};

describe('isInAppBrowser', () => {
  it.each([
    ['Messenger iOS', UA.messengerIos],
    ['Facebook Android', UA.facebookAndroid],
    ['Instagram iOS', UA.instagramIos],
  ])('wykrywa: %s', (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(true);
  });

  it.each([
    ['Safari iOS', UA.safariIos],
    ['Chrome iOS', UA.chromeIos],
    ['Chrome Android', UA.chromeAndroid],
    ['Chrome desktop', UA.desktopChrome],
  ])('nie blokuje zwyklej przegladarki: %s', (_name, ua) => {
    expect(isInAppBrowser(ua)).toBe(false);
  });
});

describe('mapGetUserMediaError', () => {
  it.each([
    ['NotAllowedError', 'mic-denied'],
    ['PermissionDeniedError', 'mic-denied'],
    ['SecurityError', 'mic-denied'],
    ['NotFoundError', 'mic-not-found'],
    ['OverconstrainedError', 'mic-not-found'],
    ['NotReadableError', 'mic-busy'],
    ['AbortError', 'mic-busy'],
    ['TypeError', 'unknown'],
  ])('%s -> %s', (name, code) => {
    const error = mapGetUserMediaError(Object.assign(new Error(name), { name }));
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(10);
  });

  it('nie wybucha na null/nie-bledach', () => {
    expect(mapGetUserMediaError(null).code).toBe('unknown');
    expect(mapGetUserMediaError('x').code).toBe('unknown');
  });
});

describe('getVoiceSupportIssue', () => {
  const originalUa = window.navigator.userAgent;
  const originalMedia = Object.getOwnPropertyDescriptor(window.navigator, 'mediaDevices');

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUa,
      configurable: true,
    });
    if (originalMedia) Object.defineProperty(window.navigator, 'mediaDevices', originalMedia);
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
  });

  function setEnv(ua: string, hasMedia: boolean, secure = true) {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    Object.defineProperty(window.navigator, 'mediaDevices', {
      value: hasMedia ? { getUserMedia: () => Promise.resolve() } : undefined,
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  }

  it('Safari z API i https -> brak problemu', () => {
    setEnv(UA.safariIos, true);
    expect(getVoiceSupportIssue()).toBeNull();
  });

  it('przegladarka wbudowana ma pierwszenstwo, nawet gdy API istnieje', () => {
    setEnv(UA.messengerIos, true);
    expect(getVoiceSupportIssue()?.code).toBe('in-app-browser');
  });

  it('brak https', () => {
    setEnv(UA.safariIos, true, false);
    expect(getVoiceSupportIssue()?.code).toBe('insecure-context');
  });

  it('brak mediaDevices', () => {
    setEnv(UA.safariIos, false);
    expect(getVoiceSupportIssue()?.code).toBe('unsupported');
  });
});
