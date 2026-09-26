import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { BrandHeader } from '@/components/layout/BrandHeader';
import { BrandFooter } from '@/components/layout/BrandFooter';
import { ToastOverlay } from '@/components/ui/ToastOverlay';
import { AuthModal } from '@/components/ui/AuthModal';
import { SupabaseAuthSync } from '@/components/auth/SupabaseAuthSync';
import { RoleSwitcher } from '@/components/auth/RoleSwitcher';


export const viewport: Viewport = {
  themeColor: '#09090B',
  colorScheme: 'dark light',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://devledgr.io'),
  title: {
    default: 'DevLedgr: Proof of work, not another tutorial clone',
    template: '%s · DevLedgr',
  },
  description:
    'A verifiable engineering ledger. Solve production-grade operational problems, run your code against live mock infrastructure, and earn a cryptographically signed portfolio URL valid for 365 days.',
  keywords: [
    'developer portfolio',
    'proof of work',
    'software engineer',
    'junior developer jobs',
    'coding challenges',
    'CI test verification',
    'cryptographic ledger',
    'ATS safe resume',
    'technical hiring',
  ],
  authors: [{ name: 'DevLedgr Core Team', url: 'https://devledgr.io' }],
  creator: 'DevLedgr',
  publisher: 'DevLedgr',
  applicationName: 'DevLedgr',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://devledgr.io',
    siteName: 'DevLedgr',
    title: 'DevLedgr: Proof of work, not another tutorial clone',
    description:
      'A ledger, not a resume. Solve production challenges, pass automated CI test harnesses, and earn an immutable 1-year public portfolio URL.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'DevLedgr: Proof of work, not another tutorial clone.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DevLedgr: Proof of work, not another tutorial clone',
    description:
      'A ledger, not a resume. Solve production challenges, pass automated CI test harnesses, and earn an immutable 1-year public portfolio URL.',
    creator: '@devledgr',
    site: '@devledgr',
    images: ['/twitter-image'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://devledgr.io/#website',
        url: 'https://devledgr.io',
        name: 'DevLedgr',
        description: 'Cryptographic ledger of engineering proof-of-work for software engineers.',
        publisher: {
          '@id': 'https://devledgr.io/#organization',
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://devledgr.io/ideas?search={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
      {
        '@type': 'Organization',
        '@id': 'https://devledgr.io/#organization',
        name: 'DevLedgr',
        url: 'https://devledgr.io',
        logo: 'https://devledgr.io/icon',
        sameAs: ['https://github.com/Jack-Of-Aces/dev-ledgr'],
      },
      {
        '@type': 'SoftwareApplication',
        name: 'DevLedgr Platform',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'All',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        featureList: [
          'Production Problem Specifications with Mock Fleets',
          'Automated CI Telemetry and Test Verification',
          'SHA-256 Commit Stamping with 1-Year Validity Guarantee',
          'AI Scrutiny & ATS-Safe Markdown CV Synthesis',
        ],
      },
    ],
  };

  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('devledgr_storage_v1');var t=s?JSON.parse(s).state?.theme:'dark';if(!t)t='dark';document.documentElement.setAttribute('data-theme',t);if(t==='dark'){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){document.documentElement.setAttribute('data-theme','dark');document.documentElement.classList.add('dark')}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-ink-0 text-text-0 antialiased font-sans">
        {/* WCAG Accessible Skip Link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-text focus:border focus:border-green-500 focus:rounded-radius focus:outline-none focus:ring-2 focus:ring-green-400 font-mono text-xs"
        >
          Skip to main content
        </a>

        <BrandHeader />
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
        <BrandFooter />
        <ToastOverlay />
        <AuthModal />
        <SupabaseAuthSync />
        {process.env.NEXT_PUBLIC_SHOW_DEV_PERSONAS === 'true' && <RoleSwitcher />}
      </body>
    </html>
  );
}
