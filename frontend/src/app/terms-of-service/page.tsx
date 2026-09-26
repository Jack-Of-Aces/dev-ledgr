import TermsOfServicePage, { metadata as termsMetadata } from '@/app/terms/page';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  ...termsMetadata,
  alternates: {
    canonical: '/terms',
  },
};

export default TermsOfServicePage;
