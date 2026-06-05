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

export async function undoLastAction(scheduleId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch the schedule to know plant_id, interval, kind.
  const { data: sched } = await supabase
    .from("care_schedules")
    .select("id, plant_id, interval_days, kind")
    .eq("id", scheduleId)
    .single();
  if (!sched) throw new Error("Schedule not found");

  // Find the most recent action to delete.
  const { data: latest } = await supabase
    .from("care_actions")
    .select("id, done_at")
    .eq("schedule_id", scheduleId)
    .order("done_at", { ascending: false })
    .limit(1)
    .single();
  if (!latest) throw new Error("No action to undo");

  await supabase.from("care_actions").delete().eq("id", latest.id);

  // Find the previous action (if any) to restore the schedule state.
  const { data: prev } = await supabase
    .from("care_actions")
    .select("done_at, done_by")
    .eq("schedule_id", scheduleId)
    .order("done_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sched.kind === "custom") {
    // Reactivate the one-off action since it was undone.
    await supabase
      .from("care_schedules")
      .update({
        active: true,
        last_done_at: prev?.done_at ?? null,
        last_done_by: prev?.done_by ?? null,
      })
      .eq("id", scheduleId);
  } else {
    const nextDue = prev
      ? computeNextDue(new Date(prev.done_at), sched.interval_days).toISOString()
      : computeNextDue(new Date(), sched.interval_days).toISOString();
    await supabase
      .from("care_schedules")
      .update({
        last_done_at: prev?.done_at ?? null,
        last_done_by: prev?.done_by ?? null,
        next_due_at: nextDue,
      })
      .eq("id", scheduleId);
  }

  revalidatePath("/");
  revalidatePath(`/plants/${sched.plant_id}`);
}

export async function deleteSchedule(scheduleId: string, plantId: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("care_schedules").delete().eq("id", scheduleId);
  if (error) throw new Error(error.message);
  revalidatePath(`/plants/${plantId}`);
  revalidatePath("/");
}
