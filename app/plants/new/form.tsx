"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/PhotoUpload";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { analyzeNewPlantPhoto } from "@/app/actions/photos";
import { createPlant } from "@/app/actions/plants";
import type { NewPlantAnalysis } from "@/lib/ai";
import { compressImage } from "@/lib/compress";

type CustomRow = { label: string; interval_days: number };

export function NewPlantForm() {
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<NewPlantAnalysis | null>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [waterDays, setWaterDays] = useState(7);
  const [customs, setCustoms] = useState<CustomRow[]>([]);

  // Triggered immediately when the user picks a photo.
  function onFile(file: File) {
    setAnalysis(null);
    setPhotoPath(null);
    startAnalyze(async () => {
      try {
        const compressed = await compressImage(file);
        const fd = new FormData();
        fd.append("photo", compressed);
        const { path, analysis } = await analyzeNewPlantPhoto(fd);
        setPhotoPath(path);
        setAnalysis(analysis);
        // Pre-fill details from AI — only if the field is still empty.
        setName((n) => n || analysis.common_name);
        setSpecies((s) => s || analysis.species || "");
        setWaterDays(analysis.water_interval_days);
        // Fertilize + any AI-suggested custom actions become editable custom rows.
        setCustoms([
          { label: "Fertilize", interval_days: analysis.fertilize_interval_days },
          ...analysis.suggested_custom_actions,
        ]);
        toast.success(`Identified: ${analysis.common_name} (${analysis.confidence} confidence)`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "AI analysis failed");
      }
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Give the plant a name");
      return;
    }
    startSave(async () => {
      try {
        await createPlant({
          name: name.trim(),
          species: species.trim() || null,
          notes: notes.trim() || null,
          location: location.trim() || null,
          primary_photo_path: photoPath,
          ai_care_summary: analysis?.care_summary ?? null,
          water_interval_days: waterDays,
          custom_schedules: customs.filter((c) => c.label.trim() && c.interval_days > 0),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">

      {/* ─── Photo ─────────────────────────────────────── */}
      <Section title="Photo">
        <PhotoUpload onFile={onFile} analyzing={analyzing} />
        {analysis && (
          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{analysis.common_name}</span>
              <Badge variant="outline">{analysis.confidence} confidence</Badge>
            </div>
            <p className="text-muted-foreground">{analysis.care_summary}</p>
          </div>
        )}
      </Section>

      <hr className="border-border" />

      {/* ─── Details ───────────────────────────────────── */}
      <Section title="Details">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Species">
          <Input value={species} onChange={(e) => setSpecies(e.target.value)} />
        </Field>
        <Field label="Location">
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kitchen window" />
        </Field>
        <Field label="Notes">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </Field>
      </Section>

      <hr className="border-border" />

      {/* ─── Schedule ──────────────────────────────────── */}
      <Section title="Schedule">
        <Field label="Water every (days)">
          <Input
            type="number"
            min={1}
            max={60}
            value={waterDays}
            onChange={(e) => setWaterDays(Number(e.target.value))}
          />
        </Field>

        <div className="space-y-2">
          <Label>Extra actions</Label>
          {customs.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={c.label}
                placeholder="e.g. Fertilize"
                onChange={(e) =>
                  setCustoms((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                }
              />
              <Input
                type="number"
                min={1}
                className="w-24 shrink-0"
                value={c.interval_days}
                onChange={(e) =>
                  setCustoms((arr) => arr.map((x, j) => (j === i ? { ...x, interval_days: Number(e.target.value) } : x)))
                }
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setCustoms((arr) => arr.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCustoms((arr) => [...arr, { label: "", interval_days: 30 }])}
          >
            <Plus className="mr-1 size-4" /> Add action
          </Button>
        </div>
      </Section>

      <Button type="submit" disabled={saving || analyzing} className="w-full">
        {saving ? "Saving…" : analyzing ? (
          <><Loader2 className="mr-2 size-4 animate-spin" /> Analysing photo…</>
        ) : "Save plant"}
      </Button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
