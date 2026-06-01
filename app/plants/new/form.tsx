"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PhotoUpload } from "@/components/PhotoUpload";
import { toast } from "sonner";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { analyzeNewPlantPhoto } from "@/app/actions/photos";
import { createPlant } from "@/app/actions/plants";
import type { NewPlantAnalysis } from "@/lib/ai";

type CustomRow = { label: string; interval_days: number };

export function NewPlantForm() {
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<NewPlantAnalysis | null>(null);

  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [waterDays, setWaterDays] = useState(7);
  const [fertDays, setFertDays] = useState(30);
  const [customs, setCustoms] = useState<CustomRow[]>([]);

  function runAnalyze() {
    if (!photoFile) {
      toast.error("Pick a photo first");
      return;
    }
    startAnalyze(async () => {
      try {
        const fd = new FormData();
        fd.append("photo", photoFile);
        const { path, analysis } = await analyzeNewPlantPhoto(fd);
        setPhotoPath(path);
        setAnalysis(analysis);
        setName((n) => n || analysis.common_name);
        setSpecies((s) => s || analysis.species || "");
        setWaterDays(analysis.water_interval_days);
        setFertDays(analysis.fertilize_interval_days);
        setCustoms(analysis.suggested_custom_actions);
        toast.success(`Identified: ${analysis.common_name} (${analysis.confidence})`);
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
          fertilize_interval_days: fertDays,
          custom_schedules: customs.filter((c) => c.label.trim() && c.interval_days > 0),
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1 · Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <PhotoUpload onFile={(f) => { setPhotoFile(f); setAnalysis(null); setPhotoPath(null); }} />
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={!photoFile || analyzing}
            onClick={runAnalyze}
          >
            <Sparkles className="mr-2 size-4" />
            {analyzing ? "Asking Claude…" : analysis ? "Re-analyze" : "Identify with AI"}
          </Button>
          {analysis && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{analysis.common_name}</span>
                <Badge variant="outline">{analysis.confidence} confidence</Badge>
              </div>
              <p className="text-muted-foreground">{analysis.care_summary}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2 · Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
          <Field label="Species"><Input value={species} onChange={(e) => setSpecies(e.target.value)} /></Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Kitchen window" />
          </Field>
          <Field label="Notes">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3 · Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Water every (days)">
            <Input type="number" min={1} max={60} value={waterDays} onChange={(e) => setWaterDays(Number(e.target.value))} />
          </Field>
          <Field label="Fertilize every (days)">
            <Input type="number" min={7} max={180} value={fertDays} onChange={(e) => setFertDays(Number(e.target.value))} />
          </Field>
          <div className="space-y-2">
            <Label>Custom actions</Label>
            {customs.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={c.label}
                  placeholder="e.g. Iron supplement"
                  onChange={(e) => setCustoms((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                />
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={c.interval_days}
                  onChange={(e) => setCustoms((arr) => arr.map((x, j) => (j === i ? { ...x, interval_days: Number(e.target.value) } : x)))}
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => setCustoms((arr) => arr.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setCustoms((arr) => [...arr, { label: "", interval_days: 30 }])}>
              <Plus className="mr-1 size-4" /> Add action
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save plant"}
      </Button>
    </form>
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
