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

export function Privacy() {
  useSEO({
    title: "Privacy Policy",
    description: `How ${siteConfig.businessName} collects, uses, and protects the information you share when requesting a repair quote.`,
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
            and provides electronics repair services. This Privacy Policy explains what information our repair
            request form collects, how we use it, and your choices — including when you authorize us to respond
            to you through WhatsApp about that request.
          </p>

          <Section title="Information We Collect">
            <p>When you submit a repair request, request a quote, or otherwise contact us, we may collect:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Your name</li>
              <li>Your phone number</li>
              <li>Your email address (optional)</li>
              <li>
                Device and repair information — the device you're having repaired, the reported problem, and any
                additional details you choose to share
              </li>
            </ul>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use the information above solely to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Prepare a quote for the repair you requested</li>
              <li>Respond to you about that request — by WhatsApp (if you authorize it), email, or phone</li>
              <li>Perform the repair or service you ultimately request</li>
              <li>Respond to your questions and provide related customer service follow-up</li>
            </ul>
          </Section>

          <Section title="WhatsApp Communications">
            <p>
              Submitting our repair request form is only a request for a no-obligation estimate — it does not
              authorize any repair or charge. It does authorize us to respond to you through WhatsApp about that
              specific estimate or repair request. This authorization only covers a reply related to the quote,
              repair, or request you submitted — it does{" "}
              <strong className="font-semibold text-torays-text">not</strong> authorize advertising, marketing, or
              promotional messages of any kind, and we do not send them.
            </p>
            <p>
              If you'd prefer we reply only by email or phone instead of WhatsApp, just say so in the additional
              details of your request and we'll honor that.
            </p>
            <p>
              WhatsApp is operated by Meta Platforms, Inc. When you message us there, that conversation is also
              subject to WhatsApp's own terms and privacy practices, which are outside our control.
            </p>
          </Section>

          <Section title="How We Share Information">
            <p>
              <strong className="font-semibold text-torays-text">
                We do not sell your personal information, and we do not share it for advertising or marketing
                purposes.
              </strong>{" "}
              We may share information with service providers who help us operate the business — such as payment
              processors and the messaging platforms described above — solely to provide our services to you, or
              when required by law.
            </p>
          </Section>

          <Section title="Data Retention">
            <p>
              We keep repair and contact records for as long as reasonably needed to complete your repair, respond
              to related questions, and meet our own accounting and legal obligations. We may delete or anonymize
              older records once they're no longer needed for those purposes.
            </p>
          </Section>

          <Section title="Data Security">
            <p>
              We take reasonable measures to protect the information you share with us. No method of
              transmission or storage is completely secure, but we work to safeguard your information against
              unauthorized access, disclosure, or misuse.
            </p>
          </Section>

          <Section title="Cookies & Local Storage">
            <p>
              The public website does not use advertising or tracking cookies. It stores your language preference
              (English/Español) in your browser's local storage so the site remembers your choice — nothing else
              is stored there, and this preference is never sent to us or to any third party.
            </p>
            <p>
              Our separate wholesale partner portal, used only by repair shops we've approved, uses functional
              session cookies solely to keep that login secure — this doesn't apply to visitors requesting a
              repair quote.
            </p>
          </Section>

          <Section title="Your Choices">
            <p>
              You can request access to, correction of, or deletion of your personal information at any time by
              contacting us using the details below. If you've authorized WhatsApp responses and change your
              mind, just let us know and we'll stop reaching out that way.
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
