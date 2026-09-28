import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_PROXY_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://devledgr.onrender.com';

    return [
      {
        source: '/api/launchpad/:path*',
        destination: `${backendUrl}/api/launchpad/:path*`,
      },
      {
        source: '/api/jobBoard/:path*',
        destination: `${backendUrl}/api/jobBoard/:path*`,
      },
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/api/v1/:path*`,
      },
      {
        source: '/api/auth/me',
        destination: `${backendUrl}/api/auth/me`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: '/api/dev/:path*',
        destination: `${backendUrl}/api/dev/:path*`,
      },
    ];
  },
};

export default nextConfig;
