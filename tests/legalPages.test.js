import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { siteConfig } from "../src/config/site.config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const privacySrc = read("src/pages/Privacy.jsx");
const termsSrc = read("src/pages/Terms.jsx");

describe("Privacy & Terms: no SMS/Twilio content — this form never sends SMS", () => {
  it("Privacy.jsx never mentions Twilio, SMS, STOP, HELP, message rates, or message frequency", () => {
    expect(privacySrc).not.toMatch(/Twilio/i);
    expect(privacySrc).not.toMatch(/\bSMS\b/);
    expect(privacySrc).not.toMatch(/text message/i);
    expect(privacySrc).not.toMatch(/\bSTOP\b|\bHELP\b/);
    expect(privacySrc).not.toMatch(/message and data rates/i);
    expect(privacySrc).not.toMatch(/message frequency/i);
  });

  it("Terms.jsx never mentions Twilio, SMS, STOP, HELP, message rates, or message frequency", () => {
    expect(termsSrc).not.toMatch(/Twilio/i);
    expect(termsSrc).not.toMatch(/\bSMS\b/);
    expect(termsSrc).not.toMatch(/text message/i);
    expect(termsSrc).not.toMatch(/\bSTOP\b|\bHELP\b/);
    expect(termsSrc).not.toMatch(/message and data rates/i);
    expect(termsSrc).not.toMatch(/message frequency/i);
  });
});

describe("Privacy.jsx: covers every required topic", () => {
  it("explains what the repair request form collects", () => {
    expect(privacySrc).toContain("Information We Collect");
    expect(privacySrc).toContain("Your name");
    expect(privacySrc).toContain("Your phone number");
  });

  it("explains the information is used to prepare a quote and respond about the repair", () => {
    expect(privacySrc).toMatch(/Prepare a quote for the repair you requested/);
  });

  it("explains a WhatsApp response only happens after the visitor authorizes it", () => {
    expect(privacySrc).toContain("WhatsApp Communications");
    expect(privacySrc).toMatch(/authorizes? us to respond to you through WhatsApp/);
  });

  it("explains the request itself is only a no-obligation estimate, not a repair authorization", () => {
    expect(privacySrc).toMatch(/only a request for a no-obligation estimate/);
    expect(privacySrc).toMatch(/does not\s+authorize any repair or charge/);
  });

  it("explicitly states the authorization does not cover advertising/marketing", () => {
    expect(privacySrc).toMatch(/does[\s\S]{0,30}<strong[^>]*>not<\/strong>[\s\S]{0,20}authorize advertising, marketing, or\s+promotional messages/);
  });

  it("states personal information is not sold", () => {
    expect(privacySrc).toMatch(/do not sell your personal information/i);
  });

  it("names the operational providers involved (payment processors, WhatsApp/Meta)", () => {
    expect(privacySrc).toMatch(/payment\s+processors/i);
    expect(privacySrc).toContain("Meta Platforms, Inc.");
  });

  it("has a data retention section", () => {
    expect(privacySrc).toContain("Data Retention");
  });

  it("has a data security section describing reasonable measures", () => {
    expect(privacySrc).toContain("Data Security");
    expect(privacySrc).toMatch(/reasonable measures/i);
  });

  it("has a cookies section, accurately scoped to this site (localStorage for language, no ad/tracking cookies)", () => {
    expect(privacySrc).toContain("Cookies");
    expect(privacySrc).toMatch(/does not use advertising or tracking cookies/i);
    expect(privacySrc).toMatch(/local storage/i);
  });

  it("explains how to request correction or deletion of personal information", () => {
    expect(privacySrc).toMatch(/access to, correction of, or deletion of your personal information/);
  });

  it("includes the official contact details, sourced from siteConfig (not hardcoded)", () => {
    expect(privacySrc).toContain("{siteConfig.email}");
    expect(privacySrc).toContain("{siteConfig.businessName}");
    expect(privacySrc).not.toMatch(/toraysboostllc@gmail\.com|17867937665|786.*793.*7665/);
  });

  it("links to /terms", () => {
    expect(privacySrc).toContain('to="/terms"');
  });
});

describe("Terms.jsx: covers estimate-only scope and repair authorization clearly", () => {
  it("has an Estimates & Repair Authorization section", () => {
    expect(termsSrc).toContain("Estimates & Repair Authorization");
  });

  it("states requesting an estimate does not authorize the repair", () => {
    expect(termsSrc).toMatch(/only asks us for a no-obligation estimate/);
    expect(termsSrc).toMatch(/does not authorize\s+any repair/);
  });

  it("states the client is never obligated to accept the estimate", () => {
    expect(termsSrc).toMatch(/never obligated to accept an estimate/);
  });

  it("states the repair is only created in the management system after the client expressly approves the estimate", () => {
    expect(termsSrc).toMatch(/[Oo]nly after you expressly approve an estimate do we create the corresponding repair in our\s*management system/);
  });

  it("states any additional work or cost requires a separate approval", () => {
    expect(termsSrc).toMatch(/[Aa]ny additional work or additional cost[\s\S]{0,80}requires your\s*separate approval/);
  });
});

describe("Terms.jsx: covers the WhatsApp authorization clearly, no invented SMS clauses", () => {
  it("has a WhatsApp Authorization section replacing the old SMS Terms section", () => {
    expect(termsSrc).toContain("WhatsApp Authorization");
    expect(termsSrc).not.toContain("SMS Terms");
  });

  it("states the required acknowledgment is required before submitting a request, by WhatsApp or email", () => {
    expect(termsSrc).toMatch(/before you can submit a request, whether by WhatsApp or email/);
  });

  it("states submitting the form authorizes a WhatsApp response about that specific estimate or repair", () => {
    expect(termsSrc).toMatch(/authorizes[\s\S]{0,30}\{siteConfig\.businessName\}[\s\S]{0,10}to respond to you through WhatsApp about that specific estimate or repair/);
  });

  it("states the authorization is scoped to the submitted request only, never marketing", () => {
    expect(termsSrc).toMatch(/covers only a reply about the quote, repair, or request/);
    expect(termsSrc).toMatch(/does not authorize advertising, marketing, or promotional messages/);
  });

  it("describes the actual mechanism: we prepare the message and open WhatsApp, the visitor presses send", () => {
    expect(termsSrc).toMatch(/we prepare a message summarizing it and open WhatsApp for you/);
    expect(termsSrc).toMatch(/you choose whether to send that message from your own WhatsApp account/);
  });

  it("mentions Meta Platforms, Inc. as the WhatsApp provider, not Twilio", () => {
    expect(termsSrc).toContain("Meta Platforms, Inc.");
  });

  it("includes the official contact details, sourced from siteConfig (not hardcoded)", () => {
    expect(termsSrc).toContain("{siteConfig.email}");
    expect(termsSrc).not.toMatch(/toraysboostllc@gmail\.com|17867937665|786.*793.*7665/);
  });

  it("links to /privacy", () => {
    expect(termsSrc).toContain('to="/privacy"');
  });
});

describe("Official business info: confirmed values (already sourced from site.config.js)", () => {
  it("matches the approved WhatsApp number, email, and address", () => {
    expect(siteConfig.whatsapp.number).toBe("17867937665");
    expect(siteConfig.whatsapp.displayNumber).toBe("+1 (786) 793-7665");
    expect(siteConfig.email).toBe("toraysboostllc@gmail.com");
    expect(siteConfig.address.line1).toBe("Kendall, Miami, FL 33196");
  });
});

describe("No prices anywhere in the legal pages", () => {
  it("Privacy.jsx and Terms.jsx never mention a dollar amount", () => {
    expect(privacySrc).not.toMatch(/\$\d/);
    expect(termsSrc).not.toMatch(/\$\d/);
  });
});
