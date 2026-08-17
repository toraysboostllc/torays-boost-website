import { Link } from "react-router-dom";
import { useSEO } from "../lib/seo.js";
import { Navbar } from "../components/layout/Navbar.jsx";
import { Footer } from "../components/layout/Footer.jsx";
import { siteConfig } from "../config/site.config.js";

const LAST_UPDATED = "August 17, 2026";

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-xl font-semibold text-torays-text sm:text-2xl">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-torays-text-secondary sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function Terms() {
  useSEO({
    title: "Terms & Conditions",
    description: `Terms of use for ${siteConfig.domain}, including the repair request form's WhatsApp authorization.`,
  });

  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24 sm:pt-40">
        <div className="mx-auto flex max-w-3xl flex-col gap-10 px-5 sm:px-8">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-heading font-semibold uppercase tracking-[0.2em] text-torays-red">
              Legal
            </span>
            <h1 className="font-heading text-4xl font-bold text-torays-text sm:text-5xl">Terms &amp; Conditions</h1>
            <p className="text-sm text-torays-text-muted">Last updated: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-torays-text-secondary sm:text-base">
            These Terms &amp; Conditions ("Terms") govern your use of{" "}
            <a href={siteConfig.url} className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
              {siteConfig.domain}
            </a>{" "}
            and the electronics repair services offered by {siteConfig.businessName} ("Torays Boost," "we," "us,"
            or "our"). By using our website or requesting our services, you agree to these Terms.
          </p>

          <Section title="Use of the Website">
            <p>
              Our website is provided to share information about our repair services, provide a repair request
              form, and let you contact us. You agree to use it only for lawful purposes and not to misuse or
              attempt to disrupt the site.
            </p>
          </Section>

          <Section title="Our Services">
            <p>
              We provide electronics repair services, including board-level repair, microsoldering, and related
              diagnostics. Quotes provided through our website or in person are estimates only; final pricing is
              confirmed after diagnostics and before any work begins.
            </p>
          </Section>

          <Section title="Estimates & Repair Authorization">
            <p>
              Submitting our repair request form only asks us for a no-obligation estimate — it does not authorize
              any repair, and it does not authorize any charge.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>You are never obligated to accept an estimate we provide.</li>
              <li>
                Only after you expressly approve an estimate do we create the corresponding repair in our
                management system.
              </li>
              <li>
                Any additional work or additional cost identified once the repair is underway requires your
                separate approval before we proceed.
              </li>
            </ul>
          </Section>

          <Section title="WhatsApp Authorization">
            <p>
              Our repair request form requires you to confirm you've read these Terms and our{" "}
              <Link to="/privacy" className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                Privacy Policy
              </Link>{" "}
              before you can submit a request, whether by WhatsApp or email. Submitting the form also authorizes{" "}
              {siteConfig.businessName} to respond to you through WhatsApp about that specific estimate or repair.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>The authorization covers only a reply about the quote, repair, or request you submitted.</li>
              <li>It does not authorize advertising, marketing, or promotional messages, and we do not send them.</li>
              <li>You can still reach us — and be reached — by email or phone instead.</li>
              <li>
                When you submit a valid request, we prepare a message summarizing it and open WhatsApp for you;
                you choose whether to send that message from your own WhatsApp account.
              </li>
            </ul>
            <p>
              WhatsApp delivery is provided by Meta Platforms, Inc. and is subject to your own WhatsApp account
              and network connection; we're not responsible for messages delayed or undelivered due to factors
              outside our control.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Payments for services are processed securely through third-party payment processors. Invoices and
              payment status may be communicated to you by email, WhatsApp, or phone, as described above.
            </p>
          </Section>

          <Section title="Intellectual Property">
            <p>
              The content on this website, including text, graphics, and the Torays Boost logo, is the property
              of {siteConfig.businessName} and may not be used without our permission.
            </p>
          </Section>

          <Section title="Limitation of Liability">
            <p>
              Our website and the information on it are provided "as is." While we work to keep repair estimates
              and information accurate, final terms for any repair are confirmed directly with you before work
              begins.
            </p>
          </Section>

          <Section title="Changes to These Terms">
            <p>
              We may update these Terms from time to time. Changes will be posted on this page with an updated
              "Last updated" date.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              Questions about these Terms can be sent to{" "}
              <a href={`mailto:${siteConfig.email}`} className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                {siteConfig.email}
              </a>
              .
            </p>
            <p>
              See also our{" "}
              <Link to="/privacy" className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}
