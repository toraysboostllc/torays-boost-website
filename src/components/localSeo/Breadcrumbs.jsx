import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Visible breadcrumb trail (Home / Page) — the same `items` array a page
 * passes here is also what it hands to buildBreadcrumbJsonLd(), so the
 * structured data always matches what's actually on screen.
 */
export function Breadcrumbs({ items }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-torays-text-muted">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={item.path} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="shrink-0" aria-hidden="true" />}
            {isLast ? (
              <span aria-current="page" className="font-medium text-torays-text">
                {item.name}
              </span>
            ) : (
              <Link to={item.path} className="transition-colors hover:text-torays-text">
                {item.name}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
