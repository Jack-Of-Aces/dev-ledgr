import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Developer Dashboard',
  description:
    'Monitor your verified ledger entries, 1-year portfolio guarantee countdown, and matched opportunities.',
  alternates: {
    canonical: '/dashboard',
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
