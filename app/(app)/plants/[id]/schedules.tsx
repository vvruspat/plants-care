"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Droplets, Sprout, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { addCustomSchedule, deleteSchedule, markActionDone } from "@/app/actions/care";
import { dueLabel } from "@/lib/scheduling";
import { useRouter } from "next/navigation";

type Sched = {
  id: string;
  kind: "water" | "fertilize" | "custom";
  label: string;
  interval_days: number;
  next_due_at: string;
  last_done_at: string | null;
  last_done_by_name: string | null;
};

const ICONS = { water: Droplets, fertilize: Sprout, custom: Sparkles } as const;

export function ScheduleManager({ plantId, schedules }: { plantId: string; schedules: Sched[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [interval, setInterval] = useState(14);
  const [pending, start] = useTransition();

  function done(id: string) {
    start(async () => {
      try { await markActionDone(id); toast.success("Marked done"); router.refresh(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    });
  }
  function del(id: string) {
    if (!confirm("Remove this action?")) return;
    start(async () => {
      try { await deleteSchedule(id, plantId); router.refresh(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    });
  }
  function add() {
    if (!label.trim()) return;
    start(async () => {
      try {
        await addCustomSchedule(plantId, label.trim(), interval);
        setLabel(""); setInterval(14); setAdding(false);
        router.refresh();
      } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Care actions</CardTitle>
        <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {adding && (
          <div className="flex items-center gap-2">
            <Input placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Input type="number" className="w-20" min={1} value={interval} onChange={(e) => setInterval(Number(e.target.value))} />
            <Button size="sm" onClick={add} disabled={pending}>Add</Button>
          </div>
        )}
        {schedules.map((s) => {
          const Icon = ICONS[s.kind];
          const due = dueLabel(s.next_due_at);
          return (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{s.label}</div>
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <Badge variant={due.overdue ? "destructive" : "secondary"} className="font-normal">{due.text}</Badge>
                    <span>every {s.interval_days}d</span>
                    {s.last_done_by_name && <span>· last: {s.last_done_by_name}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" onClick={() => done(s.id)} disabled={pending}>Done</Button>
                <Button size="icon" variant="ghost" onClick={() => del(s.id)} disabled={pending}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
