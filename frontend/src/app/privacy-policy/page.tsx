import PrivacyPolicyPage, { metadata as privacyMetadata } from '@/app/privacy/page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  ...privacyMetadata,
  alternates: {
    canonical: '/privacy',
  },
};

export default PrivacyPolicyPage;
