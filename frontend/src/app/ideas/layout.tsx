import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Idea Bank',
  description:
    'Real-world operational problems translated into rigorous technical specs with mock infrastructure ready to build against.',
  alternates: {
    canonical: '/ideas',
  },
};

export default function IdeasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
