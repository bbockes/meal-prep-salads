import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/salads/flavor', destination: '/salads-by-flavor', permanent: true },
      { source: '/salads/season', destination: '/salads-by-season', permanent: true },
    ];
  },
};

export default nextConfig;
