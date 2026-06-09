import { useEffect, useRef } from "react";

// Measures the fixed-position place-bid bar and writes its height into the
// --bid-bar-h CSS variable so the page reserves exactly enough bottom space on
// phones. This is a legitimate effect: it syncs React with an external system
// (the DOM/ResizeObserver), which cannot be derived during render.
export function useBidBarHeight() {
  const pageRef = useRef<HTMLElement>(null);
  const bidBarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const bar = bidBarRef.current;
    if (!page || !bar || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? bar.offsetHeight;
      page.style.setProperty("--bid-bar-h", `${Math.ceil(height)}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return { pageRef, bidBarRef };
}
