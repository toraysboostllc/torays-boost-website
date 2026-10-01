import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/**
 * The public policies (Privacy, Terms) and the consent wording are required
 * for Twilio's review — they must never change as a side effect of other work.
 * These fingerprints were taken on 2026-10-01 from main (e9f568e). If a test
 * here fails, STOP: a policy or its consent text changed. Only update a
 * fingerprint when the owner explicitly asked for that policy change.
 */
const appSrc = read("src/App.jsx");
const footerSrc = read("src/components/layout/Footer.jsx");
const modalSrc = read("src/components/repair/RepairRequestModal.jsx");
const translationsSrc = read("src/i18n/translations.js");
const robotsSrc = read("public/robots.txt");
const vercel = JSON.parse(read("vercel.json"));

describe("Public policies stay byte-for-byte intact", () => {
  it("Privacy.jsx is unchanged", () => {
    expect(sha256(read("src/pages/Privacy.jsx"))).toBe("ee905cc3901faae4bfd804e7f0f6d2c274ac3b7ee46c28410d236f939ff5d147");
  });

  it("Terms.jsx is unchanged", () => {
    expect(sha256(read("src/pages/Terms.jsx"))).toBe("f50baf417c041e7011833b639eddc24ac0ae2cbafc937b7461bbdfd5bb875c90");
  });

  it("the consent wording (EN + ES) is unchanged", () => {
    const hashes = (re) => (translationsSrc.match(re) || []).map(sha256);
    expect(hashes(/policyConsent: \{[\s\S]*?\n\s*\},/g)).toEqual([
      "693ff0338d0645197d91a970c38af01fbec1f3c171d1a93d135f1f7c7ac8375f",
      "c65948bed946de095ae76658ad98b61d0ea32e60b542ef219a8b32faab5d43c0",
    ]);
    expect(hashes(/consentConfirmation:\s*\n?\s*"[^"]*",/g)).toEqual([
      "85dcbaa7b908576f45aee02cd81d76dea45625e84530ff707aea5116a176eb16",
      "fefd0a696f49997eb925c656e2f4a9073b374a99de90198dccf7e7e8be59cc63",
    ]);
    expect(hashes(/whatsappAuthNote:\s*\n?\s*"[^"]*",/g)).toEqual([
      "5676865e9e2bad44b1380e418d4b6339add09b89e47fbe8f00d79121a7e6868d",
      "6bf67790b6a27dea8b92a11018cb133486dc3fb0820e47d9e20ca6ff97580318",
    ]);
  });
});

describe("Policy routes and links stay reachable", () => {
  it("/privacy and /terms are routed", () => {
    expect(appSrc).toContain('<Route path="/privacy" element={<Privacy />} />');
    expect(appSrc).toContain('<Route path="/terms" element={<Terms />} />');
  });

  it("the footer links to both policies", () => {
    expect(footerSrc).toMatch(/to="\/privacy"/);
    expect(footerSrc).toMatch(/to="\/terms"/);
  });

  it("the quote wizard's consent checkbox links to both policies", () => {
    expect(modalSrc).toMatch(/href="\/terms"/);
    expect(modalSrc).toMatch(/href="\/privacy"/);
    expect(modalSrc).toContain('t("wizard.policyConsent.termsLabel")');
    expect(modalSrc).toContain('t("wizard.policyConsent.privacyLabel")');
  });

  it("no redirect, header or robots rule hides a policy page", () => {
    const sources = [...(vercel.redirects || []), ...(vercel.headers || [])].map((r) => r.source);
    sources.forEach((s) => expect(s).not.toMatch(/privacy|terms/));
    expect(robotsSrc).not.toMatch(/Disallow:\s*\/(privacy|terms)/);
  });
});
