import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { buildCareBlocks, postMessage } from "@/lib/slack";

export const runtime = "nodejs";

type OverdueRow = {
  id: string;
  label: string;
  kind: "water" | "fertilize" | "custom";
  next_due_at: string;
  plant: {
    id: string;
    name: string;
    location: string | null;
    primary_photo_path: string | null;
  } | null;
};

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString();

  // Include overdue AND due within the next 24 hours.
  const { data: rows, error } = await supabase
    .from("care_schedules")
    .select("id, label, kind, next_due_at, plant:plants(id, name, location, primary_photo_path)")
    .eq("active", true)
    .lte("next_due_at", tomorrow)
    .order("next_due_at", { ascending: true })
    .returns<OverdueRow[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (rows ?? []).map((r) => r.id);
  const { data: alreadyNotified } = await supabase
    .from("slack_notifications")
    .select("schedule_id")
    .eq("notified_on", today)
    .in("schedule_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
  const skipSet = new Set((alreadyNotified ?? []).map((r) => r.schedule_id));

  const fresh = (rows ?? []).filter((r) => !skipSet.has(r.id) && r.plant);
  if (fresh.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ ok: true, notified: 0, skipped: fresh.length, reason: "SLACK_BOT_TOKEN not configured" });
  }

  const channelId = process.env.SLACK_CHANNEL_ID ?? "";
  let notified = 0;

  for (const row of fresh) {
    if (!row.plant) continue;
    const daysOverdue = Math.round((Date.now() - new Date(row.next_due_at).getTime()) / 86_400_000);

    const blocks = buildCareBlocks({
      scheduleId: row.id,
      plantName: row.plant.name,
      plantLocation: row.plant.location,
      primaryPhotoPath: row.plant.primary_photo_path,
      actionLabel: row.label,
      actionKind: row.kind,
      daysOverdue,
    });

    const ts = await postMessage({
      channel: channelId,
      blocks,
      text: `🌿 ${row.plant.name} — ${row.label} ${daysOverdue > 0 ? `overdue by ${daysOverdue}d` : "due soon"}`,
    });

    await supabase.from("slack_notifications").insert({
      schedule_id: row.id,
      notified_on: today,
      message_ts: ts,
      channel_id: channelId,
    });

    notified++;
  }

  return NextResponse.json({ ok: true, notified });
}
