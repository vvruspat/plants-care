import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  verifySlackSignature,
  getSlackUserEmail,
  buildDoneBlocks,
  respondToAction,
} from "@/lib/slack";
import { computeNextDue } from "@/lib/scheduling";

export const runtime = "nodejs";

type SlackPayload = {
  type: string;
  response_url: string;
  actions: Array<{ action_id: string; value: string }>;
  user: { id: string; name: string };
  message: {
    ts: string;
    blocks: Record<string, unknown>[];
  };
};

export async function POST(request: NextRequest) {
  // 1. Read raw body for signature verification.
  const rawBody = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // 2. Parse the URL-encoded payload.
  const params = new URLSearchParams(rawBody);
  const payload: SlackPayload = JSON.parse(params.get("payload") ?? "{}");

  if (payload.type !== "block_actions") {
    return new NextResponse("ok", { status: 200 });
  }

  const action = payload.actions.find((a) => a.action_id === "mark_done");
  if (!action) return new NextResponse("ok", { status: 200 });

  const scheduleId = action.value;
  const slackUserId = payload.user.id;

  const supabase = createSupabaseServiceClient();

  // 3. Resolve (or create) the Supabase user from the Slack user.
  let userId: string;
  let displayName: string;

  try {
    const { email, name } = await getSlackUserEmail(slackUserId);
    displayName = name;

    // Find existing user by email.
    const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = users.find((u) => u.email === email);

    if (existing) {
      userId = existing.id;
      displayName = (existing.user_metadata as { full_name?: string })?.full_name ?? name;
    } else {
      // Auto-provision — mark email as confirmed since Slack already verified them.
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name, slack_user_id: slackUserId },
      });
      if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
      userId = created.user.id;
    }
  } catch (e) {
    console.error("User resolution failed:", e);
    // Fall back to Slack display name, no Supabase user.
    userId = slackUserId; // won't match a real user but lets the action proceed
    displayName = payload.user.name;
  }

  // 4. Load schedule + plant.
  const { data: sched } = await supabase
    .from("care_schedules")
    .select("id, plant_id, interval_days, kind, label, plants(name, location, primary_photo_path)")
    .eq("id", scheduleId)
    .single();

  if (!sched) {
    await respondToAction(payload.response_url, [], "❌ Action not found.");
    return new NextResponse("ok", { status: 200 });
  }

  const rawPlant = (sched as unknown as { plants?: { name: string; location: string | null; primary_photo_path: string | null } | Array<{ name: string; location: string | null; primary_photo_path: string | null }> }).plants;
  const plant = Array.isArray(rawPlant) ? rawPlant[0] : rawPlant;

  // 5. Mark action done.
  const now = new Date();
  await supabase.from("care_actions").insert({
    schedule_id: sched.id,
    plant_id: sched.plant_id,
    done_by: userId,
    done_at: now.toISOString(),
  });

  if (sched.kind === "custom") {
    await supabase.from("care_schedules")
      .update({ last_done_at: now.toISOString(), last_done_by: userId, active: false })
      .eq("id", sched.id);
  } else {
    await supabase.from("care_schedules")
      .update({
        last_done_at: now.toISOString(),
        last_done_by: userId,
        next_due_at: computeNextDue(now, sched.interval_days).toISOString(),
      })
      .eq("id", sched.id);
  }

  // 6. Replace the original Slack message with a "Done" version.
  const doneBlocks = buildDoneBlocks({
    plantName: plant?.name ?? "Plant",
    plantLocation: plant?.location ?? null,
    primaryPhotoPath: plant?.primary_photo_path ?? null,
    actionLabel: sched.label,
    actionKind: sched.kind,
    doneByName: displayName,
  });

  await respondToAction(
    payload.response_url,
    doneBlocks,
    `✅ ${plant?.name ?? "Plant"} — ${sched.label} done by ${displayName}`,
  );

  return new NextResponse("ok", { status: 200 });
}
