import type { NextConfig } from 'next';
import { buildSecurityHeaders } from './src/_new/lib/security-headers';

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 SECURITY HEADERS (SEC-16) - CSP, HSTS, Permissions-Policy
  // ═══════════════════════════════════════════════════════════════════════════
  // Treść i lista hostów: src/_new/lib/security-headers.ts (z testem jednostkowym).
  // Hosty backendu/sync są czytane z env w czasie builda (jak wszystkie NEXT_PUBLIC_*).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: buildSecurityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL,
          syncUrl: process.env.NEXT_PUBLIC_WHITEBOARD_SYNC_URL,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          dev: process.env.NODE_ENV !== 'production',
        }),
      },
    ];
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🖼️ IMAGE OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════════════
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⚡ PERFORMANCE
  // ═══════════════════════════════════════════════════════════════════════════
  compress: true,
  poweredByHeader: false, // Ukryj "X-Powered-By: Next.js" header
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],
};

export default nextConfig;
