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
    ];
  },
};

export default nextConfig;
