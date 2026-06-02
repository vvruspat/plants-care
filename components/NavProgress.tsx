"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * 4px green progress bar anchored to the bottom edge of its (relative) container.
 *
 * Starts immediately on any internal-link click (before the server responds),
 * fakes incremental progress, then completes when usePathname signals the new
 * route has mounted.
 */
export function NavProgress() {
  const pathname = usePathname();
  const prevPath = useRef(pathname);
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  function startBar() {
    if (ticker.current) clearInterval(ticker.current);
    let w = 8;
    setActive(true);
    setWidth(w);
    ticker.current = setInterval(() => {
      w = Math.min(w + Math.random() * 10, 85);
      setWidth(w);
    }, 200);
  }

  function finishBar() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setWidth(100);
    setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 350);
  }

  // Fire on any internal-link click — before the server responds.
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      // Skip external, mailto, tel, hash-only, and download links.
      if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return;
      startBar();
    }
    document.addEventListener("click", onLinkClick, true);
    return () => document.removeEventListener("click", onLinkClick, true);
  }, []);

  // Pathname change = new page has mounted → complete the bar.
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      finishBar();
    }
  }, [pathname]);

  if (!active) return null;

  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-0 h-[4px] rounded-r-full bg-green-500"
      style={{
        width: `${width}%`,
        transition: `width ${width === 100 ? 150 : 200}ms ease-out`,
      }}
    />
  );
}
