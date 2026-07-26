import { Features } from "@/components/features/features";
import { Hero } from "@/components/hero/hero";
import { HowItWorks } from "@/components/how-it-works/how-it-works";
import { Navbar } from "@/components/navbar/navbar";
import { Pricing } from "@/components/pricing/pricing";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
      </main>
    </>
  );
}
