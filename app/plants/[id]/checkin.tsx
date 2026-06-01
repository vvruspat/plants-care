"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { recordCheckinPhoto } from "@/app/actions/photos";
import { useRouter } from "next/navigation";
import { compressImage } from "@/lib/compress";

export function CheckinPhotoButton({ plantId }: { plantId: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [_busy, setBusy] = useState(false);

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    start(async () => {
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("plant_id", plantId);
        fd.append("photo", compressed);
        const { analysis } = await recordCheckinPhoto(fd);
        toast.success(`Condition: ${analysis.condition}`);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
      <Button className="flex-1" disabled={pending} onClick={() => ref.current?.click()}>
        <Camera className="mr-2 size-4" />
        {pending ? "Analyzing…" : "Check-in photo"}
      </Button>
    </>
  );
}
