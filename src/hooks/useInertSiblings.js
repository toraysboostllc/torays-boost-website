import { useEffect } from "react";

/**
 * Marks every DOM sibling of the given overlay element `inert` while it's
 * mounted, so keyboard and assistive-tech navigation can't reach
 * background content that a full-screen modal already visually covers —
 * restores each sibling's prior `inert` state on unmount.
 */
export function useInertSiblings(overlayRef) {
  useEffect(() => {
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!parent) return undefined;
    const siblings = Array.from(parent.children).filter((el) => el !== overlay);
    const prevInert = siblings.map((el) => el.inert);
    siblings.forEach((el) => {
      el.inert = true;
    });
    return () => {
      siblings.forEach((el, i) => {
        el.inert = prevInert[i];
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
