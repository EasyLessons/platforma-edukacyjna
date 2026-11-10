import { describe, it, expect } from 'vitest';
import {
  DEFAULT_API_URL,
  DEFAULT_SYNC_URL,
  PERMISSIONS_POLICY,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  originOf,
} from './security-headers';

/** Źródła jednej dyrektywy CSP (np. `connect-src`). */
function sources(csp: string, directive: string): string[] {
  const part = csp.split(';').find((p) => p.trim().startsWith(`${directive} `));
  if (!part) throw new Error(`brak dyrektywy ${directive} w: ${csp}`);
  return part.trim().split(/\s+/).slice(1);
}

describe('originOf', () => {
  it('zwraca origin bez ścieżki i używa domyślnego adresu, gdy env puste', () => {
    expect(originOf('https://api.easylesson.app/api/v1', 'x')).toBe('https://api.easylesson.app');
    expect(originOf(undefined, DEFAULT_API_URL)).toBe(DEFAULT_API_URL);
    expect(originOf('   ', DEFAULT_SYNC_URL)).toBe(DEFAULT_SYNC_URL);
  });

  it('odrzuca śmieci i niedozwolone schematy', () => {
    expect(originOf('nie-url', 'x')).toBeNull();
    expect(originOf('javascript:alert(1)', 'x')).toBeNull();
    expect(originOf('file:///etc/passwd', 'x')).toBeNull();
  });
});

describe('buildContentSecurityPolicy', () => {
  it('bez env: backend i sync z localhost, Supabase przez *.supabase.co', () => {
    const connect = sources(buildContentSecurityPolicy(), 'connect-src');
    expect(connect).toContain("'self'");
    expect(connect).toContain('http://localhost:8000');
    expect(connect).toContain('ws://localhost:1234');
    expect(connect).toContain('https://*.supabase.co');
    expect(connect).toContain('wss://*.supabase.co');
  });

  it('produkcja: hosty z env (backend https, sync wss) w connect-src + upgrade-insecure-requests', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'https://api.easylesson.app',
      syncUrl: 'wss://sync.easylesson.app/ws',
      supabaseUrl: 'https://abc.supabase.co',
    });
    const connect = sources(csp, 'connect-src');
    expect(connect).toContain('https://api.easylesson.app');
    expect(connect).toContain('wss://api.easylesson.app');
    expect(connect).toContain('wss://sync.easylesson.app');
    expect(connect).toContain('https://sync.easylesson.app');
    // *.supabase.co już to pokrywa - bez dubla konkretnego hosta
    expect(connect).not.toContain('https://abc.supabase.co');
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('e2e/dev: hosty z portów e2e, bez upgrade-insecure-requests (backend na http)', () => {
    const csp = buildContentSecurityPolicy({
      apiUrl: 'http://localhost:8210',
      syncUrl: 'ws://localhost:1294',
    });
    const connect = sources(csp, 'connect-src');
    expect(connect).toContain('http://localhost:8210');
    expect(connect).toContain('ws://localhost:1294');
    expect(connect).not.toContain('http://localhost:8000');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('własny host Supabase (nie *.supabase.co) dochodzi jawnie z wss', () => {
    const connect = sources(
      buildContentSecurityPolicy({ supabaseUrl: 'https://supabase.szkola.pl' }),
      'connect-src'
    );
    expect(connect).toContain('https://supabase.szkola.pl');
    expect(connect).toContain('wss://supabase.szkola.pl');
  });

  it('connect-src bez wildcardu `*` ani samych schematów', () => {
    for (const env of [
      {},
      { apiUrl: 'https://api.easylesson.app', syncUrl: 'wss://sync.easylesson.app' },
    ]) {
      const connect = sources(buildContentSecurityPolicy(env), 'connect-src');
      expect(connect).not.toContain('*');
      expect(connect).not.toContain('https:');
      expect(connect).not.toContain('wss:');
      expect(connect).not.toContain('http:');
      expect(connect).not.toContain('ws:');
    }
  });

  it('śmieciowy env nie trafia do nagłówka - wraca domyślny localhost', () => {
    const connect = sources(
      buildContentSecurityPolicy({ apiUrl: 'nie url', syncUrl: 'javascript:1' }),
      'connect-src'
    );
    expect(connect).toContain('http://localhost:8000');
    expect(connect).toContain('ws://localhost:1234');
    expect(connect.some((s) => s.startsWith('javascript:'))).toBe(false);
  });

  it('Daily: ramka z *.daily.co, Google GSI w script/frame/connect/style', () => {
    const csp = buildContentSecurityPolicy();
    const frames = sources(csp, 'frame-src');
    expect(frames).toEqual(
      expect.arrayContaining([
        'https://accounts.google.com',
        'https://*.daily.co',
        'https://*.dailywebrtc.com',
        'https://*.dailywebrtc.net',
      ])
    );
    expect(frames).not.toContain("'self'");
    for (const directive of ['script-src', 'style-src', 'connect-src']) {
      expect(sources(csp, directive)).toContain('https://accounts.google.com');
    }
    expect(sources(csp, 'script-src')).toContain('blob:');
  });

  it('Translate: JSONP z translate-pa w script-src; fonty Excalidraw: zapasowe esm.sh tylko w font-src', () => {
    const csp = buildContentSecurityPolicy();
    expect(sources(csp, 'script-src')).toContain('https://translate-pa.googleapis.com');
    expect(sources(csp, 'font-src')).toEqual(["'self'", 'data:', 'https://esm.sh']);
    expect(sources(csp, 'script-src')).not.toContain('https://esm.sh');
    expect(sources(csp, 'connect-src')).not.toContain('https://esm.sh');
  });

  it('bez cdn.jsdelivr.net (pdf.js worker starego silnika, usunięty w etapie F)', () => {
    expect(buildContentSecurityPolicy()).not.toContain('cdn.jsdelivr.net');
  });

  it('media-src: wideo hero landingu z R2 (jeden konkretny bucket, bez wildcardu)', () => {
    const media = sources(buildContentSecurityPolicy(), 'media-src');
    expect(media).toEqual([
      "'self'",
      'blob:',
      'https://pub-9f3b498e57d045a682d3009381570da0.r2.dev',
    ]);
  });

  it('twarde dyrektywy: object-src none, frame-ancestors none, base-uri/form-action self', () => {
    const csp = buildContentSecurityPolicy();
    expect(sources(csp, 'object-src')).toEqual(["'none'"]);
    expect(sources(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(sources(csp, 'base-uri')).toEqual(["'self'"]);
    expect(sources(csp, 'form-action')).toEqual(["'self'"]);
    expect(sources(csp, 'worker-src')).toEqual(["'self'", 'blob:']);
  });

  it("'wasm-unsafe-eval' zawsze (subset fontów Excalidraw), 'unsafe-eval' tylko w trybie dev", () => {
    expect(sources(buildContentSecurityPolicy(), 'script-src')).toContain("'wasm-unsafe-eval'");
    expect(sources(buildContentSecurityPolicy(), 'script-src')).not.toContain("'unsafe-eval'");
    expect(sources(buildContentSecurityPolicy({ dev: false }), 'script-src')).not.toContain(
      "'unsafe-eval'"
    );
    expect(sources(buildContentSecurityPolicy({ dev: true }), 'script-src')).toContain(
      "'unsafe-eval'"
    );
  });
});

describe('buildSecurityHeaders', () => {
  const headers = buildSecurityHeaders({ apiUrl: 'https://api.easylesson.app' });
  const get = (key: string) => headers.find((h) => h.key === key)?.value;

  it('CSP, HSTS, Permissions-Policy, nosniff, X-Frame-Options DENY, Referrer-Policy', () => {
    expect(get('Content-Security-Policy')).toContain('https://api.easylesson.app');
    expect(get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(get('Permissions-Policy')).toBe(PERMISSIONS_POLICY);
    expect(get('X-Content-Type-Options')).toBe('nosniff');
    expect(get('X-Frame-Options')).toBe('DENY');
    expect(get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('Permissions-Policy: mikrofon/kamera/ekran dla self i Daily, geolokalizacja i płatności puste', () => {
    expect(PERMISSIONS_POLICY).toContain('microphone=(self "https://*.daily.co")');
    expect(PERMISSIONS_POLICY).toContain('camera=(self "https://*.daily.co")');
    expect(PERMISSIONS_POLICY).toContain('display-capture=(self "https://*.daily.co")');
    expect(PERMISSIONS_POLICY).toContain('geolocation=()');
    expect(PERMISSIONS_POLICY).toContain('payment=()');
  });

  it('bez przestarzałego X-XSS-Protection i bez Report-Only', () => {
    expect(get('X-XSS-Protection')).toBeUndefined();
    expect(get('Content-Security-Policy-Report-Only')).toBeUndefined();
  });
});
