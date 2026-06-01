"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeNextDue } from "@/lib/scheduling";

export async function markActionDone(scheduleId: string, note?: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: sched, error: schedErr } = await supabase
    .from("care_schedules")
    .select("id, plant_id, interval_days, kind")
    .eq("id", scheduleId)
    .single();
  if (schedErr || !sched) throw new Error(schedErr?.message ?? "Schedule not found");

  const now = new Date();
  await supabase.from("care_actions").insert({
    schedule_id: sched.id,
    plant_id: sched.plant_id,
    done_by: user.id,
    note: note ?? null,
  });

  if (sched.kind === "custom") {
    // One-off custom recommendations: deactivate after done.
    await supabase
      .from("care_schedules")
      .update({ last_done_at: now.toISOString(), last_done_by: user.id, active: false })
      .eq("id", sched.id);
  } else {
    await supabase
      .from("care_schedules")
      .update({
        last_done_at: now.toISOString(),
        last_done_by: user.id,
        next_due_at: computeNextDue(now, sched.interval_days).toISOString(),
      })
      .eq("id", sched.id);
  }

  revalidatePath("/");
  revalidatePath(`/plants/${sched.plant_id}`);
}

export async function addCustomSchedule(plantId: string, label: string, intervalDays: number) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("care_schedules").insert({
    plant_id: plantId,
    kind: "custom",
    label,
    interval_days: intervalDays,
    next_due_at: computeNextDue(new Date(), intervalDays).toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/plants/${plantId}`);
  revalidatePath("/");
}

export async function deleteSchedule(scheduleId: string, plantId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("care_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/plants/${plantId}`);
  revalidatePath("/");
}
