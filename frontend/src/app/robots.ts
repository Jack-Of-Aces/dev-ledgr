import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/settings'],
      },
    ],
    sitemap: 'https://devledgr.xyz/sitemap.xml',
    host: 'https://devledgr.xyz',
  };
}
