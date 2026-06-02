"use client";

import { usePathname } from "next/navigation";

export function AnimatedContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="flex-1 animate-in slide-in-from-right-8 duration-300 ease-out"
    >
      {children}
    </div>
  );
}
