import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Coaching Itineraries',
  description:
    'Structured multi-week engineering tracks designed to close specific architectural skill gaps with verified proof.',
  alternates: {
    canonical: '/coaching',
  },
};

export default function CoachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
