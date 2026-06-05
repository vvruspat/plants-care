"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { computeNextDue } from "@/lib/scheduling";
import { buildDoneBlocks, postMessage, postThreadReply } from "@/lib/slack";

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

  // Fire-and-forget: post to Slack without blocking the response.
  notifySlackDone(sched.id, sched.plant_id, user).catch(() => {});
}

async function notifySlackDone(
  scheduleId: string,
  plantId: string,
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> },
) {
  if (!process.env.SLACK_BOT_TOKEN) return;

  const admin = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: plant }, { data: sched }, { data: notif }] = await Promise.all([
    admin.from("plants").select("name, location, primary_photo_path").eq("id", plantId).single(),
    admin.from("care_schedules").select("label, kind").eq("id", scheduleId).single(),
    admin
      .from("slack_notifications")
      .select("message_ts, channel_id")
      .eq("schedule_id", scheduleId)
      .eq("notified_on", today)
      .maybeSingle(),
  ]);

  if (!plant || !sched) return;

  const displayName =
    (user.user_metadata?.full_name as string) ??
    (user.user_metadata?.name as string) ??
    user.email?.split("@")[0] ??
    "Someone";

  const doneBlocks = buildDoneBlocks({
    plantName: plant.name,
    plantLocation: plant.location,
    primaryPhotoPath: plant.primary_photo_path,
    actionLabel: sched.label,
    actionKind: sched.kind as "water" | "fertilize" | "custom",
    doneByName: displayName,
  });

  const text = `✅ ${plant.name} — ${sched.label} done by ${displayName}`;

  if (notif?.message_ts && notif.channel_id) {
    // Reply in the existing overdue notification thread.
    await postThreadReply(notif.channel_id, notif.message_ts, text);
  } else {
    // No prior notification — post a standalone done message.
    await postMessage({ blocks: doneBlocks, text });
  }
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
