import { useCallback, useEffect, useState } from "react";

/**
 * The cart is a per-browser convenience: only product ids + quantities,
 * kept in localStorage (wrapped in try/catch — private mode or blocked
 * storage just means the cart lives for this page view). Prices are never
 * stored here; the server prices every order from the database.
 */
const KEY = "torays_shop_cart_v1";
const EVENT = "torays-shop-cart";

export function readCart() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw)
      ? raw.filter((l) => typeof l?.productId === "string" && Number.isInteger(l.quantity) && l.quantity > 0).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function writeCart(lines) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // storage unavailable — cart still works in memory for this view
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lines }));
}

export function useCart() {
  const [lines, setLines] = useState(() => (typeof window === "undefined" ? [] : readCart()));

  useEffect(() => {
    const sync = (e) => setLines(e.detail || readCart());
    const storage = () => setLines(readCart());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", storage);
    };
  }, []);

  const update = useCallback((fn) => {
    const next = fn(readCart()).filter((l) => l.quantity > 0);
    setLines(next);
    writeCart(next);
  }, []);

  return {
    lines,
    count: lines.reduce((s, l) => s + l.quantity, 0),
    add: (productId, quantity = 1, max = 99) =>
      update((cur) => {
        const found = cur.find((l) => l.productId === productId);
        if (found) return cur.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(max, l.quantity + quantity) } : l));
        return [...cur, { productId, quantity: Math.min(max, quantity) }];
      }),
    setQuantity: (productId, quantity) => update((cur) => cur.map((l) => (l.productId === productId ? { ...l, quantity } : l))),
    remove: (productId) => update((cur) => cur.filter((l) => l.productId !== productId)),
    clear: () => update(() => []),
    replace: (next) => update(() => next),
  };
}

export function formatMoney(cents, lang = "en") {
  return new Intl.NumberFormat(lang === "es" ? "es-US" : "en-US", { style: "currency", currency: "USD" }).format((cents || 0) / 100);
}
