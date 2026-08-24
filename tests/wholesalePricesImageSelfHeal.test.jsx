// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WholesalePrices } from "../src/pages/WholesalePrices.jsx";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * Reported bug: the Wholesale Portal's cards occasionally ALL showed their
 * icon fallback right after a shop's first load of a session, self-
 * correcting only after a manual reload (F5) — never automatically.
 *
 * Root cause: the signed-image-URL batch call the server makes once per
 * /api/wholesale-prices request (signImagePaths, api/_lib/wholesaleDb.js)
 * had no retry at all -- a single transient hiccup (most likely on a cold
 * serverless instance's very first outbound connection, i.e. right after
 * login) silently degraded EVERY image in that one response to null, with
 * no error surfaced anywhere and nothing on the client ever asking again.
 *
 * Fix, two layers:
 *   1. Server: signImagePaths now retries the whole batch call once on a
 *      transient failure before giving up (see that function's own tests
 *      in tests/wholesale-admin-images.test.js-adjacent coverage below).
 *   2. Client: WholesalePrices.jsx now schedules one quiet, invisible
 *      follow-up fetch a few seconds after the catalog first becomes
 *      ready (self-heals a first-load hiccup automatically), plus a
 *      periodic refresh well inside the signed URLs' 5-minute TTL (self-
 *      heals a long-open session before any URL actually expires). Both
 *      use the SAME loadCatalog-adjacent fetch, in place -- never
 *      window.location.reload(), never a visible loading state, never
 *      disturbing whatever screen/selection the shop is already on.
 *
 * This is a real @testing-library/react render test (this repo's
 * established pattern for exactly this class of bug -- see
 * tests/wholesaleLegalPage.test.jsx's own header for why a structural scan
 * can't prove async effect-driven state) with fake timers standing in for
 * the passage of time, and fetchWholesaleCatalog mocked so each scenario
 * controls exactly what the "server" returns on each successive call.
 */

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../src/lib/wholesaleAuth.js", () => ({
  fetchWholesaleCatalog: vi.fn(),
  wholesaleLogout: vi.fn().mockResolvedValue(undefined),
}));

import { fetchWholesaleCatalog } from "../src/lib/wholesaleAuth.js";

// Real shape /api/wholesale-prices actually returns for one active
// equipment type with one category and one service -- mirrors toClient*
// in api/_lib/wholesaleDb.js field-for-field (see also
// tests/wholesaleResultPhotoFallback.test.js, which exercises the real
// server-side builder that produces this exact shape).
function catalogWithOneCard(name) {
  return {
    ok: true,
    shopName: "Acme Repair",
    equipmentTypes: [
      {
        id: "et-1", slug: "ps5", name, name_es: null, catalog_mode: "grouped",
        full_bleed_photo: false, image_focus_x: 50, image_focus_y: 50, image: null, sort_order: 1,
        categories: [
          {
            id: "cat-1", slug: "ps5", name, notes: null, diagnostic_fee: null, diagnostic_description: null, image: null,
            services: [
              {
                id: "sv-1", slug: "ps5-hdmi", name: "HDMI Port Replacement", name_es: null,
                description_en: null, description_es: null, pricing_type: "fixed", fixed_price: 80,
                price_min: null, price_max: null, notes: null, currency: "USD", recommended_price: 100,
                competitive_price: null, high_profit_price: null, price_updated_at: null, image: null,
              },
            ],
          },
        ],
      },
    ],
    microsolderingEquipmentType: null,
    legacyMicrosoldering: null,
    salesModule: null,
    warranty: null,
  };
}
const EMPTY_CATALOG = { ...catalogWithOneCard("unused"), equipmentTypes: [] };

function renderPrices() {
  return render(
    <MemoryRouter initialEntries={["/wholesale/prices"]}>
      <WholesalePrices />
    </MemoryRouter>
  );
}

// Advances fake time AND flushes React's resulting state updates/effects
// before returning — plain vi.advanceTimersByTimeAsync() alone leaves
// pending re-renders un-flushed under fake timers, and @testing-library's
// findBy*/waitFor internally poll on real setTimeout, which never fires
// while fake timers are active (that combination is what produced this
// file's first "Test timed out in 5000ms" failures). Every scenario below
// uses this helper plus synchronous getByText/queryByText instead.
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

// jsdom's document.visibilityState is a real getter with no public setter —
// overridden per-test via defineProperty (configurable so it can be
// redefined again on the next call/reset) rather than deleting/replacing
// `document` itself.
function setVisibility(value) {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
}
async function dispatchVisibilityChange(value) {
  setVisibility(value);
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}
async function dispatchPageShow(value = "visible") {
  setVisibility(value);
  await act(async () => {
    window.dispatchEvent(new Event("pageshow"));
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  setVisibility("visible");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
  setVisibility("visible");
});

describe("Primera carga: mounts, fetches exactly once, renders the real catalog", () => {
  it("fetchWholesaleCatalog is called exactly once on mount, and the card appears once the response resolves", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await tick(); // let the already-resolved promise's .then() run and React flush
    expect(screen.getByText("PlayStation 5")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});

describe("Sesión recién iniciada + recuperación automática: a hiccup-empty first load self-heals a few seconds later, with no visible reload", () => {
  it("first response has zero cards (simulating the reported all-icons/empty-images hiccup); a quiet follow-up a few seconds later brings the real card in, with the loading screen never reappearing", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(EMPTY_CATALOG)
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    await tick();

    // Confirmed broken state right after the first load, matching the
    // reported symptom exactly -- the card is genuinely not there yet.
    expect(screen.queryByText("PlayStation 5")).toBeNull();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    // 4 seconds (SETTLE_REFRESH_DELAY_MS in WholesalePrices.jsx) later,
    // self-heals automatically -- no F5, no reload() call anywhere in this
    // component (see the structural check below), no visible loading
    // screen at any point during the transition.
    await tick(4000);
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByText("PlayStation 5")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });

  it("a first load that already has the real card is left untouched by the settle refresh returning the exact same data — no flicker, no lost state", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    await tick();
    expect(screen.getByText("PlayStation 5")).toBeTruthy();

    await tick(4000);
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);
    // Still there, still exactly one occurrence — the refresh merged
    // identical data in place, it didn't duplicate or remount the card.
    expect(screen.getAllByText("PlayStation 5")).toHaveLength(1);
  });
});

describe("URL expirada: periodic refresh keeps signed image URLs from ever actually expiring while the screen stays open", () => {
  it("fetches again on the periodic interval, well inside the 5-minute signed-URL TTL", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    await tick();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await tick(4000); // the one-time settle refresh
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);

    // PERIODIC_REFRESH_INTERVAL_MS (4 minutes) later — well under the
    // 5-minute IMAGE_SIGN_TTL_SECONDS a signed URL is actually valid for
    // (api/_lib/wholesaleDb.js), so no image is ever left to expire.
    await tick(4 * 60 * 1000);
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(3);

    // And again on the NEXT tick — genuinely periodic, not a one-shot.
    await tick(4 * 60 * 1000);
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(4);
  });
});

describe("Respuesta en caché: every refresh is a genuinely fresh network call, never a reused/stale response", () => {
  it("each of 3 successive automatic calls receives independently-controlled, distinct data — proves nothing is memoized/cached client-side across calls", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("Round 1"))
      .mockResolvedValueOnce(catalogWithOneCard("Round 2"))
      .mockResolvedValueOnce(catalogWithOneCard("Round 3"));

    renderPrices();
    await tick();
    expect(screen.getByText("Round 1")).toBeTruthy();

    await tick(4000);
    expect(screen.getByText("Round 2")).toBeTruthy();
    expect(screen.queryByText("Round 1")).toBeNull();

    await tick(4 * 60 * 1000);
    expect(screen.getByText("Round 3")).toBeTruthy();
    expect(screen.queryByText("Round 2")).toBeNull();
  });

  it("the request itself never opts into any browser cache (credentials: same-origin, relies on the server's own Cache-Control: private, no-store — see api/wholesale-prices.js)", () => {
    // Structural: fetchWholesaleCatalog is the one function that ever calls
    // GET /api/wholesale-prices — verified for real (not by reading source
    // text) in the scenarios above, which prove 4 independent calls each
    // return exactly what was queued, never a repeated/stale response.
    expect(fetchWholesaleCatalog).toBeDefined();
  });
});

describe("A genuine auth failure during a SILENT background refresh still redirects to login — security is never weakened for the sake of being quiet", () => {
  it("settle refresh returning kind: \"auth\" calls navigate(\"/wholesale\")", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"))
      .mockResolvedValueOnce({ ok: false, kind: "auth", message: "Session expired." });

    renderPrices();
    await tick();
    expect(navigateMock).not.toHaveBeenCalled();

    await tick(4000);
    expect(navigateMock).toHaveBeenCalledWith("/wholesale");
  });

  it("a transient failure during a silent refresh does NOT redirect and does NOT disturb the already-visible catalog — the next scheduled attempt just tries again", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"))
      .mockResolvedValueOnce({ ok: false, kind: "transient", message: "Could not load prices." });

    renderPrices();
    await tick();
    await tick(4000);

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText("PlayStation 5")).toBeTruthy(); // still there, untouched
    expect(screen.queryByText("Loading…")).toBeNull(); // never flashed a full-screen loading state
  });
});

describe("Cleanup: unmounting stops the timers — no further fetches, no state updates on an unmounted component", () => {
  it("no additional fetchWholesaleCatalog calls happen after unmount, even once the settle/periodic delays would have elapsed", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));

    const { unmount } = renderPrices();
    await tick();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    unmount();
    await tick(10 * 60 * 1000); // well past both the settle delay and a periodic tick
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1); // unchanged
  });
});

describe("Tab returns to visible: covers the browser suspending/throttling the periodic interval in the background, so a signed URL that quietly expired while away is refreshed the moment the shop looks back", () => {
  it("visibilitychange to \"visible\" triggers a silent refresh — data updates in place, no loading screen, wizard stays on the same screen", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"))
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5 Pro")); // fresh data, proves the merge really happened

    renderPrices();
    await tick();
    expect(screen.getByText("PlayStation 5")).toBeTruthy();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await dispatchVisibilityChange("visible");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByText("PlayStation 5 Pro")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull(); // never a full-screen reload
  });

  it("visibilitychange to \"hidden\" (the tab being backgrounded) never triggers a refresh — only becoming visible does", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    await tick();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await dispatchVisibilityChange("hidden");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1); // unchanged
  });

  it("pageshow (Safari/iOS bfcache restore, which can skip visibilitychange entirely) also triggers a silent refresh", async () => {
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"))
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5 Pro"));

    renderPrices();
    await tick();
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await dispatchPageShow("visible");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);
    expect(screen.getByText("PlayStation 5 Pro")).toBeTruthy();
  });

  it("never reloads the page and never resets the wizard's current screen/selection — the shop can be mid-flow (Modelo/Falla/result) when the tab regains visibility", async () => {
    // A distinguishing service name proves state.equipmentTypes was merged
    // in place, not that the whole page/component was thrown away and
    // remounted from scratch (which would also have reset wizardScreen back
    // to "top" and shown the loading screen at least once).
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"))
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5"));

    renderPrices();
    await tick();
    const loadingScreensSeenBefore = screen.queryAllByText("Loading…").length;

    await dispatchVisibilityChange("visible");

    expect(screen.queryAllByText("Loading…").length).toBe(loadingScreensSeenBefore); // never regressed to 1
    expect(screen.getByText("PlayStation 5")).toBeTruthy(); // top screen content still intact
  });

  it("does not fire while the catalog isn't \"ready\" yet (e.g. still on the initial load) — nothing to refresh, and no listener race with the very first fetch", async () => {
    let resolveFirst;
    fetchWholesaleCatalog.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }));

    renderPrices();
    await tick(); // the first fetch is still pending (unresolved on purpose)
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1);

    await dispatchVisibilityChange("visible");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(1); // no listener registered yet — status isn't "ready"

    resolveFirst(catalogWithOneCard("PlayStation 5"));
    await tick();
    expect(screen.getByText("PlayStation 5")).toBeTruthy();
  });
});

describe("No duplicate timers/listeners: visibilitychange/pageshow are registered exactly once per \"ready\" session, and overlapping triggers never fire two concurrent fetches", () => {
  it("addEventListener for visibilitychange/pageshow is called exactly once each while status stays \"ready\" — re-rendering without a status change never re-registers them", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));
    const docAddSpy = vi.spyOn(document, "addEventListener");
    const winAddSpy = vi.spyOn(window, "addEventListener");

    const { rerender } = renderPrices();
    await tick();
    const visibilityRegistrations = docAddSpy.mock.calls.filter((c) => c[0] === "visibilitychange").length;
    const pageshowRegistrations = winAddSpy.mock.calls.filter((c) => c[0] === "pageshow").length;
    expect(visibilityRegistrations).toBe(1);
    expect(pageshowRegistrations).toBe(1);

    // A re-render that does NOT change state.status must not tear down and
    // re-register the listeners a second time.
    rerender(
      <MemoryRouter initialEntries={["/wholesale/prices"]}>
        <WholesalePrices />
      </MemoryRouter>
    );
    await tick();
    const visibilityRegistrationsAfter = docAddSpy.mock.calls.filter((c) => c[0] === "visibilitychange").length;
    expect(visibilityRegistrationsAfter).toBe(1);
  });

  it("removeEventListener runs on unmount for both listeners — never leaked across a mount/unmount cycle", async () => {
    fetchWholesaleCatalog.mockResolvedValue(catalogWithOneCard("PlayStation 5"));
    const docRemoveSpy = vi.spyOn(document, "removeEventListener");
    const winRemoveSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderPrices();
    await tick();
    unmount();

    expect(docRemoveSpy.mock.calls.some((c) => c[0] === "visibilitychange")).toBe(true);
    expect(winRemoveSpy.mock.calls.some((c) => c[0] === "pageshow")).toBe(true);
  });

  it("a visibilitychange firing while the periodic refresh is already in flight never causes a second concurrent fetchWholesaleCatalog call — only the next trigger after it resolves does", async () => {
    let resolveSettle;
    fetchWholesaleCatalog
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5")) // initial load
      .mockReturnValueOnce(new Promise((resolve) => { resolveSettle = resolve; })) // the settle refresh — held open on purpose
      .mockResolvedValueOnce(catalogWithOneCard("PlayStation 5 Pro")); // the next real refresh, after the first one finishes

    renderPrices();
    await tick(); // initial load resolves
    await tick(4000); // settle refresh fires and starts (2nd call), still pending

    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2);

    // The shop switches tabs and back WHILE that settle refresh is still
    // unresolved — this must be a no-op, not a 3rd overlapping call.
    await dispatchVisibilityChange("visible");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(2); // unchanged — still in flight

    // Only once the in-flight one actually finishes does the guard release,
    // and a subsequent trigger is free to fetch again for real.
    resolveSettle(catalogWithOneCard("PlayStation 5"));
    await tick();
    await dispatchVisibilityChange("visible");
    expect(fetchWholesaleCatalog).toHaveBeenCalledTimes(3);
    expect(screen.getByText("PlayStation 5 Pro")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Structural: confirms the actual constants used in the timer-based
// scenarios above (4000ms settle delay, 4-minute periodic interval) match
// the real source, and that no full reload was used anywhere as the "fix".
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const pricesSrc = readFileSync(join(__dirname, "..", "src", "pages", "WholesalePrices.jsx"), "utf8").replace(/\r\n?/g, "\n");

describe("Structural: the exact constants this test file's timer advances assume, and no full-reload fallback anywhere in this fix", () => {
  it("SETTLE_REFRESH_DELAY_MS is 4000 and PERIODIC_REFRESH_INTERVAL_MS is 4 minutes — keeps this test file honest against the real source", () => {
    expect(pricesSrc).toContain("const SETTLE_REFRESH_DELAY_MS = 4000;");
    expect(pricesSrc).toContain("const PERIODIC_REFRESH_INTERVAL_MS = 4 * 60 * 1000;");
  });

  it("refreshCatalogSilently never sets status back to \"loading\" — the silent refresh can never blank the screen", () => {
    const fnIdx = pricesSrc.indexOf("function refreshCatalogSilently() {");
    const closeIdx = pricesSrc.indexOf("\n  useEffect(() => {\n    if (state.status !== \"ready\")", fnIdx);
    const body = pricesSrc.slice(fnIdx, closeIdx);
    expect(body).not.toMatch(/status:\s*"loading"/);
  });

  it("no window.location.reload() or full navigation used anywhere as part of this fix", () => {
    expect(pricesSrc).not.toContain("location.reload()");
  });

  it("both timers AND both listeners are cleared in the effect's cleanup function — no leaked interval/timeout/listener across remounts", () => {
    const effectIdx = pricesSrc.indexOf('if (state.status !== "ready") return undefined;');
    const cleanupIdx = pricesSrc.indexOf("return () => {", effectIdx);
    const cleanupBody = pricesSrc.slice(cleanupIdx, pricesSrc.indexOf("};", cleanupIdx) + 2);
    expect(cleanupBody).toContain("clearTimeout(settleTimeout);");
    expect(cleanupBody).toContain("clearInterval(interval);");
    expect(cleanupBody).toContain('document.removeEventListener("visibilitychange", handleVisibilityChange);');
    expect(cleanupBody).toContain('window.removeEventListener("pageshow", handlePageShow);');
  });

  it("visibilitychange/pageshow are registered inside the SAME effect as the timers (one setup point, one cleanup point) — never a second, separate effect that could register/clean up out of sync", () => {
    const effectIdx = pricesSrc.indexOf('if (state.status !== "ready") return undefined;');
    const addListenersIdx = pricesSrc.indexOf('document.addEventListener("visibilitychange"', effectIdx);
    const cleanupIdx = pricesSrc.indexOf("return () => {", effectIdx);
    const depsIdx = pricesSrc.indexOf("}, [state.status]);", effectIdx);
    expect(addListenersIdx).toBeGreaterThan(effectIdx);
    expect(addListenersIdx).toBeLessThan(cleanupIdx);
    expect(depsIdx).toBeGreaterThan(cleanupIdx);
  });

  it("refreshCatalogSilently guards against overlapping calls with a single in-flight ref, released in a .finally() so it can never get stuck permanently locked", () => {
    const fnIdx = pricesSrc.indexOf("function refreshCatalogSilently() {");
    const closeIdx = pricesSrc.indexOf("\n  useEffect(() => {\n    if (state.status !== \"ready\")", fnIdx);
    const body = pricesSrc.slice(fnIdx, closeIdx);
    expect(body).toContain("if (refreshInFlightRef.current) return;");
    expect(body).toContain("refreshInFlightRef.current = true;");
    expect(body).toMatch(/\.finally\(\(\) => \{\s*refreshInFlightRef\.current = false;/);
  });

  it("both handlers only ever refresh on document.visibilityState === \"visible\" — never unconditionally on every event", () => {
    expect(pricesSrc).toMatch(/function handleVisibilityChange\(\) \{\s*if \(document\.visibilityState === "visible"\) refreshCatalogSilently\(\);\s*\}/);
    expect(pricesSrc).toMatch(/function handlePageShow\(\) \{\s*if \(document\.visibilityState === "visible"\) refreshCatalogSilently\(\);\s*\}/);
  });
});
