import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/salads/flavor', destination: '/salads-by-flavor', permanent: true },
      { source: '/salads/season', destination: '/salads-by-season', permanent: true },
    ];
  },
};

export default nextConfig;
