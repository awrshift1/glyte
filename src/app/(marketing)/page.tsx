import Hero from "./components/Hero";
import { HowItWorks } from "./components/HowItWorks";
import { Features } from "./components/Features";
import OpenSource from "./components/OpenSource";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Features />
      <OpenSource />
      <CTA />
      <Footer />
    </main>
  );
}
