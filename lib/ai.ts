import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.OPENROUTER_REFERER ?? "https://plants-care.local",
    "X-Title": "Coolset Office Plant Care",
  },
});

const MODEL_IDENTIFY = process.env.OPENROUTER_MODEL_IDENTIFY ?? "anthropic/claude-sonnet-4.5";
const MODEL_CHECKIN = process.env.OPENROUTER_MODEL_CHECKIN ?? "google/gemini-3.1-flash-lite";

const NewPlantSchema = z.object({
  common_name: z.string(),
  species: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  care_summary: z.string(),
  water_interval_days: z.number().int().min(1).max(60).catch(7),
  fertilize_interval_days: z.number().int().min(7).max(180).catch(30),
  suggested_custom_actions: z
    .array(z.object({
      label: z.string(),
      interval_days: z.number().int().min(1).transform((v) => Math.min(v, 365)).catch(365),
    }))
    .default([]),
});
export type NewPlantAnalysis = z.infer<typeof NewPlantSchema>;

const CheckinSchema = z.object({
  condition: z.enum(["healthy", "minor_issues", "needs_attention"]),
  observations: z.array(z.string()).default([]),
  recommendations: z
    .array(z.object({ label: z.string(), urgency: z.enum(["now", "soon", "monitor"]) }))
    .default([]),
});
export type CheckinAnalysis = z.infer<typeof CheckinSchema>;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in model response");
  return JSON.parse(raw.slice(start, end + 1));
}

async function callWithImage(model: string, systemPrompt: string, imageUrl: string) {
  const res = await client.chat.completions.create({
    model,
    max_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl } },
          { type: "text", text: "Respond with a single JSON object only. No prose, no code fences." },
        ],
      },
    ],
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");
  return extractJson(typeof text === "string" ? text : JSON.stringify(text));
}

export async function analyzeNewPlant(imageUrl: string): Promise<NewPlantAnalysis> {
  const system = `You are a horticulturist. Identify the plant in the photo and propose a care schedule for an indoor office in Amsterdam.
Return JSON matching this shape:
{
  "common_name": string,
  "species": string | null,
  "confidence": "low" | "medium" | "high",
  "care_summary": "1-2 sentences on light/water/temperament",
  "water_interval_days": int (1..60),
  "fertilize_interval_days": int (7..180),
  "suggested_custom_actions": [{"label": string, "interval_days": int}]
}
Be conservative on watering for low-confidence identifications.`;
  const raw = await callWithImage(MODEL_IDENTIFY, system, imageUrl);
  return NewPlantSchema.parse(raw);
}

export async function analyzeCheckinPhoto(
  imageUrl: string,
  context: { species: string | null; lastWateredAgoDays: number | null },
): Promise<CheckinAnalysis> {
  const system = `You are inspecting an office plant's check-in photo. Context: species=${context.species ?? "unknown"}, last watered ${context.lastWateredAgoDays ?? "?"} days ago.
Return JSON:
{
  "condition": "healthy" | "minor_issues" | "needs_attention",
  "observations": [short strings],
  "recommendations": [{"label": "human-readable action", "urgency": "now"|"soon"|"monitor"}]
}`;
  const raw = await callWithImage(MODEL_CHECKIN, system, imageUrl);
  return CheckinSchema.parse(raw);
}
