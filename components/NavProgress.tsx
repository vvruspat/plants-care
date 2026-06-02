"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin green bar that animates along the bottom edge of its container.
 * - Starts when the browser begins navigation (history.pushState / popstate).
 * - Completes when the new route's pathname appears in the React tree.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const [pct, setPct] = useState(0);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPath = useRef(pathname);

  function startBar() {
    if (ticker.current) clearInterval(ticker.current);
    let w = 12;
    setPct(w);
    setPhase("loading");
    ticker.current = setInterval(() => {
      w = Math.min(w + Math.random() * 12, 85);
      setPct(w);
    }, 220);
  }

  function finishBar() {
    if (ticker.current) clearInterval(ticker.current);
    setPct(100);
    setPhase("done");
    // allow the bar to reach 100% visually, then hide
    setTimeout(() => setPhase("idle"), 400);
  }

  // Patch history.pushState to detect soft navigation start.
  useEffect(() => {
    const orig = window.history.pushState.bind(window.history);
    window.history.pushState = (...args) => {
      orig(...args);
      startBar();
    };
    const onPop = () => startBar();
    window.addEventListener("popstate", onPop);
    return () => {
      window.history.pushState = orig;
      window.removeEventListener("popstate", onPop);
      if (ticker.current) clearInterval(ticker.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pathname change means the new page has mounted → finish the bar.
  useEffect(() => {
    if (pathname !== prevPath.current) {
      prevPath.current = pathname;
      finishBar();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (phase === "idle") return null;

  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-0 h-[3px] rounded-r-full bg-green-500 transition-all ease-out"
      style={{
        width: `${pct}%`,
        transitionDuration: phase === "done" ? "200ms" : "220ms",
        opacity: phase === "done" && pct === 100 ? 0 : 1,
      }}
    />
  );
}
