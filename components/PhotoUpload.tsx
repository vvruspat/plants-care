"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2 } from "lucide-react";

type Props = {
  name?: string;
  label?: string;
  required?: boolean;
  analyzing?: boolean;
  onFile?: (file: File) => void;
};

export function PhotoUpload({
  name = "photo",
  label = "Take or choose a photo",
  required,
  analyzing = false,
  onFile,
}: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile?.(file);
  }

  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        name={name}
        accept="image/*"
        capture="environment"
        required={required}
        className="hidden"
        onChange={handle}
      />
      {preview ? (
        <button
          type="button"
          onClick={() => !analyzing && ref.current?.click()}
          className="relative block w-full overflow-hidden rounded-lg border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Selected" className="aspect-square w-full object-cover" />
          {analyzing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-sm font-medium">Identifying plant…</span>
            </div>
          )}
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-full h-32"
          onClick={() => ref.current?.click()}
        >
          <Camera className="mr-2 size-5" />
          {label}
        </Button>
      )}
    </div>
  );
}
