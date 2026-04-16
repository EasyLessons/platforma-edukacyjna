import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔒 SECURITY HEADERS
  // ═══════════════════════════════════════════════════════════════════════════
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
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
