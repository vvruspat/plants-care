import { createHmac } from "node:crypto";
import { photoPublicUrl } from "./storage";

const BOT_TOKEN = () => process.env.SLACK_BOT_TOKEN;
const CHANNEL_ID = () => process.env.SLACK_CHANNEL_ID;

// ─── Core API call ────────────────────────────────────────────────────────────

async function slackApi(method: string, body: Record<string, unknown>) {
  const token = BOT_TOKEN();
  if (!token) throw new Error("SLACK_BOT_TOKEN not set");
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json() as { ok: boolean; error?: string; ts?: string; user?: SlackUser };
  if (!data.ok) throw new Error(`Slack ${method} failed: ${data.error}`);
  return data;
}

// ─── Signature verification ───────────────────────────────────────────────────

export function verifySlackSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return false;
  // Reject replays older than 5 minutes.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const computed = `v0=${createHmac("sha256", secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest("hex")}`;
  return computed === signature;
}

// ─── User lookup / auto-provision ─────────────────────────────────────────────

type SlackUser = { profile?: { email?: string; real_name?: string; image_72?: string } };

export async function getSlackUserEmail(slackUserId: string): Promise<{ email: string; name: string }> {
  const data = await slackApi("users.info", { user: slackUserId });
  const profile = (data.user as SlackUser)?.profile;
  const email = profile?.email;
  const name = profile?.real_name ?? slackUserId;
  if (!email) throw new Error(`No email for Slack user ${slackUserId}`);
  return { email, name };
}

// ─── Block Kit builders ───────────────────────────────────────────────────────

type ActionKind = "water" | "fertilize" | "custom";
const KIND_EMOJI: Record<ActionKind, string> = { water: "💧", fertilize: "🌱", custom: "✨" };

export function buildCareBlocks(opts: {
  scheduleId: string;
  plantName: string;
  plantLocation: string | null;
  primaryPhotoPath: string | null;
  actionLabel: string;
  actionKind: ActionKind;
  daysOverdue: number;
}): Record<string, unknown>[] {
  const { scheduleId, plantName, plantLocation, primaryPhotoPath, actionLabel, actionKind, daysOverdue } = opts;
  const emoji = KIND_EMOJI[actionKind];
  const urgency = daysOverdue > 0
    ? `overdue by *${daysOverdue}d*`
    : daysOverdue === 0 ? "due *today*" : "due *tomorrow*";

  const section: Record<string, unknown> = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🌿 *${plantName}*${plantLocation ? ` · ${plantLocation}` : ""}\n${emoji} ${actionLabel} — ${urgency}`,
    },
  };

  if (primaryPhotoPath) {
    section.accessory = {
      type: "image",
      image_url: photoPublicUrl(primaryPhotoPath),
      alt_text: plantName,
    };
  }

  return [
    section,
    {
      type: "actions",
      elements: [
        {
          type: "button",
          // Show the action label on the button (truncate to Slack's 75-char limit).
          text: { type: "plain_text", text: actionLabel.slice(0, 75), emoji: true },
          style: "primary",
          action_id: "mark_done",
          value: scheduleId,
        },
      ],
    },
  ];
}

export function buildDoneBlocks(opts: {
  plantName: string;
  plantLocation: string | null;
  primaryPhotoPath: string | null;
  actionLabel: string;
  actionKind: ActionKind;
  doneByName: string;
}): Record<string, unknown>[] {
  const { plantName, plantLocation, primaryPhotoPath, actionLabel, actionKind, doneByName } = opts;
  const emoji = KIND_EMOJI[actionKind];

  const section: Record<string, unknown> = {
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🌿 *${plantName}*${plantLocation ? ` · ${plantLocation}` : ""}\n${emoji} ${actionLabel} — ✅ done by *${doneByName}*`,
    },
  };

  if (primaryPhotoPath) {
    section.accessory = {
      type: "image",
      image_url: photoPublicUrl(primaryPhotoPath),
      alt_text: plantName,
    };
  }

  return [section];
}

// ─── Posting helpers ──────────────────────────────────────────────────────────

/** Post a new message. Returns the message timestamp (ts). */
export async function postMessage(opts: {
  channel?: string;
  blocks: Record<string, unknown>[];
  text: string;
}): Promise<string | null> {
  const channel = opts.channel ?? CHANNEL_ID();
  if (!channel || !BOT_TOKEN()) {
    console.warn("Slack not configured — skipping post");
    return null;
  }
  try {
    const data = await slackApi("chat.postMessage", {
      channel,
      blocks: opts.blocks,
      text: opts.text,
    });
    return data.ts ?? null;
  } catch (e) {
    console.error("Slack postMessage failed:", e);
    return null;
  }
}

/** Update an existing message in-place via response_url (from interactive payload). */
export async function respondToAction(responseUrl: string, blocks: Record<string, unknown>[], text: string) {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replace_original: true, blocks, text }),
  });
}

/** Post a thank-you as a thread reply on an existing message. */
export async function postThreadReply(channel: string, threadTs: string, text: string) {
  if (!BOT_TOKEN()) return;
  try {
    await slackApi("chat.postMessage", { channel, thread_ts: threadTs, text });
  } catch (e) {
    console.error("Slack thread reply failed:", e);
  }
}
