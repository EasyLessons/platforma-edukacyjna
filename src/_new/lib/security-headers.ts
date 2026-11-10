/**
 * Nagłówki bezpieczeństwa odpowiedzi Next.js (SEC-16, docs/security/AUDYT-2026-09.md 3d).
 *
 * Jedno miejsce, z którego `next.config.ts` (`headers()`) bierze CSP, HSTS i Permissions-Policy.
 * Funkcja jest czysta (hosty wchodzą parametrem), żeby dało się ją sprawdzić w vitest bez Next.
 *
 * Hosty w CSP wynikają z kodu, nie z domysłów - każdy wpis ma obok plik, który go wymaga.
 * Zmienne `NEXT_PUBLIC_*` są wklejane w czasie builda, więc CSP też liczy się w buildzie
 * (zmiana adresu backendu/sync = nowy deploy, jak dotąd).
 */

export interface SecurityHeadersEnv {
  /** NEXT_PUBLIC_API_URL - backend FastAPI (src/_new/lib/api/client.ts:35). */
  apiUrl?: string;
  /** NEXT_PUBLIC_WHITEBOARD_SYNC_URL - Hocuspocus ws/wss (features/whiteboard/yjs/sync-url.ts:8). */
  syncUrl?: string;
  /** NEXT_PUBLIC_SUPABASE_URL - Realtime + Storage (src/_new/lib/supabase/client.ts:26). */
  supabaseUrl?: string;
  /** `next dev` (NODE_ENV !== 'production'): React Refresh/Turbopack potrzebują `'unsafe-eval'`. */
  dev?: boolean;
}

export const DEFAULT_API_URL = 'http://localhost:8000';
export const DEFAULT_SYNC_URL = 'ws://localhost:1234';

/** Origin (schemat + host + port) z adresu; `null` dla śmieci, żeby nie wstawić ich do nagłówka. */
export function originOf(url: string | undefined, fallback: string): string | null {
  const raw = (url ?? '').trim() || fallback;
  try {
    const parsed = new URL(raw);
    if (!/^(https?|wss?):$/.test(parsed.protocol)) return null;
    return parsed.origin !== 'null' ? parsed.origin : `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/** Para http(s) + ws(s) tego samego hosta - Supabase Realtime i Hocuspocus łączą się po obu. */
function withWebSocket(origin: string): string[] {
  const ws = origin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const http = origin.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
  return Array.from(new Set([http, ws]));
}

// Google Identity Services (GoogleLogin z @react-oauth/google: features/auth/components/
// googleOAuthButton.tsx:4, googleOAuthProvider.tsx:3) - skrypt gsi/client, ramka przycisku,
// XHR do gsi, arkusz gsi/style.
const GOOGLE_GSI = 'https://accounts.google.com';
// Zdjęcia profilowe kont Google (backend/api/v1/auth/avatar_url.py:15, renderowane <img>).
const GOOGLE_AVATARS = 'https://lh3.googleusercontent.com';
// Widget Google Translate z src/app/layout.tsx:33 (element.js -> translate_static z googleapis,
// obrazki z gstatic, tłumaczenia przez translate-pa.googleapis.com).
const TRANSLATE_SCRIPTS = [
  'https://translate.google.com',
  'https://translate.googleapis.com',
  'https://www.gstatic.com',
];
const TRANSLATE_CONNECT = [
  'https://translate.googleapis.com',
  'https://translate-pa.googleapis.com',
  'https://translate.google.com',
];
// Logo widgetu Translate (fonts.gstatic.com/s/i/productlogos/translate/...) - widać w e2e.
const TRANSLATE_IMAGES = [...TRANSLATE_SCRIPTS, 'https://fonts.gstatic.com'];
// Widget pobiera listę języków JSONP-em (<script src="https://translate-pa.googleapis.com/v1/
// supportedLanguages?...&callback=...">) - stąd ten host także w script-src.
const TRANSLATE_JSONP = 'https://translate-pa.googleapis.com';
// Excalidraw rejestruje KAŻDY font z listą src [własny origin, zapasowe esm.sh] (dist: ExcalidrawFontFace.
// createUrls dokleja ASSETS_FALLBACK_URL bezwarunkowo), a Chromium sprawdza CSP dla wszystkich wpisów
// src już przy rejestracji - bez tego hosta konsola dostaje ~460 "Loading the font ... violates CSP"
// na każde otwarcie tablicy, choć żaden request do esm.sh nie wychodzi (fonty są lokalne; pilnuje
// tego e2e "fonty Excalidraw z własnego serwera, bez CDN" w board-engine.spec.ts).
const EXCALIDRAW_FONT_FALLBACK = 'https://esm.sh';
// Daily Prebuilt (features/voice-call/daily-call-provider.tsx:176 - ramka z *.daily.co;
// AUDYT 3d, uwaga 02.10.2026). daily-js z npm ładuje część kodu przez blob: (script-src blob:).
const DAILY_FRAMES = [
  'https://*.daily.co',
  'https://*.dailywebrtc.com',
  'https://*.dailywebrtc.net',
];
// Stary silnik tablicy: pdf.js worker z CDN (features/whiteboard/components/canvas/
// whiteboard-canvas.tsx:1854, toolbar/image-tool.tsx:142). Nowy silnik (board-engine/
// elements/pdf.ts:92) bierze worker z własnego bundla. Usunąć razem ze starym silnikiem (etap F).
const LEGACY_PDF_CDN = 'https://cdn.jsdelivr.net';
// Miniatura szablonu "Matura" w dashboardzie (features/dashboard/components/TemplateSection.tsx:31).
const TEMPLATE_IMAGES = 'https://cdn.galleries.smcloud.net';
// Supabase: Realtime (wss) + Storage (obrazy tablic, awatary) - next.config.ts images.remotePatterns.
const SUPABASE_WILDCARD = 'https://*.supabase.co';

function supabaseSources(supabaseUrl: string | undefined): string[] {
  const origin = originOf(supabaseUrl, SUPABASE_WILDCARD);
  // Produkcja i e2e siedzą na *.supabase.co; własny host (self-hosted) dochodzi jawnie.
  if (!origin || /\.supabase\.co$/.test(new URL(origin).hostname)) {
    return withWebSocket(SUPABASE_WILDCARD);
  }
  return [...withWebSocket(SUPABASE_WILDCARD), ...withWebSocket(origin)];
}

export function buildContentSecurityPolicy(env: SecurityHeadersEnv = {}): string {
  const api = originOf(env.apiUrl, DEFAULT_API_URL) ?? DEFAULT_API_URL;
  const sync = originOf(env.syncUrl, DEFAULT_SYNC_URL) ?? DEFAULT_SYNC_URL;
  const supabase = supabaseSources(env.supabaseUrl);

  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // 'unsafe-inline': next/script inline (layout.tsx:36), GSI, style Excalidraw. Docelowo nonce.
    // 'wasm-unsafe-eval': Excalidraw podzbiorowuje fonty do eksportu SVG/PNG modułem WebAssembly
    // (woff2/harfbuzz w dist, uruchamiane z blob-workera); bez tego każda rodzina fontów
    // "pada" lokalnie i Excalidraw sięga po zapasowy CDN esm.sh. Sam JS eval dalej zabroniony.
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(env.dev ? ["'unsafe-eval'"] : []),
      'blob:',
      GOOGLE_GSI,
      ...TRANSLATE_SCRIPTS,
      TRANSLATE_JSONP,
      LEGACY_PDF_CDN,
    ],
    'style-src': ["'self'", "'unsafe-inline'", GOOGLE_GSI, ...TRANSLATE_SCRIPTS],
    // data:/blob: - płótno, eksport PNG, pliki Excalidraw (dataURL), miniatury SVG zasobów.
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      SUPABASE_WILDCARD,
      GOOGLE_AVATARS,
      TEMPLATE_IMAGES,
      ...TRANSLATE_IMAGES,
    ],
    // KaTeX (katex/dist/katex.min.css z npm, globals.css:2), Excalidraw (/excalidraw-assets/),
    // Plus Jakarta/Playfair (next/font/local) - wszystko z własnego originu; esm.sh patrz wyżej.
    'font-src': ["'self'", 'data:', EXCALIDRAW_FONT_FALLBACK],
    'connect-src': [
      "'self'",
      ...withWebSocket(api),
      ...withWebSocket(sync),
      ...supabase,
      GOOGLE_GSI,
      ...TRANSLATE_CONNECT,
      LEGACY_PDF_CDN,
    ],
    'frame-src': [GOOGLE_GSI, ...DAILY_FRAMES],
    // pdf.js (board-engine/elements/pdf.ts:92) i Excalidraw (subset fontów) - workery z bundla/blob.
    'worker-src': ["'self'", 'blob:'],
    'media-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };

  const parts = Object.entries(directives).map(
    ([name, sources]) => `${name} ${Array.from(new Set(sources)).join(' ')}`
  );
  // Tylko za https (produkcja, preview Vercel): lokalnie backend jest na http://localhost
  // i przeglądarka podniosłaby go do https.
  if (api.startsWith('https:')) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

/** Permissions-Policy: mikrofon/kamera/ekran tylko dla nas i ramki Daily (AUDYT 3d, uwaga 02.10). */
export const PERMISSIONS_POLICY = [
  'microphone=(self "https://*.daily.co")',
  'camera=(self "https://*.daily.co")',
  'display-capture=(self "https://*.daily.co")',
  'geolocation=()',
  'payment=()',
].join(', ');

/** 2 lata + subdomeny + preload (Vercel i tak wymusza https; na http nagłówek jest ignorowany). */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains; preload';

export function buildSecurityHeaders(
  env: SecurityHeadersEnv = {}
): Array<{ key: string; value: string }> {
  return [
    { key: 'Content-Security-Policy', value: buildContentSecurityPolicy(env) },
    { key: 'Strict-Transport-Security', value: STRICT_TRANSPORT_SECURITY },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Dublet frame-ancestors 'none' dla starszych przeglądarek.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  ];
}
