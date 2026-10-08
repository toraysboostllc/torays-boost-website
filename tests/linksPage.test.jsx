// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Links, LINKS } from "../src/pages/Links.jsx";
import { siteConfig } from "../src/config/site.config.js";

describe("/links page (NFC keychains + social bio link)", () => {
  it("lists WhatsApp first, then TikTok, YouTube, Instagram and the website", () => {
    expect(LINKS.map((l) => l.id)).toEqual(["whatsapp", "tiktok", "youtube", "instagram", "website"]);
  });

  it("uses the confirmed profiles and WhatsApp number", () => {
    const href = Object.fromEntries(LINKS.map((l) => [l.id, l.href]));
    expect(href.whatsapp.startsWith(`https://wa.me/${siteConfig.whatsapp.number}`)).toBe(true);
    expect(href.tiktok).toBe("https://www.tiktok.com/@toraysboost");
    expect(href.youtube).toBe("https://www.youtube.com/@toraysboost");
    expect(href.instagram).toBe("https://www.instagram.com/toraysboostllc");
    expect(href.website).toBe(siteConfig.url);
  });

  it("renders every link as an external anchor and never shows a price", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/links"]}>
        <Links />
      </MemoryRouter>,
    );
    const anchors = [...container.querySelectorAll("a[data-link]")];
    expect(anchors).toHaveLength(5);
    for (const a of anchors) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toContain("noopener");
    }
    expect(container.textContent).not.toMatch(/\$\s?\d/);
  });
});
