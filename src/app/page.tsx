import { FAQ } from "@/components/faq/faq";
import { Features } from "@/components/features/features";
import { Footer } from "@/components/footer/footer";
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
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
