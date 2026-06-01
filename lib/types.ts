export type Plant = {
  id: string;
  name: string;
  species: string | null;
  notes: string | null;
  location: string | null;
  primary_photo_path: string | null;
  ai_care_summary: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CareSchedule = {
  id: string;
  plant_id: string;
  kind: "water" | "fertilize" | "custom";
  label: string;
  interval_days: number;
  next_due_at: string;
  last_done_at: string | null;
  last_done_by: string | null;
  active: boolean;
};

export type PlantPhoto = {
  id: string;
  plant_id: string;
  storage_path: string;
  taken_at: string;
  uploaded_by: string | null;
  ai_analysis: Record<string, unknown> | null;
};
