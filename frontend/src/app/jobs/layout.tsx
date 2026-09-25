import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Matched Opportunities',
  description:
    'Engineering roles matched directly against your verified DevLedgr proof-of-work portfolio with AI scrutiny.',
  alternates: {
    canonical: '/jobs',
  },
};

export default function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
