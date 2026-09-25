import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings & BYOK Keys',
  description:
    'Manage your verified developer profile, AI compute model (Full-Service vs BYOK), and API keys.',
  alternates: {
    canonical: '/settings',
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
