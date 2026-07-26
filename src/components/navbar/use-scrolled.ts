"use client";

import * as React from "react";

/**
 * Tracks whether the page has scrolled past `threshold` pixels.
 * Reads are throttled to one per animation frame to keep scrolling cheap.
 */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    // Sync immediately: the page can already be scrolled on mount (restored
    // scroll position, or a page loaded at an #anchor).
    update();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return scrolled;
}
