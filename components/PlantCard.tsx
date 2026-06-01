"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Droplets, Sprout, Sparkles, Check } from "lucide-react";
import { daysFromNow } from "@/lib/scheduling";
import { photoPublicUrl } from "@/lib/storage";
import { markActionDone } from "@/app/actions/care";

export type FeedSchedule = {
  id: string;
  kind: "water" | "fertilize" | "custom";
  label: string;
  next_due_at: string;
  last_done_at: string | null;
  last_done_by_name: string | null;
};

export type FeedPlant = {
  id: string;
  name: string;
  primary_photo_path: string | null;
  species: string | null;
  location: string | null;
  schedules: FeedSchedule[];
};

const ICONS = {
  water: Droplets,
  fertilize: Sprout,
  custom: Sparkles,
} as const;

export function PlantCard({ plant }: { plant: FeedPlant }) {
  const subtitle = [plant.species, plant.location].filter(Boolean).join(" · ");

  return (
    <Card className="overflow-hidden pt-0 gap-0">
      <Link href={`/plants/${plant.id}`} className="block">
        {/* Image with title overlaid at the bottom */}
        <div className="relative aspect-[4/3] w-full">
          {plant.primary_photo_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoPublicUrl(plant.primary_photo_path)}
              alt={plant.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="size-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
              No photo
            </div>
          )}
          {/* Gradient overlay + text */}
          <div className="absolute inset-x-0 bottom-0 bg-black/70 px-4 py-3">
            <h2 className="text-xl font-semibold leading-tight text-white">{plant.name}</h2>
            {subtitle && (
              <p className="text-sm text-white/75 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      </Link>

      {plant.schedules.length > 0 && (
        <CardFooter className="flex flex-col items-stretch gap-3">
          {plant.schedules.map((s) => (
            <ActionRow key={s.id} schedule={s} />
          ))}
        </CardFooter>
      )}
    </Card>
  );
}

function ActionRow({ schedule }: { schedule: FeedSchedule }) {
  const Icon = ICONS[schedule.kind];
  const [pending, start] = useTransition();
  const [doneLocal, setDoneLocal] = useState(false);
  const days = daysFromNow(schedule.next_due_at);
  const overdueDays = Math.abs(days);
  const isOverdue = days < 0;
  // Show Done button when: never been done before, due tomorrow, or overdue
  const showDone = !schedule.last_done_at || days <= 1;

  function onDone() {
    start(async () => {
      try {
        await markActionDone(schedule.id);
        setDoneLocal(true);
        toast.success(`${schedule.label} marked done`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="size-5 shrink-0 text-muted-foreground mt-0.5" />
        <div className="min-w-0">
          <div className={`truncate text-base font-medium ${doneLocal ? "line-through text-muted-foreground" : ""}`}>
            {schedule.label}
          </div>
          <div className="flex flex-col gap-1 mt-0.5">
            {doneLocal ? (
              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Done ✓</span>
            ) : (
              <>
                {schedule.last_done_by_name && (
                  <span className="inline-flex">
                    <Badge variant="outline" className="font-normal text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                      Done by {schedule.last_done_by_name}
                    </Badge>
                  </span>
                )}
                {isOverdue ? (
                  <span className="inline-flex">
                    <Badge variant="destructive" className="font-normal">
                      Overdue by {overdueDays} day{overdueDays !== 1 ? "s" : ""}
                    </Badge>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Next time in {days === 0 ? "less than a day" : `${days} day${days !== 1 ? "s" : ""}`}
                  </span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {showDone && (
        <button
          onClick={onDone}
          disabled={pending || doneLocal}
          aria-label="Mark as done"
          className={`shrink-0 size-10 rounded-full border-2 flex items-center justify-center transition-all duration-200
            ${doneLocal
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-border text-muted-foreground hover:border-emerald-500 hover:text-emerald-500 active:scale-95"
            }
            disabled:pointer-events-none
          `}
        >
          {pending
            ? <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin block" />
            : <Check className="size-5" />
          }
        </button>
      )}
    </div>
  );
}
