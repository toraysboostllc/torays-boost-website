import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "../ui/SectionHeading.jsx";
import { LOCAL_SEO_PAGES } from "../../config/localSeo.config.js";
import { useLocalSeoText } from "../../i18n/useLocalSeoText.js";

/** Internal links to the other local SEO pages — descriptive anchor text, not "click here". */
export function RelatedServices({ relatedKeys, title, note }) {
  const { t } = useLocalSeoText();
  if (!relatedKeys?.length) return null;

  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <SectionHeading title={title} align="left" />
        {note && <p className="mt-4 text-base font-medium text-torays-text">{note}</p>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {relatedKeys.map((key) => {
            const page = LOCAL_SEO_PAGES[key];
            if (!page) return null;
            return (
              <Link
                key={key}
                to={page.path}
                className="group flex flex-1 items-center justify-between gap-3 rounded-xl border border-torays-line bg-torays-surface px-5 py-4 text-sm font-medium text-torays-text transition-colors hover:border-torays-red/40"
              >
                {t(`localSeo.pages.${key}.relatedLinkLabel`)}
                <ArrowRight
                  size={16}
                  className="shrink-0 text-torays-red transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
