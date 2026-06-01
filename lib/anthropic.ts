import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

const NewPlantSchema = z.object({
  common_name: z.string(),
  species: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  care_summary: z.string(),
  water_interval_days: z.number().int().min(1).max(60),
  fertilize_interval_days: z.number().int().min(7).max(180),
  suggested_custom_actions: z
    .array(z.object({ label: z.string(), interval_days: z.number().int().min(1).max(365) }))
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

async function callClaudeWithImage(systemPrompt: string, imageUrl: string) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: "Respond with a single JSON object only." },
        ],
      },
    ],
  });
  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text in Claude response");
  return extractJson(textBlock.text);
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
  const raw = await callClaudeWithImage(system, imageUrl);
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
  const raw = await callClaudeWithImage(system, imageUrl);
  return CheckinSchema.parse(raw);
}
