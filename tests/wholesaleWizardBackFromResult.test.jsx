// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useEffect, useRef } from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * Regression: Back from the result screen returned to the SAME result.
 *
 * The wizard pushes "progress" between the falla choice and the result, and
 * that screen auto-advances the moment it mounts. Back popped "result",
 * landed on "progress", and "progress" immediately pushed "result" straight
 * back, so the shop saw a flicker of loading and the identical quote, with
 * the falla still selected underneath.
 *
 * The progress panel is stubbed with a component that calls onComplete once
 * per MOUNT, exactly like the real one does after its reveal animation.
 * That is deliberate: the stub reproduces the auto-advance faithfully, so
 * if Back ever lands on "progress" again these tests bounce back into the
 * result and fail, which is the whole point. It also keeps this file about
 * navigation rather than about a rAF-driven animation.
 */
vi.mock("../src/components/wholesale/WholesaleProgressPanel.jsx", () => ({
  WholesaleProgressPanel: ({ onComplete }) => {
    const ref = useRef(onComplete);
    ref.current = onComplete;
    useEffect(() => { ref.current(); }, []);
    return <div data-testid="progress-panel" />;
  },
}));

const { WholesaleWizard } = await import("../src/components/wholesale/WholesaleWizard.jsx");
const { WholesaleLocaleProvider } = await import("../src/i18n/WholesaleLocaleContext.jsx");

/* One equipo, three models, and a 150 fixed-price falla on the model the
   test drills into. Mirrors the real /api/wholesale-prices shape. iPhone
   because its categories are not in PROMOTED_CATEGORY_SLUGS, so they stay
   models under one equipo instead of becoming top-level cards. */
function fixtureEquipmentTypes() {
  return [
    {
      id: "et-iphone", slug: "iphone", name: "iPhone", image: null,
      categories: [
        { id: "cat-a", slug: "iphone-7-11", name: "iPhone 7 to 11", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null,
          services: [
            { id: "svc-power", name: "No Power", pricing_type: "fixed", fixed_price: 150 },
            { id: "svc-screen", name: "Screen Replacement", pricing_type: "fixed", fixed_price: 90 },
          ] },
        { id: "cat-b", slug: "iphone-12-14", name: "iPhone 12 to 14", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null,
          services: [{ id: "svc-boot", name: "Boot Loop", pricing_type: "fixed", fixed_price: 120 }] },
        { id: "cat-c", slug: "iphone-15-17", name: "iPhone 15 to 17", notes: null, diagnostic_fee: null, diagnostic_description: null, image: null,
          services: [{ id: "svc-x", name: "Water Damage", pricing_type: "fixed", fixed_price: 200 }] },
      ],
    },
  ];
}

const RESULT_MARKER = "Estimate before other expenses.";
const FAULT_HEADING = "Choose the issue";
const MODEL_HEADING = "Choose your model";
const TOP_HEADING = "Select a Device to View Pricing";

function renderWizard() {
  return render(
    <WholesaleLocaleProvider>
      <WholesaleWizard equipmentTypes={fixtureEquipmentTypes()} warranty={null} />
    </WholesaleLocaleProvider>
  );
}

function driveToResult() {
  renderWizard();
  fireEvent.click(screen.getByText("iPhone"));
  fireEvent.click(screen.getByText("iPhone 7 to 11"));
  fireEvent.click(screen.getByText("No Power"));
}

function backButtons() {
  return screen.getAllByRole("button", { name: "Back" });
}

function pageText() {
  return document.body.textContent || "";
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("torays_wholesale_locale", JSON.stringify({ language: "en", country: "US", currency: "USD" }));
  /* Report prefers-reduced-motion, which jsdom does not implement at all.
     The result panel counts the shop cost up from $0.00 over a rAF-driven
     animation, and under reduced motion it renders the FINAL value straight
     away instead. That is what makes "150 is on screen" and "150 is gone"
     both mean something here, rather than passing by accident because the
     count-up simply had not reached it yet. */
  window.matchMedia = (query) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false; },
  });
});
afterEach(cleanup);

describe("Back from the result screen returns to the falla list, and STAYS there", () => {
  it("reaches the result at all, so the rest of this file is testing something real", () => {
    driveToResult();
    expect(screen.getByText(RESULT_MARKER)).toBeTruthy();
    expect(pageText()).toContain("150");
  });

  it("Back shows the falla list, not the result and not the main menu", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    expect(screen.getByText(FAULT_HEADING)).toBeTruthy();
    expect(screen.queryByText(RESULT_MARKER)).toBeNull();
    expect(screen.queryByText(TOP_HEADING)).toBeNull();
    expect(screen.queryByText(MODEL_HEADING)).toBeNull();
  });

  it("the result does NOT come back on its own, and the progress screen never re-mounts", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    expect(screen.queryByTestId("progress-panel")).toBeNull();
    expect(screen.queryByText(RESULT_MARKER)).toBeNull();
  });

  it("the 150 quote is gone from the page and does not reappear", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    expect(pageText()).not.toContain("150");
  });

  it("equipo and modelo survive, so the falla list is still THIS model own list", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    expect(screen.getByText("No Power")).toBeTruthy();
    expect(screen.getByText("Screen Replacement")).toBeTruthy();
    expect(screen.queryByText("Boot Loop")).toBeNull();
    expect(screen.queryByText("Water Damage")).toBeNull();
  });

  it("another falla can be chosen right away and produces ITS own result", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    fireEvent.click(screen.getByText("Screen Replacement"));
    expect(screen.getByText(RESULT_MARKER)).toBeTruthy();
    expect(pageText()).toContain("90");
  });

  it("the same falla can be re-chosen, so clearing it is not a dead end", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    fireEvent.click(screen.getByText("No Power"));
    expect(screen.getByText(RESULT_MARKER)).toBeTruthy();
  });
});

describe("Every Back step: one screen at a time, earlier picks kept", () => {
  it("result to falla to modelo to menu, one press each, never a jump", () => {
    driveToResult();

    fireEvent.click(backButtons()[0]);
    expect(screen.getByText(FAULT_HEADING)).toBeTruthy();

    fireEvent.click(backButtons()[0]);
    expect(screen.getByText(MODEL_HEADING)).toBeTruthy();
    expect(screen.getByText("iPhone 7 to 11")).toBeTruthy();
    expect(screen.getByText("iPhone 12 to 14")).toBeTruthy();

    fireEvent.click(backButtons()[0]);
    expect(screen.getByText(TOP_HEADING)).toBeTruthy();
  });

  it("re-picking a DIFFERENT model after Back shows that model fallas, never the old ones", () => {
    driveToResult();
    fireEvent.click(backButtons()[0]);
    fireEvent.click(backButtons()[0]);
    fireEvent.click(screen.getByText("iPhone 12 to 14"));
    expect(screen.getByText("Boot Loop")).toBeTruthy();
    expect(screen.queryByText("No Power")).toBeNull();
  });

  it("no residual state auto-advances anything: three presses land on the menu and stop", () => {
    driveToResult();
    for (let i = 0; i < 3; i++) fireEvent.click(backButtons()[0]);
    expect(screen.getByText(TOP_HEADING)).toBeTruthy();
    expect(screen.queryByText(RESULT_MARKER)).toBeNull();
    expect(screen.queryByTestId("progress-panel")).toBeNull();
  });
});
