import { useState } from "react";
import { useSEO } from "../lib/seo.js";
import { Navbar } from "../components/layout/Navbar.jsx";
import { Footer } from "../components/layout/Footer.jsx";
import { WhatsAppFloatButton } from "../components/layout/WhatsAppFloatButton.jsx";
import { RepairRequestModal } from "../components/repair/RepairRequestModal.jsx";
import { WhatsAppGateModal } from "../components/repair/WhatsAppGateModal.jsx";
import { Hero } from "../sections/Hero.jsx";
import { Services } from "../sections/Services.jsx";
import { WhyChooseUs } from "../sections/WhyChooseUs.jsx";
import { AboutUs } from "../sections/AboutUs.jsx";
import { HowItWorks } from "../sections/HowItWorks.jsx";
import { Testimonials } from "../sections/Testimonials.jsx";
import { FAQ } from "../sections/FAQ.jsx";
import { Contact } from "../sections/Contact.jsx";

export function Home() {
  useSEO({});
  const [repairRequestOpen, setRepairRequestOpen] = useState(false);
  const [whatsappGateOpen, setWhatsappGateOpen] = useState(false);

  // Every general/"any time" WhatsApp button (Navbar, floating button,
  // Contact card) calls this instead of opening wa.me directly — the
  // friendly gate decides whether to start the wizard, never WhatsApp
  // itself. Only the wizard's own final step opens a real wa.me link.
  function openWhatsAppGate() {
    setWhatsappGateOpen(true);
  }

  function startRepairRequestFromGate() {
    setWhatsappGateOpen(false);
    setRepairRequestOpen(true);
  }

  return (
    <>
      <Navbar onWhatsAppClick={openWhatsAppGate} />
      <main>
        <Hero onOpenRepairRequest={() => setRepairRequestOpen(true)} />
        <Services />
        <WhyChooseUs />
        <AboutUs />
        <HowItWorks />
        <Testimonials />
        <FAQ />
        <Contact onWhatsAppClick={openWhatsAppGate} />
      </main>
      <Footer />
      <WhatsAppFloatButton onClick={openWhatsAppGate} />
      {repairRequestOpen && <RepairRequestModal onClose={() => setRepairRequestOpen(false)} />}
      {whatsappGateOpen && (
        <WhatsAppGateModal onClose={() => setWhatsappGateOpen(false)} onStart={startRepairRequestFromGate} />
      )}
    </>
  );
}
