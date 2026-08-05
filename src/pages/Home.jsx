import { useSEO } from "../lib/seo.js";
import { Navbar } from "../components/layout/Navbar.jsx";
import { Footer } from "../components/layout/Footer.jsx";
import { WhatsAppFloatButton } from "../components/layout/WhatsAppFloatButton.jsx";
import { Hero } from "../sections/Hero.jsx";
import { QuoteEstimator } from "../sections/QuoteEstimator.jsx";
import { Services } from "../sections/Services.jsx";
import { WhyChooseUs } from "../sections/WhyChooseUs.jsx";
import { AboutUs } from "../sections/AboutUs.jsx";
import { HowItWorks } from "../sections/HowItWorks.jsx";
import { Testimonials } from "../sections/Testimonials.jsx";
import { FAQ } from "../sections/FAQ.jsx";
import { Contact } from "../sections/Contact.jsx";

export function Home() {
  useSEO({});

  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <QuoteEstimator />
        <Services />
        <WhyChooseUs />
        <AboutUs />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <Contact />
      </main>
      <Footer />
      <WhatsAppFloatButton />
    </>
  );
}
