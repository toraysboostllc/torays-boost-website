import { Navbar } from "../components/layout/Navbar.jsx";
import { Footer } from "../components/layout/Footer.jsx";
import { useSEO } from "../lib/seo.js";
import { siteConfig } from "../config/site.config.js";

function Credit({ title, fields }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-torays-line bg-torays-surface p-6">
      <h2 className="font-heading text-lg font-semibold text-torays-text">{title}</h2>
      <dl className="flex flex-col gap-1.5 text-sm text-torays-text-secondary">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col sm:flex-row sm:gap-2">
            <dt className="shrink-0 font-medium text-torays-text-muted">{label}:</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const MODIFICATIONS =
  "Horizontal composition using a blurred derivative background, color correction, moderate sharpening, resizing and WebP conversion.";

/**
 * Public attribution page for the two Services-section stock photos that
 * require it under their CC BY-SA 4.0 license (iPad, Xbox Series X) — see
 * docs/service-image-attributions.md for the source-of-truth text this
 * page renders. English-only, same as Privacy/Terms (out of i18n scope).
 */
export function ImageCredits() {
  useSEO({
    title: "Image Credits",
    description: "Attribution and license information for stock photography used on this site.",
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
            <h1 className="font-heading text-4xl font-bold text-torays-text sm:text-5xl">Image Credits</h1>
          </div>

          <p className="text-sm leading-relaxed text-torays-text-secondary sm:text-base">
            The following images were cropped, color-corrected, sharpened and converted to WebP for use on{" "}
            {siteConfig.domain}.
          </p>

          <div className="flex flex-col gap-5">
            <Credit
              title="iPad"
              fields={[
                ["File used", "service-ipad.webp"],
                ["Original title", '"IPad Pro 11 silver"'],
                ["Author", "彭家杰"],
                [
                  "Original source",
                  <a
                    key="src"
                    href="https://commons.wikimedia.org/wiki/File:IPad_Pro_11_silver.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
                  >
                    commons.wikimedia.org
                  </a>,
                ],
                ["License", "Creative Commons Attribution-ShareAlike 4.0 International"],
                [
                  "License URL",
                  <a
                    key="lic"
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
                  >
                    creativecommons.org/licenses/by-sa/4.0
                  </a>,
                ],
                ["Modifications", MODIFICATIONS],
                ["Status", "The modified image remains available under CC BY-SA 4.0."],
              ]}
            />

            <Credit
              title="Xbox Series X"
              fields={[
                ["File used", "service-xbox.webp"],
                ["Original title", '"Xbox Series X 2"'],
                ["Author", "Der. Bellemer"],
                [
                  "Original source",
                  <a
                    key="src"
                    href="https://commons.wikimedia.org/wiki/File:Xbox_Series_X_2.jpg"
                    target="_blank"
                    rel="noreferrer"
                    className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
                  >
                    commons.wikimedia.org
                  </a>,
                ],
                ["License", "Creative Commons Attribution-ShareAlike 4.0 International"],
                [
                  "License URL",
                  <a
                    key="lic"
                    href="https://creativecommons.org/licenses/by-sa/4.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-torays-navy underline decoration-torays-line hover:text-torays-red"
                  >
                    creativecommons.org/licenses/by-sa/4.0
                  </a>,
                ],
                ["Modifications", MODIFICATIONS],
                ["Status", "The modified image remains available under CC BY-SA 4.0."],
              ]}
            />
          </div>

          <div className="flex flex-col gap-2 border-t border-torays-line pt-6">
            <h2 className="font-heading text-lg font-semibold text-torays-text">Trademark notice</h2>
            <p className="text-sm leading-relaxed text-torays-text-secondary">
              PlayStation, Xbox, Nintendo Switch, iPhone, iPad, MacBook and Samsung are trademarks of their
              respective owners. Their appearance identifies equipment serviced by Torays Boost and does not imply
              sponsorship or affiliation.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
