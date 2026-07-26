import { Hero } from "@/components/hero/hero";
import { Navbar } from "@/components/navbar/navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
      </main>
    </>
  );
}
