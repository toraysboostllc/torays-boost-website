import { Link } from "react-router-dom";
import { useSEO } from "../lib/seo.js";
import { Navbar } from "../components/layout/Navbar.jsx";
import { Footer } from "../components/layout/Footer.jsx";
import { siteConfig } from "../config/site.config.js";

const LAST_UPDATED = "August 7, 2026";

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
    description: `Terms of use for ${siteConfig.domain}, including SMS text message terms.`,
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
              Our website is provided to share information about our repair services, provide an estimate tool,
              and let you contact us. You agree to use it only for lawful purposes and not to misuse or attempt
              to disrupt the site.
            </p>
          </Section>

          <Section title="Our Services">
            <p>
              We provide electronics repair services, including board-level repair, microsoldering, and related
              diagnostics. Estimates provided through our website or in person are estimates only; final pricing
              is confirmed after diagnostics.
            </p>
          </Section>

          <Section title="SMS Terms">
            <p>
              By providing your mobile phone number and verbally agreeing at the time you request service, you
              consent to receive transactional and customer-care text messages from {siteConfig.businessName}{" "}
              related to the service(s) you requested, including:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Repair received / status updates</li>
              <li>Repair ready notifications</li>
              <li>Invoice ready notifications</li>
              <li>Payment reminders and payment received confirmations</li>
              <li>Related customer service follow-up</li>
            </ul>
            <p>Message frequency varies depending on your repair, invoice, and service activity.</p>
            <p>Message and data rates may apply.</p>
            <p>
              Reply STOP at any time to cancel text messages. Reply HELP for help, or contact us at{" "}
              <a href={`mailto:${siteConfig.email}`} className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                {siteConfig.email}
              </a>
              .
            </p>
            <p>Consent to receive SMS messages is not a condition of purchasing or receiving any service from us.</p>
            <p>We do not send unsolicited marketing messages via SMS.</p>
            <p>
              Message delivery is subject to your mobile carrier and is not guaranteed. We are not responsible
              for messages that are delayed or undelivered due to carrier issues or factors outside our control.
            </p>
          </Section>

          <Section title="Payments">
            <p>
              Payments for services are processed securely through third-party payment processors. Invoices and
              payment status may be communicated to you by email and/or text message as described in our SMS
              Terms above.
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
