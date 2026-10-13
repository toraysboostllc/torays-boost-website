// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Links, LINKS, SHARE_URL, shareLinksPage } from "../src/pages/Links.jsx";
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
    expect(container.querySelector("button[data-share]")?.textContent).toMatch(/Share/);
  });

  it("shares its own public URL: native sheet first, clipboard as fallback", async () => {
    expect(SHARE_URL).toBe("https://toraysboost.com/links");

    const share = vi.fn().mockResolvedValue();
    expect(await shareLinksPage({ share })).toBe("shared");
    expect(share.mock.calls[0][0].url).toBe(SHARE_URL);

    const writeText = vi.fn().mockResolvedValue();
    expect(await shareLinksPage({ clipboard: { writeText } })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(SHARE_URL);

    const abort = Object.assign(new Error("x"), { name: "AbortError" });
    expect(await shareLinksPage({ share: vi.fn().mockRejectedValue(abort), clipboard: { writeText } })).toBe("cancelled");
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
