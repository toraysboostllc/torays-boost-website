// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WholesaleLogin } from "../src/pages/WholesaleLogin.jsx";

/**
 * "Keep me signed in on this device" — client-side coverage for
 * src/pages/WholesaleLogin.jsx: the checkbox itself (unchecked by default,
 * exact bilingual copy), that checking it is what actually reaches
 * wholesaleLogin() as `rememberDevice`, and the silent session check that
 * sends an already-authenticated device straight to /wholesale/prices
 * without ever rendering the login form (item 3 of the spec: "sin mostrar
 * el login"). Real @testing-library/react render tests — same established
 * pattern as tests/wholesalePricesImageSelfHeal.test.jsx for exactly this
 * class of async-effect-driven behavior a structural source-scan can't
 * prove.
 */

// jsdom has no IntersectionObserver — needed because <Card> (the login
// form's container) is a framer-motion whileInView element. A minimal stub
// is enough; this file never asserts on scroll-triggered animation, only on
// the form's actual content, which framer-motion still renders immediately
// (the `initial`/`whileInView` opacity transition doesn't hide content from
// the accessibility tree or the DOM).
class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);

const navigateMock = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("../src/lib/wholesaleAuth.js", () => ({
  wholesaleLogin: vi.fn(),
  fetchWholesaleCatalog: vi.fn(),
}));

import { wholesaleLogin, fetchWholesaleCatalog } from "../src/lib/wholesaleAuth.js";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/wholesale"]}>
      <WholesaleLogin />
    </MemoryRouter>
  );
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  navigateMock.mockClear();
  wholesaleLogin.mockReset();
  fetchWholesaleCatalog.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("Silent session check on mount", () => {
  it("does NOT render the login form while the check is in flight", async () => {
    let resolveCheck;
    fetchWholesaleCatalog.mockReturnValue(new Promise((resolve) => { resolveCheck = resolve; }));

    renderLogin();
    expect(screen.queryByText("Shop Name")).toBeNull();
    expect(screen.queryByRole("button", { name: "Log In" })).toBeNull();

    resolveCheck({ ok: false, kind: "auth", message: "Session expired." });
    await flush();
  });

  it("a valid session (ok) redirects straight to /wholesale/prices — the form is never shown at all", async () => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: true, shopName: "Acme Repair", equipmentTypes: [] });

    renderLogin();
    await flush();

    expect(navigateMock).toHaveBeenCalledWith("/wholesale/prices", { replace: true });
    expect(screen.queryByText("Shop Name")).toBeNull();
  });

  it("a session that only needs the legal gate (legal_required) ALSO redirects straight to /wholesale/prices — WholesalePrices.jsx already knows how to show that gate", async () => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: false, kind: "legal_required", missing: [{ documentType: "master_agreement" }] });

    renderLogin();
    await flush();

    expect(navigateMock).toHaveBeenCalledWith("/wholesale/prices", { replace: true });
    expect(screen.queryByText("Shop Name")).toBeNull();
  });

  it("no valid session (auth) renders the normal login form, no redirect", async () => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: false, kind: "auth", message: "Session expired." });

    renderLogin();
    await flush();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Shop Name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log In" })).toBeTruthy();
  });

  it("a transient/unknown failure also renders the normal form rather than redirecting (fails open to showing login, never to skipping it)", async () => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: false, kind: "transient", message: "Could not reach the server." });

    renderLogin();
    await flush();

    expect(navigateMock).not.toHaveBeenCalled();
    expect(screen.getByText("Shop Name")).toBeTruthy();
  });
});

describe("The 'Keep me signed in on this device' checkbox", () => {
  beforeEach(() => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: false, kind: "auth", message: "Session expired." });
  });

  it("renders unchecked by default, with the exact requested English copy", async () => {
    renderLogin();
    await flush();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText("Keep me signed in on this device")).toBeTruthy();
    expect(screen.getByText("Do not use on a public or shared device.")).toBeTruthy();
  });

  it("can be checked by the user", async () => {
    renderLogin();
    await flush();

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it("submitting with the box CHECKED calls wholesaleLogin with rememberDevice: true", async () => {
    wholesaleLogin.mockResolvedValue({ ok: true });
    renderLogin();
    await flush();

    fireEvent.change(screen.getByLabelText("Shop Name"), { target: { value: "Acme Repair" } });
    fireEvent.change(screen.getByLabelText("Access Code"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await flush();

    expect(wholesaleLogin).toHaveBeenCalledWith("Acme Repair", "SECRET123", true);
  });

  it("submitting with the box left UNCHECKED calls wholesaleLogin with rememberDevice: false (never undefined)", async () => {
    wholesaleLogin.mockResolvedValue({ ok: true });
    renderLogin();
    await flush();

    fireEvent.change(screen.getByLabelText("Shop Name"), { target: { value: "Acme Repair" } });
    fireEvent.change(screen.getByLabelText("Access Code"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await flush();

    expect(wholesaleLogin).toHaveBeenCalledWith("Acme Repair", "SECRET123", false);
  });
});

describe("The Access Code is never stored in the browser from this component", () => {
  beforeEach(() => {
    fetchWholesaleCatalog.mockResolvedValue({ ok: false, kind: "auth", message: "Session expired." });
  });

  it("localStorage/sessionStorage are never written to while typing the code or submitting", async () => {
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    wholesaleLogin.mockResolvedValue({ ok: false, message: "Invalid shop name or code." });
    renderLogin();
    await flush();

    fireEvent.change(screen.getByLabelText("Access Code"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));
    await flush();

    // wholesaleLocale.jsx itself may touch localStorage for the language
    // preference — this only asserts the submitted CODE never appears as a
    // stored value under any key.
    for (const call of localSpy.mock.calls) {
      expect(String(call[1])).not.toContain("secret123");
      expect(String(call[1])).not.toContain("SECRET123");
    }
    localSpy.mockRestore();
  });
});
