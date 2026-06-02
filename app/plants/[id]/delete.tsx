"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePlant } from "@/app/actions/plants";
import { rethrowIfRedirect } from "@/lib/redirect-error";

export function DeletePlantButton({ plantId }: { plantId: string }) {
  const [pending, start] = useTransition();
  function onClick() {
    if (!confirm("Delete this plant? This cannot be undone.")) return;
    start(async () => {
      try {
        await deletePlant(plantId);
      } catch (err) {
        rethrowIfRedirect(err);
        toast.error(err instanceof Error ? err.message : "Delete failed");
      }
    });
  }
  return (
    <Button variant="ghost" size="icon" disabled={pending} onClick={onClick}>
      <Trash2 className="size-4 text-destructive" />
    </Button>
  );
}
