import { SectionHeading } from "../ui/SectionHeading.jsx";
import { LOCAL_SEO_ICONS } from "./localSeoIcons.js";

/**
 * Reused for both the "Services" and "Common Issues" sections on every
 * local SEO page — same grid, different data — so the 3 pages share one
 * layout instead of three near-identical hand-built lists.
 */
export function IconInfoGrid({ eyebrow, title, items }) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} align="left" />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const Icon = LOCAL_SEO_ICONS[item.icon];
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-torays-line bg-torays-surface px-4 py-3.5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-torays-navy/15 text-torays-navy-light">
                  {Icon && <Icon size={18} />}
                </span>
                <span className="text-sm font-medium text-torays-text">{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
