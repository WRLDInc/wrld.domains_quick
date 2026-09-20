import { Hero } from '@/components/Hero';
import { HowItWorks } from '@/components/HowItWorks';
import { WhyHost } from '@/components/WhyHost';
import { CTABand } from '@/components/CTABand';
import { usePageTitle } from '@/lib/usePageTitle';

export function HomePage() {
  usePageTitle();

  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyHost />
      <CTABand />
    </>
  );
}
