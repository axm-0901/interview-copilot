import { Nav } from '@/components/site/Nav';
import { Hero } from '@/components/site/Hero';
import { PainPoints } from '@/components/site/PainPoints';
import { RaceCompare } from '@/components/site/RaceCompare';
import { LoopSection } from '@/components/site/LoopSection';
import { Signature } from '@/components/site/Signature';
import { Features } from '@/components/site/Features';
import { Boundary } from '@/components/site/Boundary';
import { CTA } from '@/components/site/CTA';
import { Footer } from '@/components/site/Footer';

export default function SitePage() {
  return (
    <main className="s-site">
      <Nav />
      <Hero />
      <PainPoints />
      <RaceCompare />
      <LoopSection />
      <Signature />
      <Features />
      <Boundary />
      <CTA />
      <Footer />
    </main>
  );
}
