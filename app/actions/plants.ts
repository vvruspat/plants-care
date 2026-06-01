"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeNextDue } from "@/lib/scheduling";

type CreatePlantInput = {
  name: string;
  species: string | null;
  notes: string | null;
  location: string | null;
  primary_photo_path: string | null;
  ai_care_summary: string | null;
  water_interval_days: number;
  fertilize_interval_days: number;
  custom_schedules: { label: string; interval_days: number }[];
};

export async function createPlant(input: CreatePlantInput) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: plant, error } = await supabase
    .from("plants")
    .insert({
      name: input.name,
      species: input.species,
      notes: input.notes,
      location: input.location,
      primary_photo_path: input.primary_photo_path,
      ai_care_summary: input.ai_care_summary,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !plant) throw new Error(error?.message ?? "Insert plant failed");

  const now = new Date();
  const schedules = [
    { kind: "water" as const, label: "Water", interval_days: input.water_interval_days },
    { kind: "fertilize" as const, label: "Fertilize", interval_days: input.fertilize_interval_days },
    ...input.custom_schedules.map((c) => ({
      kind: "custom" as const,
      label: c.label,
      interval_days: c.interval_days,
    })),
  ].map((s) => ({
    plant_id: plant.id,
    ...s,
    next_due_at: computeNextDue(now, s.interval_days).toISOString(),
  }));

  await supabase.from("care_schedules").insert(schedules);

  if (input.primary_photo_path) {
    await supabase.from("plant_photos").insert({
      plant_id: plant.id,
      storage_path: input.primary_photo_path,
      uploaded_by: user.id,
    });
  }

  revalidatePath("/");
  revalidatePath("/plants");
  redirect(`/plants/${plant.id}`);
}

export async function updatePlant(id: string, patch: Partial<Pick<CreatePlantInput, "name" | "species" | "notes" | "location">>) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("plants").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/plants/${id}`);
  revalidatePath("/plants");
}

export async function deletePlant(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("plants").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/plants");
  redirect("/plants");
}
