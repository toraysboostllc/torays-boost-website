import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { services } from "../src/config/services.config.js";
import { translations } from "../src/i18n/translations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const read = (relPath) => readFileSync(join(root, relPath), "utf8").replace(/\r\n?/g, "\n");

const servicesSrc = read("src/sections/Services.jsx");
const cardSrc = read("src/components/ui/Card.jsx");

const SERVICE_IMAGE_FILES = {
  ps5: "service-ps5.webp",
  hdmi: "ps5-hdmi-port-repair-miami.webp",
  microsoldering: "service-microsoldering.webp",
  iphone: "service-iphone.webp",
  ipad: "service-ipad.webp",
  macbook: "service-macbook.webp",
  samsung: "service-samsung.webp",
  xbox: "xbox-repair.webp",
  switch: "service-nintendo-switch.webp",
  "data-recovery": "service-data-recovery.webp",
};

describe("Services images: the exact 10 files exist locally, nothing extra copied in", () => {
  it("every service id in services.config.js has a matching webp under src/assets/services/", () => {
    Object.entries(SERVICE_IMAGE_FILES).forEach(([id, file]) => {
      expect(services.some((s) => s.id === id)).toBe(true);
      expect(existsSync(join(root, "src/assets/services", file))).toBe(true);
    });
  });

  it("services.config.js has exactly these 10 ids, in this order — matches the approved id→photo correspondence", () => {
    expect(services.map((s) => s.id)).toEqual([
      "ps5",
      "hdmi",
      "microsoldering",
      "iphone",
      "ipad",
      "macbook",
      "samsung",
      "xbox",
      "switch",
      "data-recovery",
    ]);
  });

  it("never copied the ZIP, preview, README, or ATTRIBUTIONS file into the repo", () => {
    expect(existsSync(join(root, "src/assets/services/README.md"))).toBe(false);
    expect(existsSync(join(root, "src/assets/services/ATTRIBUTIONS.md"))).toBe(false);
    expect(existsSync(join(root, "src/assets/services/ATTRIBUTIONS.txt"))).toBe(false);
    const entries = readdirSync(join(root, "src/assets/services"));
    expect(entries.sort()).toEqual(Object.values(SERVICE_IMAGE_FILES).sort());
  });
});

describe("Services.jsx: local imports only, one per service, no old icons left", () => {
  it("imports every service photo as a local ES module — never Base64, never an external URL", () => {
    Object.values(SERVICE_IMAGE_FILES).forEach((file) => {
      expect(servicesSrc).toContain(`from "../assets/services/${file}"`);
    });
    expect(servicesSrc).not.toMatch(/data:image\/(webp|png|jpe?g);base64/);
    expect(servicesSrc).not.toMatch(/https?:\/\//);
  });

  it("SERVICE_IMAGES maps every services.config.js id to an imported image, no gaps", () => {
    const mapBlock = servicesSrc.match(/const SERVICE_IMAGES = \{[\s\S]*?\};/)[0];
    services.forEach((service) => {
      const key = /^[a-zA-Z_$][\w$]*$/.test(service.id) ? service.id : `"${service.id}"`;
      expect(mapBlock).toMatch(new RegExp(`${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:\\s*img`));
    });
  });

  it("no lucide-react icon usage remains for service cards — photos fully replaced the old icon block", () => {
    expect(servicesSrc).not.toMatch(/from ["']lucide-react["']/);
    expect(servicesSrc).not.toContain("Icons[");
  });

  it("services.config.js no longer carries an icon field — dead data removed along with the old icon rendering", () => {
    const configSrc = read("src/config/services.config.js");
    expect(configSrc).not.toMatch(/\bicon:\s*"/);
  });
});

describe("Services.jsx: each photo is a fixed 16:9 cover image with no layout shift", () => {
  it("the image wrapper reserves a 16:9 box and clips overflow", () => {
    expect(servicesSrc).toContain('<div className="aspect-video w-full overflow-hidden">');
  });

  it("the <img> uses object-cover at full width so it never deforms or crops incorrectly", () => {
    expect(servicesSrc).toMatch(/<img[\s\S]{0,400}?className="aspect-video w-full object-cover/);
  });

  it("width/height attributes are set (1200x675, exact 16:9) so the browser reserves space before the image loads", () => {
    expect(servicesSrc).toContain('width="1200"');
    expect(servicesSrc).toContain('height="675"');
    expect(1200 / 675).toBeCloseTo(16 / 9, 5);
  });

  it("uses loading=lazy and decoding=async on every service photo", () => {
    expect(servicesSrc).toContain('loading="lazy"');
    expect(servicesSrc).toContain('decoding="async"');
  });

  it("only ONE <img> tag exists in the services map (per card) — no duplicate/leftover markup", () => {
    const imgTagCount = (servicesSrc.match(/<img\b/g) || []).length;
    expect(imgTagCount).toBe(1); // one <img> literal in the JSX, rendered once per service in the .map()
  });
});

describe("Services.jsx: hover zoom is subtle, capped, and respects prefers-reduced-motion", () => {
  it("hovers to exactly scale-105, never more", () => {
    expect(servicesSrc).toContain("group-hover:scale-105");
    expect(servicesSrc).not.toMatch(/group-hover:scale-(110|125|150)/);
  });

  it("transition is 300ms ease-out — within the requested 300-400ms range", () => {
    expect(servicesSrc).toContain("duration-300");
    expect(servicesSrc).toContain("ease-out");
  });

  it("prefers-reduced-motion disables both the transform and the transition entirely", () => {
    expect(servicesSrc).toContain("motion-reduce:transform-none");
    expect(servicesSrc).toContain("motion-reduce:transition-none");
  });

  it("the card itself is a group so only its own photo zooms on hover, not siblings", () => {
    expect(servicesSrc).toMatch(/<Card[^>]*className="group /);
  });
});

describe("Services.jsx: title/description keep a stable box so language toggle never resizes a card", () => {
  it("title is clamped to 1 line with a fixed min-height", () => {
    expect(servicesSrc).toContain("line-clamp-1 min-h-[1.75rem]");
  });

  it("description is clamped with a fixed min-height sized to the clamp (no visible ellipsis truncation in practice — see live-measurement report)", () => {
    expect(servicesSrc).toMatch(/line-clamp-4 min-h-\[5rem\]/);
  });

  it("still reads title/description through t() from the existing translations system — copy itself untouched by this round", () => {
    expect(servicesSrc).toContain("t(`services.items.${service.id}.title`)");
    expect(servicesSrc).toContain("t(`services.items.${service.id}.description`)");
  });
});

describe("Services.jsx: alt text sourced from the i18n system, correct in both languages", () => {
  it("alt reads through t(), never a hardcoded string", () => {
    expect(servicesSrc).toContain("alt={t(`services.items.${service.id}.imageAlt`)}");
  });

  it("every service has a non-empty imageAlt in both English and Spanish", () => {
    services.forEach((service) => {
      const en = translations.en.services.items[service.id];
      const es = translations.es.services.items[service.id];
      expect(en.imageAlt).toBeTruthy();
      expect(es.imageAlt).toBeTruthy();
      expect(en.imageAlt.length).toBeGreaterThan(10);
      expect(es.imageAlt.length).toBeGreaterThan(10);
    });
  });

  it("EN and ES services.items share the same set of ids (title/description/imageAlt all present on both sides)", () => {
    const enIds = Object.keys(translations.en.services.items).sort();
    const esIds = Object.keys(translations.es.services.items).sort();
    expect(enIds).toEqual(esIds);
  });
});

describe("HDMI card photo swap: real PS5 HDMI port macro shot, isolated to the hdmi card only", () => {
  it("imports the new descriptive filename, not the old generic one", () => {
    expect(servicesSrc).toContain('import imgHdmi from "../assets/services/ps5-hdmi-port-repair-miami.webp"');
    expect(servicesSrc).not.toMatch(/service-hdmi\.webp/);
  });

  it("the old generic file is gone from disk, the new one is the only hdmi-related asset", () => {
    expect(existsSync(join(root, "src/assets/services/service-hdmi.webp"))).toBe(false);
    expect(existsSync(join(root, "src/assets/services/ps5-hdmi-port-repair-miami.webp"))).toBe(true);
  });

  it("sets an explicit object-position for the hdmi card, every untouched card is unaffected", () => {
    expect(servicesSrc).toContain(
      'style={["hdmi", "xbox"].includes(service.id) ? { objectPosition: "center 50%" } : undefined}'
    );
  });

  it("EN and ES alt text both use the exact requested SEO string", () => {
    expect(translations.en.services.items.hdmi.imageAlt).toBe("PS5 HDMI port repair in Miami by Torays Boost");
    expect(translations.es.services.items.hdmi.imageAlt).toBe("PS5 HDMI port repair in Miami by Torays Boost");
  });

  it("hdmi title/description copy is untouched by the photo swap", () => {
    expect(translations.en.services.items.hdmi.title).toBe("HDMI Repair");
    expect(translations.es.services.items.hdmi.title).toBe("Reparación de HDMI");
  });

  it("no other card's imageAlt was touched by this round", () => {
    const otherIds = services.map((s) => s.id).filter((id) => id !== "hdmi");
    otherIds.forEach((id) => {
      expect(translations.en.services.items[id].imageAlt).not.toBe("PS5 HDMI port repair in Miami by Torays Boost");
    });
  });
});

describe("Xbox card photo swap: original 'XBOX REPAIR' square graphic, isolated to the xbox card only", () => {
  it("imports the new descriptive filename, not the old CC-licensed stock photo", () => {
    expect(servicesSrc).toContain('import imgXbox from "../assets/services/xbox-repair.webp"');
    expect(servicesSrc).not.toMatch(/service-xbox\.webp/);
  });

  it("the old stock photo is gone from disk, the new one is the only xbox-related asset", () => {
    expect(existsSync(join(root, "src/assets/services/service-xbox.webp"))).toBe(false);
    expect(existsSync(join(root, "src/assets/services/xbox-repair.webp"))).toBe(true);
  });

  it("sets an explicit object-position for the xbox card too, same centered crop as hdmi", () => {
    expect(servicesSrc).toContain(
      'style={["hdmi", "xbox"].includes(service.id) ? { objectPosition: "center 50%" } : undefined}'
    );
  });

  it("EN and ES alt text both use the exact requested SEO string", () => {
    expect(translations.en.services.items.xbox.imageAlt).toBe(
      "Professional Xbox Series X board-level repair by Torays Boost in Miami"
    );
    expect(translations.es.services.items.xbox.imageAlt).toBe(
      "Professional Xbox Series X board-level repair by Torays Boost in Miami"
    );
  });

  it("xbox title/description copy is untouched by the photo swap", () => {
    expect(translations.en.services.items.xbox.title).toBe("Xbox");
    expect(translations.es.services.items.xbox.title).toBe("Xbox");
  });

  it("no other card's imageAlt was touched by this round", () => {
    const otherIds = services.map((s) => s.id).filter((id) => id !== "xbox");
    otherIds.forEach((id) => {
      expect(translations.en.services.items[id].imageAlt).not.toBe(
        "Professional Xbox Series X board-level repair by Torays Boost in Miami"
      );
    });
  });
});

describe("Card.jsx: noPadding is additive — every other card usage keeps its default padded behavior", () => {
  it("noPadding defaults to false, so callers that don't pass it are unaffected", () => {
    expect(cardSrc).toContain("noPadding = false");
  });

  it("noPadding swaps p-6 for a flush, clipped edge (needed for a full-bleed cover photo)", () => {
    expect(cardSrc).toMatch(/noPadding \? "overflow-hidden p-0" : "p-6"/);
  });
});

describe("Scope: Services images round never touches Hero, carousel, wizard, Navbar, or Wholesale", () => {
  it("Services.jsx never imports from Hero, PromoCarousel, the repair wizard, or Navbar", () => {
    expect(servicesSrc).not.toMatch(/Hero\.jsx|PromoCarousel|RepairRequest|Navbar\.jsx/);
  });

  it("Services.jsx never mentions wholesale in any form", () => {
    expect(servicesSrc).not.toMatch(/wholesale/i);
  });
});
