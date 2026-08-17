import { useEffect } from "react";

// Module-scope, not component state — reference-counted so two overlays
// mounting/unmounting in the same React commit (the WhatsApp gate handing
// off straight into the wizard) never double-lock or release a still-open
// overlay's lock early.
let lockCount = 0;
let savedScrollY = 0;
let savedBodyStyle = null;

function applyLock() {
  savedScrollY = window.scrollY;
  savedBodyStyle = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
  };
  // `overflow: hidden` alone doesn't stop touch-driven scroll on iOS
  // Safari — fixing the body at its current offset does, and it's what
  // lets us restore the exact same scroll position on close instead of
  // snapping to wherever `overflow` visually happened to leave it.
  document.body.style.position = "fixed";
  document.body.style.top = `-${savedScrollY}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function releaseLock() {
  const prev = savedBodyStyle;
  savedBodyStyle = null;
  document.body.style.position = prev.position;
  document.body.style.top = prev.top;
  document.body.style.left = prev.left;
  document.body.style.right = prev.right;
  document.body.style.width = prev.width;
  window.scrollTo(0, savedScrollY);
}

/** Locks background scroll for as long as the calling component is mounted. */
export function useScrollLock() {
  useEffect(() => {
    if (lockCount === 0) applyLock();
    lockCount += 1;
    return () => {
      lockCount -= 1;
      if (lockCount === 0) releaseLock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
