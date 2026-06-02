import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <Link href="/" className="font-semibold">🌿 Office Plants</Link>
      <Button asChild size="sm">
        <Link href="/plants/new"><Plus className="size-4" /> Add</Link>
      </Button>
    </header>
  );
}
