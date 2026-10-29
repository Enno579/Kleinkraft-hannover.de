import type { NextConfig } from 'next';

const isPreview = process.env.VERCEL_ENV === 'preview';

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Serve public/index.html at / without a Location header.
      // afterFiles would lose to app/page; a client redirect to /index.html
      // would then fight the 308 below and loop.
      beforeFiles: [{ source: '/', destination: '/index.html' }],
      afterFiles: [
        { source: '/anker-dachanlage', destination: '/anker-dachanlage.html' },
        { source: '/photovoltaik-speicher', destination: '/photovoltaik-speicher.html' },
        { source: '/datenschutz', destination: '/datenschutz.html' },
        { source: '/impressum', destination: '/impressum.html' },
      ],
    };
  },
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/anker-dachanlage.html', destination: '/anker-dachanlage', permanent: true },
      { source: '/photovoltaik-speicher.html', destination: '/photovoltaik-speicher', permanent: true },
      { source: '/datenschutz.html', destination: '/datenschutz', permanent: true },
      { source: '/impressum.html', destination: '/impressum', permanent: true },
    ];
  },
  async headers() {
    if (!isPreview) return [];
    return [
      {
        source: '/:path*',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      },
    ];
  },
};

export default nextConfig;
