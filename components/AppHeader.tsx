import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, List } from "lucide-react";

export function AppHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/80 px-4 py-3 backdrop-blur">
      <Link href="/" className="font-semibold">🌿 {title}</Link>
      <div className="flex items-center gap-1">
        <Button asChild variant="ghost" size="sm">
          <Link href="/plants"><List className="size-4" /> All</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/plants/new"><Plus className="size-4" /> Add</Link>
        </Button>
      </div>
    </header>
  );
}
