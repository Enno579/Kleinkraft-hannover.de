import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/datenschutz', destination: '/datenschutz.html' },
      { source: '/impressum', destination: '/impressum.html' },
    ];
  },
};

export default nextConfig;
