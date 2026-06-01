"use server";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { analyzeCheckinPhoto, analyzeNewPlant } from "@/lib/anthropic";
import { PHOTO_BUCKET, photoPublicUrl } from "@/lib/storage";
import { computeNextDue } from "@/lib/scheduling";

async function uploadPhotoFile(file: File, plantId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `plants/${plantId}/${randomUUID()}.${ext || "jpg"}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function analyzeNewPlantPhoto(formData: FormData) {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No photo provided");
  }
  const tempId = randomUUID();
  const path = await uploadPhotoFile(file, `pending/${tempId}`);
  const analysis = await analyzeNewPlant(photoPublicUrl(path));
  return { path, analysis };
}

export async function recordCheckinPhoto(formData: FormData) {
  const plantId = String(formData.get("plant_id") ?? "");
  const file = formData.get("photo");
  if (!plantId) throw new Error("Missing plant_id");
  if (!(file instanceof File) || file.size === 0) throw new Error("No photo provided");

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plant } = await supabase
    .from("plants")
    .select("species")
    .eq("id", plantId)
    .single();

  const { data: lastWater } = await supabase
    .from("care_schedules")
    .select("last_done_at")
    .eq("plant_id", plantId)
    .eq("kind", "water")
    .maybeSingle();

  const path = await uploadPhotoFile(file, plantId);
  const lastWateredAgoDays = lastWater?.last_done_at
    ? Math.round((Date.now() - new Date(lastWater.last_done_at).getTime()) / 86_400_000)
    : null;

  const analysis = await analyzeCheckinPhoto(photoPublicUrl(path), {
    species: plant?.species ?? null,
    lastWateredAgoDays,
  });

  await supabase.from("plant_photos").insert({
    plant_id: plantId,
    storage_path: path,
    uploaded_by: user.id,
    ai_analysis: analysis,
  });

  // If Claude flagged "now" recommendations, create custom one-off schedules due today.
  const urgentNow = analysis.recommendations.filter((r) => r.urgency === "now");
  if (urgentNow.length > 0) {
    await supabase.from("care_schedules").insert(
      urgentNow.map((r) => ({
        plant_id: plantId,
        kind: "custom" as const,
        label: r.label,
        interval_days: 7,
        next_due_at: new Date().toISOString(),
      })),
    );
  }

  // Promote new photo to primary.
  await supabase.from("plants").update({ primary_photo_path: path }).eq("id", plantId);

  return { analysis, path };
}

export { computeNextDue };
