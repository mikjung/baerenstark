import { Hero } from '@/components/home/Hero';
import { ServiceGrid } from '@/components/home/ServiceGrid';
import { About } from '@/components/home/About';

export default function HomePage() {
  return (
    <>
      <Hero />
      <ServiceGrid />
      <About />
    </>
  );
}
