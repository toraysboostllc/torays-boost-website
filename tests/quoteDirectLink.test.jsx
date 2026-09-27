// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import App from "../src/App.jsx";
import { LanguageProvider } from "../src/i18n/LanguageContext.jsx";

/**
 * /quote is the shareable direct link to the repair quote wizard (Instagram
 * bio, NFC keychains, WhatsApp replies). It must land on Home with the
 * wizard already open, "/" must NOT open it, and closing it from /quote must
 * leave the visitor on "/" so a refresh doesn't pop it open again.
 */

beforeAll(() => {
  // Home's sections animate on scroll; jsdom has no IntersectionObserver.
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
  window.matchMedia ??= () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.scrollTo ??= () => {};
});

afterEach(cleanup);

let currentPath = null;
function PathSpy() {
  currentPath = useLocation().pathname;
  return null;
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LanguageProvider>
        <App />
        <PathSpy />
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("/quote direct link", () => {
  it("opens the repair quote wizard on load", () => {
    renderAt("/quote");
    expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0);
  });

  it('"/" does not open the wizard by itself', () => {
    renderAt("/");
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it('closing the wizard opened from /quote leaves the visitor on "/"', () => {
    renderAt("/quote");
    const dialog = screen.getAllByRole("dialog")[0];
    const closeButton = dialog.querySelector('button[aria-label]');
    expect(closeButton).not.toBeNull();
    act(() => {
      fireEvent.click(closeButton);
    });
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
    expect(currentPath).toBe("/");
  });
});
