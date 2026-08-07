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

export function Privacy() {
  useSEO({
    title: "Privacy Policy",
    description: `How ${siteConfig.businessName} collects, uses, and protects your information, including SMS text message communications.`,
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
            <h1 className="font-heading text-4xl font-bold text-torays-text sm:text-5xl">Privacy Policy</h1>
            <p className="text-sm text-torays-text-muted">Last updated: {LAST_UPDATED}</p>
          </div>

          <p className="text-sm leading-relaxed text-torays-text-secondary sm:text-base">
            {siteConfig.businessName} ("Torays Boost," "we," "us," or "our") operates{" "}
            <a href={siteConfig.url} className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
              {siteConfig.domain}
            </a>{" "}
            and provides electronics repair services. This Privacy Policy explains what information we collect,
            how we use it, and your choices — including in connection with text message (SMS) communications
            about your repair or service.
          </p>

          <Section title="Information We Collect">
            <p>When you request a quote, drop off a device, or otherwise use our services, we may collect:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your name</li>
              <li>Your phone number</li>
              <li>Your email address</li>
              <li>
                Service and device information — the device you're having repaired, the reported issue, repair
                status, invoices, and payment status
              </li>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use your name, phone number, email address, and service data to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Perform the repair or service you requested</li>
              <li>Contact you about the status of your repair (received, in progress, ready for pickup)</li>
              <li>Send invoices, payment reminders, and payment confirmations</li>
              <li>Respond to your questions and provide customer service follow-up</li>
            </ul>
          </Section>

          <Section title="SMS / Text Message Communications">
            <p>
              If you provide your mobile number when requesting service, we may send you text messages related
              to that service, including:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Confirmation that your device/repair has been received</li>
              <li>Notice that your repair is ready</li>
              <li>Invoice ready notifications</li>
              <li>Payment reminders</li>
              <li>Payment received confirmations</li>
              <li>General customer service follow-up related to your service</li>
            </ul>
            <p>
              <strong className="font-semibold text-torays-text">Consent.</strong> Consent to receive these
              messages is currently collected verbally: when you give us your mobile number to request service,
              you are agreeing to receive text message updates related to that service.
            </p>
            <p>
              <strong className="font-semibold text-torays-text">
                We do not sell or share mobile phone numbers or SMS consent/opt-in data with third parties for
                marketing or promotional purposes.
              </strong>{" "}
              This information is used solely to operate our repair and customer service communications.
            </p>
            <p>
              We may use third-party service providers, such as Twilio, solely to transmit the text messages
              described above. These providers are engaged only to deliver messages necessary to operate our
              service and are not authorized to use your information for their own marketing purposes.
            </p>
            <p>Message frequency varies depending on your repair, invoice, and service activity.</p>
            <p>Message and data rates may apply.</p>
            <p>Reply STOP at any time to cancel SMS messages. Reply HELP for help.</p>
            <p>We do not use SMS for unsolicited marketing.</p>
          </Section>

          <Section title="How We Share Information">
            <p>
              Outside of the SMS-specific commitment above, we do not sell your personal information. We may
              share information with service providers who help us operate the business — such as payment
              processors and messaging providers — solely to provide our services to you, or when required by
              law.
            </p>
          </Section>

          <Section title="Data Security">
            <p>
              We take reasonable measures to protect the information you share with us. No method of
              transmission or storage is completely secure, but we work to safeguard your information against
              unauthorized access, disclosure, or misuse.
            </p>
          </Section>

          <Section title="Your Choices">
            <p>
              You can stop SMS messages at any time by replying STOP. You can request access to, correction of,
              or deletion of your personal information by contacting us using the details below.
            </p>
          </Section>

          <Section title="Children's Privacy">
            <p>
              Our services and website are not directed to children under 13, and we do not knowingly collect
              personal information from children under 13.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an
              updated "Last updated" date.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              For questions about this Privacy Policy or how we handle your information, contact us at{" "}
              <a href={`mailto:${siteConfig.email}`} className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                {siteConfig.email}
              </a>
              .
            </p>
            <p>
              See also our{" "}
              <Link to="/terms" className="text-torays-navy underline decoration-torays-line hover:text-torays-red">
                Terms &amp; Conditions
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
